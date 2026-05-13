import { hash } from 'bcryptjs';
import type { JwtService } from '@nestjs/jwt';
import type Redis from 'ioredis';

import { AppLoginType, AppRegisterType } from '@/app/dto/auth.dto';
import { UserRegistrationSource } from '@/auth/entities/user.entity';
import {
  AppDataExistsException,
  AppUnauthorizedException,
} from '@/common/enterprise-exceptions';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'jwt') {
        return {
          secret: 'unit-test-secret',
          ttlSeconds: 1800,
        };
      }

      if (key === 'app.env') {
        return 'test';
      }

      return undefined;
    }),
  };

  const jwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as unknown as JwtService;

  const redisClient = {
    status: 'ready',
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    connect: jest.fn(),
  } as unknown as Redis;

  const userRepository = {
    create: jest.fn((entity) => entity),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  let authService: AuthService;

  beforeEach(() => {
    userRepository.create.mockReset();
    userRepository.save.mockReset();
    userRepository.findOne.mockReset();
    (jwtService.signAsync as jest.Mock).mockReset();
    (jwtService.verifyAsync as jest.Mock).mockReset();
    (redisClient.set as jest.Mock).mockReset();
    (redisClient.get as jest.Mock).mockReset();
    (redisClient.del as jest.Mock).mockReset();
    (redisClient.connect as jest.Mock).mockReset();
    userRepository.create.mockImplementation((entity) => entity);
    authService = new AuthService(
      configService as never,
      jwtService,
      userRepository as never,
      redisClient,
    );
  });

  it('registers web user and stores token in redis', async () => {
    userRepository.findOne.mockResolvedValue(null);
    userRepository.save
      .mockResolvedValueOnce({
        id: '1',
        username: 'alice',
        email: 'alice@example.com',
        phone: null,
        enabled: true,
        passwordHash: 'hashed-password',
        registrationSource: UserRegistrationSource.WEB,
      })
      .mockResolvedValueOnce({
        id: '1',
        username: 'alice',
        email: 'alice@example.com',
        phone: null,
        enabled: true,
        passwordHash: 'hashed-password',
        registrationSource: UserRegistrationSource.WEB,
        lastLoginAt: new Date(),
      });
    (jwtService.signAsync as jest.Mock).mockResolvedValue('signed-token');

    await expect(
      authService.registerWebUser({
        username: 'alice',
        email: 'alice@example.com',
        password: 'secret123',
        confirmPassword: 'secret123',
      }),
    ).resolves.toEqual({
      userId: '1',
      username: 'alice',
      email: 'alice@example.com',
      phone: null,
      token: 'signed-token',
      expiresIn: 1800,
    });

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'alice',
        email: 'alice@example.com',
        registrationSource: UserRegistrationSource.WEB,
      }),
    );
    expect(redisClient.set).toHaveBeenCalledWith('auth:token:1', 'signed-token', 'EX', 1800);
  });

  it('supports web login with username and password', async () => {
    const passwordHash = await hash('secret123', 10);
    userRepository.findOne.mockResolvedValue({
      id: '3',
      username: 'admin',
      email: 'admin@example.com',
      phone: null,
      enabled: true,
      passwordHash,
    });
    userRepository.save.mockImplementation(async (entity) => entity);
    (jwtService.signAsync as jest.Mock).mockResolvedValue('web-login-token');

    await expect(
      authService.loginWebUser({
        username: 'admin',
        password: 'secret123',
        rememberMe: true,
      }),
    ).resolves.toEqual({
      userId: '3',
      username: 'admin',
      email: 'admin@example.com',
      phone: null,
      token: 'web-login-token',
      expiresIn: 1800,
    });

    expect(redisClient.set).toHaveBeenCalledWith(
      'auth:token:3',
      'web-login-token',
      'EX',
      1800,
    );
  });

  it('allows web-registered account to login from app with username and password', async () => {
    const passwordHash = await hash('secret123', 10);
    userRepository.findOne.mockResolvedValue({
      id: '4',
      username: 'alice',
      email: 'alice@example.com',
      phone: null,
      enabled: true,
      passwordHash,
      registrationSource: UserRegistrationSource.WEB,
    });
    userRepository.save.mockImplementation(async (entity) => entity);
    (jwtService.signAsync as jest.Mock).mockResolvedValue('app-login-token');

    await expect(
      authService.loginAppUser({
        type: AppLoginType.ACCOUNT_PASSWORD,
        username: 'alice',
        password: 'secret123',
      }),
    ).resolves.toEqual({
      userId: '4',
      username: 'alice',
      email: 'alice@example.com',
      phone: null,
      token: 'app-login-token',
      expiresIn: 1800,
    });
  });

  it('allows app-registered account to login from web with username and password', async () => {
    const passwordHash = await hash('secret123', 10);
    userRepository.findOne.mockResolvedValue({
      id: '5',
      username: 'bob',
      email: null,
      phone: null,
      enabled: true,
      passwordHash,
      registrationSource: UserRegistrationSource.APP,
    });
    userRepository.save.mockImplementation(async (entity) => entity);
    (jwtService.signAsync as jest.Mock).mockResolvedValue('web-cross-login-token');

    await expect(
      authService.loginWebUser({
        username: 'bob',
        password: 'secret123',
      }),
    ).resolves.toEqual({
      userId: '5',
      username: 'bob',
      email: null,
      phone: null,
      token: 'web-cross-login-token',
      expiresIn: 1800,
    });
  });

  it('rejects duplicate phone during app registration', async () => {
    userRepository.findOne.mockResolvedValueOnce({ id: '2', phone: '13800138000' });

    await expect(
      authService.registerAppUser({
        type: AppRegisterType.PHONE,
        phone: '13800138000',
        password: 'secret123',
        confirmPassword: 'secret123',
      }),
    ).rejects.toBeInstanceOf(AppDataExistsException);
  });

  it('supports phone verification code login', async () => {
    (redisClient.get as jest.Mock)
      .mockResolvedValueOnce('123456')
      .mockResolvedValueOnce('signed-token');
    userRepository.findOne
      .mockResolvedValueOnce({
        id: '8',
        username: null,
        email: null,
        phone: '13800138000',
        enabled: true,
        passwordHash: 'hashed-password',
      })
      .mockResolvedValueOnce({
        id: '8',
        username: null,
        email: null,
        phone: '13800138000',
        enabled: true,
        passwordHash: 'hashed-password',
        lastLoginAt: new Date(),
      });
    userRepository.save.mockImplementation(async (entity) => entity);
    (jwtService.signAsync as jest.Mock).mockResolvedValue('signed-token');
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: '8',
      username: '13800138000',
    });

    await expect(
      authService.loginAppUser({
        type: AppLoginType.PHONE_CODE,
        phone: '13800138000',
        verificationCode: '123456',
      }),
    ).resolves.toEqual({
      userId: '8',
      username: '13800138000',
      email: null,
      phone: '13800138000',
      token: 'signed-token',
      expiresIn: 1800,
    });

    expect(redisClient.del).toHaveBeenCalledWith('auth:sms-code:13800138000');
  });

  it('rejects token when redis session does not match', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: '1',
      username: 'alice',
    });
    (redisClient.get as jest.Mock).mockResolvedValue('another-token');

    await expect(authService.verifyToken('signed-token')).rejects.toBeInstanceOf(
      AppUnauthorizedException,
    );
  });
});
