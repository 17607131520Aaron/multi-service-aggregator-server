import { compare, hash } from 'bcryptjs';
import type Redis from 'ioredis';
import { IsNull, Repository } from 'typeorm';

import { AppLoginDto, AppLoginType, AppRegisterDto, AppRegisterType } from '@/app/dto/auth.dto';
import { UserEntity, UserRegistrationSource } from '@/auth/entities/user.entity';
import {
  AppBusinessException,
  AppDataExistsException,
  AppDataNotFoundException,
  AppInternalErrorException,
  AppMissingParameterException,
  AppUnauthorizedException,
} from '@/common/enterprise-exceptions';
import { INJECTION_TOKENS } from '@/common/injection-tokens';
import { getJwtConfig, JwtConfig } from '@/config/jwt.config';
// import { WebLoginDto, WebRegisterDto } from '@/web/dto/auth.dto';
import { WebLoginDto, WebRegisterDto, WebUserQueryDto } from '@/web/dto/user.dto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';

export interface JwtPayload {
  sub: string;
  username: string;
}

export interface AuthenticatedUser {
  userId: string;
  username: string | null;
  email: string | null;
  phone: string | null;
}

export interface LoginResult {
  userId: string;
  username: string;
  email: string | null;
  phone: string | null;
  token: string;
  expiresIn: number;
}

