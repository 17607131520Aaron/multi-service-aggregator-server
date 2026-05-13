import { AuthenticatedUser, AuthService } from '@/auth/auth.service';
import { AppUnauthorizedException } from '@/common/enterprise-exceptions';
import { METADATA_KEYS } from '@/common/metadata-keys';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  token?: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(METADATA_KEYS.PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = this.extractBearerToken(authorization);
    const user = await this.authService.verifyToken(token);

    request.user = user;
    request.token = token;
    return true;
  }

  private extractBearerToken(authorization?: string): string {
    if (!authorization) {
      throw new AppUnauthorizedException('缺少 Authorization 请求头');
    }

    const [type, token] = authorization.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new AppUnauthorizedException('Authorization 格式必须为 Bearer <token>');
    }

    return token;
  }
}
