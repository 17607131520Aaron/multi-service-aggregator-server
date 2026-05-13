import type { ConfigService } from '@nestjs/config';

export interface HealthDependencyConfig {
  enabled: boolean;
  timeoutMs: number;
}

export interface HealthConfig {
  mysql: HealthDependencyConfig;
  redis: HealthDependencyConfig;
}

export function getHealthConfig(configService: ConfigService): HealthConfig {
  const mysqlEnabled = configService.get<boolean>('health.mysql.enabled');
  const mysqlTimeoutMs = configService.get<number>('health.mysql.timeoutMs');
  const redisEnabled = configService.get<boolean>('health.redis.enabled');
  const redisTimeoutMs = configService.get<number>('health.redis.timeoutMs');

  return {
    mysql: {
      enabled: mysqlEnabled ?? true,
      timeoutMs: Number(mysqlTimeoutMs ?? 3000),
    },
    redis: {
      enabled: redisEnabled ?? true,
      timeoutMs: Number(redisTimeoutMs ?? 3000),
    },
  };
}