export interface WebUserProfileResult {
  userId: string;
  username: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  email: string | null;
  phone: string | null;
  registrationSource: UserRegistrationSource;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly jwtConfig: JwtConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @Optional()
    @Inject(INJECTION_TOKENS.REDIS_SERVICE)
    private readonly redisClient: Redis | null,
  ) {
    this.jwtConfig = getJwtConfig(this.configService);
  }

  public async registerWebUser(registerDto: WebRegisterDto): Promise<LoginResult> {
    this.ensurePasswordsMatch(registerDto.password, registerDto.confirmPassword);
    await this.ensureUniqueUser({
      username: registerDto.username,
      email: registerDto.email,
    });

    const user = await this.userRepository.save(
      this.userRepository.create({
        username: registerDto.username,
        email: registerDto.email,
        passwordHash: await hash(registerDto.password, 10),
        registrationSource: UserRegistrationSource.WEB,
      }),
    );

    return this.createSession(user);
  }

  public async registerAppUser(registerDto: AppRegisterDto): Promise<LoginResult> {
    this.ensurePasswordsMatch(registerDto.password, registerDto.confirmPassword);

    if (registerDto.type === AppRegisterType.ACCOUNT) {
      const username = registerDto.username!;
      await this.ensureUniqueUser({ username });

      const user = await this.userRepository.save(
        this.userRepository.create({
          username,
          passwordHash: await hash(registerDto.password, 10),
          registrationSource: UserRegistrationSource.APP,
        }),
      );

      return this.createSession(user);
    }

    const phone = registerDto.phone!;
    await this.ensureUniqueUser({ phone });

    const user = await this.userRepository.save(
      this.userRepository.create({
        phone,
        passwordHash: await hash(registerDto.password, 10),
        registrationSource: UserRegistrationSource.APP,
      }),
    );

    return this.createSession(user);
  }

  public async loginWebUser(loginDto: WebLoginDto): Promise<LoginResult> {
    const user = await this.userRepository.findOne({
      where: { username: loginDto.username },
    });

    return this.loginWithPassword(user, loginDto.password);
  }

  public async loginAppUser(loginDto: AppLoginDto): Promise<LoginResult> {
    switch (loginDto.type) {
      case AppLoginType.ACCOUNT_PASSWORD: {
        const user = await this.userRepository.findOne({
          where: { username: loginDto.username! },
        });
        return this.loginWithPassword(user, loginDto.password!);
      }
      case AppLoginType.PHONE_PASSWORD: {
        const user = await this.userRepository.findOne({
          where: { phone: loginDto.phone! },
        });
        return this.loginWithPassword(user, loginDto.password!);
      }
      case AppLoginType.PHONE_CODE: {
        await this.ensureRedisReady();
        await this.validatePhoneVerificationCode(loginDto.phone!, loginDto.verificationCode!);

        const user = await this.userRepository.findOne({
          where: { phone: loginDto.phone! },
        });
        if (!user) {
          throw new AppDataNotFoundException('该手机号尚未注册');
        }

        return this.createSession(user);
      }
    }

    throw new AppBusinessException('不支持的登录方式');
  }

  public async getWebUserProfile(queryDto: WebUserQueryDto): Promise<WebUserProfileResult> {
    const where = [
      queryDto.userId ? { id: queryDto.userId, deletedAt: IsNull() } : null,
      queryDto.username ? { username: queryDto.username, deletedAt: IsNull() } : null,
      queryDto.email ? { email: queryDto.email, deletedAt: IsNull() } : null,
      queryDto.phone ? { phone: queryDto.phone, deletedAt: IsNull() } : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    if (where.length === 0) {
      throw new AppMissingParameterException(
        '请至少提供 userId、username、email、phone 中的一个查询条件',
      );
    }

    const user = await this.userRepository.findOne({ where });
    if (!user) {
      throw new AppDataNotFoundException('用户不存在');
    }

    return this.toWebUserProfile(user);
  }

  public async sendPhoneVerificationCode(phone: string): Promise<{
    phone: string;
    expiresIn: number;
    verificationCode?: string;
  }> {
    await this.ensureRedisReady();

    const code = this.generateVerificationCode();
    const expiresIn = 300;
    await this.redisClient!.set(this.buildVerificationCodeKey(phone), code, 'EX', expiresIn);

    return {
      phone,
      expiresIn,
      verificationCode: this.isNonProduction() ? code : undefined,
    };
  }

  public async verifyToken(token: string): Promise<AuthenticatedUser> {
    await this.ensureRedisReady();

    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.jwtConfig.secret,
      });
    } catch {
      throw new AppUnauthorizedException('token 无效或已过期');
    }

    const storedToken = await this.redisClient!.get(this.buildTokenKey(payload.sub));
    if (!storedToken || storedToken !== token) {
      throw new AppUnauthorizedException('登录状态已失效，请重新登录');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new AppUnauthorizedException('用户不存在或已被删除');
    }

    if (!user.enabled) {
      throw new AppUnauthorizedException('用户已被禁用');
    }

    return this.toAuthenticatedUser(user);
  }

  private async loginWithPassword(user: UserEntity | null, password: string): Promise<LoginResult> {
    if (!user) {
      throw new AppUnauthorizedException('账号或密码错误');
    }

    if (!user.passwordHash) {
      throw new AppUnauthorizedException('当前账号未设置密码');
    }

    const matched = await compare(password, user.passwordHash);
    if (!matched) {
      throw new AppUnauthorizedException('账号或密码错误');
    }

    return this.createSession(user);
  }

  private async createSession(user: UserEntity): Promise<LoginResult> {
    await this.ensureRedisReady();

    if (!user.enabled) {
      throw new AppUnauthorizedException('用户已被禁用');
    }

    const displayName = user.username ?? user.phone;
    if (!displayName) {
      throw new AppInternalErrorException('用户缺少可用的登录标识');
    }

    const token = await this.jwtService.signAsync(
      {
        sub: user.id,
        username: displayName,
      },
      {
        secret: this.jwtConfig.secret,
        expiresIn: this.jwtConfig.ttlSeconds,
      },
    );

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);
    await this.redisClient!.set(
      this.buildTokenKey(user.id),
      token,
      'EX',
      this.jwtConfig.ttlSeconds,
    );

    return {
      userId: user.id,
      username: displayName,
      email: user.email,
      phone: user.phone,
      token,
      expiresIn: this.jwtConfig.ttlSeconds,
    };
  }

  private toAuthenticatedUser(user: UserEntity): AuthenticatedUser {
    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
    };
  }

  private toWebUserProfile(user: UserEntity): WebUserProfileResult {
    return {
      userId: user.id,
      username: user.username,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      email: user.email,
      phone: user.phone,
      registrationSource: user.registrationSource,
      enabled: user.enabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async ensureUniqueUser(input: {
    username?: string;
    email?: string;
    phone?: string;
  }): Promise<void> {
    if (input.username) {
      const existed = await this.userRepository.findOne({ where: { username: input.username } });
      if (existed) {
        throw new AppDataExistsException('用户名已存在');
      }
    }

    if (input.email) {
      const existed = await this.userRepository.findOne({ where: { email: input.email } });
      if (existed) {
        throw new AppDataExistsException('邮箱已存在');
      }
    }

    if (input.phone) {
      const existed = await this.userRepository.findOne({ where: { phone: input.phone } });
      if (existed) {
        throw new AppDataExistsException('手机号已存在');
      }
    }
  }

  private ensurePasswordsMatch(password: string, confirmPassword: string): void {
    if (password !== confirmPassword) {
      throw new AppBusinessException('两次输入的密码不一致');
    }
  }

  private async validatePhoneVerificationCode(
    phone: string,
    verificationCode: string,
  ): Promise<void> {
    const key = this.buildVerificationCodeKey(phone);
    const storedCode = await this.redisClient!.get(key);
    if (!storedCode || storedCode !== verificationCode) {
      throw new AppUnauthorizedException('验证码无效或已过期');
    }

    await this.redisClient!.del(key);
  }

  private buildTokenKey(userId: string): string {
    return `auth:token:${userId}`;
  }

  private buildVerificationCodeKey(phone: string): string {
    return `auth:sms-code:${phone}`;
  }

  private generateVerificationCode(): string {
    return `${Math.floor(Math.random() * 900000) + 100000}`;
  }

  private isNonProduction(): boolean {
    const env = this.configService.get<string>('app.env') ?? process.env.NODE_ENV ?? 'development';
    return env !== 'production';
  }

  private async ensureRedisReady(): Promise<void> {
    if (!this.redisClient) {
      throw new AppInternalErrorException('redis 未启用，无法进行登录态校验');
    }

    if (this.redisClient.status === 'wait') {
      await this.redisClient.connect();
    }
  }
}
