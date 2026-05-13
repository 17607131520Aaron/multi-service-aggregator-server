import type { ConfigService } from '@nestjs/config';

export interface JwtConfig {
  secret: string;
  ttlSeconds: number;
}

export function getJwtConfig(configService: ConfigService): JwtConfig {
  const config = configService.get<JwtConfig>('jwt');

  if (!config?.secret) {
    throw new Error('JWT config is missing');
  }

  return {
    secret: config.secret,
    ttlSeconds: Number(config.ttlSeconds ?? 3600),
  };
}
