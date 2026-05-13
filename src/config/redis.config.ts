import type { ConfigService } from '@nestjs/config';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix?: string;
  required: boolean;
}

export function getRedisConfig(configService: ConfigService): RedisConfig {
  const config = configService.get<RedisConfig>('redis');

  if (!config) {
    throw new Error('Redis config is missing');
  }

  return {
    host: config.host,
    port: Number(config.port),
    password: config.password,
    db: Number(config.db),
    keyPrefix: config.keyPrefix,
    required: Boolean(config.required),
  };
}
