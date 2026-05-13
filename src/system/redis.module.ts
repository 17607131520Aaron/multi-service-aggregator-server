import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { INJECTION_TOKENS } from '@/common/injection-tokens';
import { getRedisConfig } from '@/config/redis.config';

@Module({
  providers: [
    {
      provide: INJECTION_TOKENS.REDIS_SERVICE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis | null => {
        const redis = getRedisConfig(configService);

        if (!redis.required) {
          console.log('[Redis] disabled by config');
          return null;
        }

        console.log(
          `[Redis] creating client host=${redis.host}, port=${redis.port}, db=${redis.db}, keyPrefix=${redis.keyPrefix ?? ''}`,
        );

        const client = new Redis({
          host: redis.host,
          port: redis.port,
          password: redis.password,
          db: redis.db,
          keyPrefix: redis.keyPrefix,
          lazyConnect: true,
          maxRetriesPerRequest: null,
        });

        client.on('connect', () => console.log('[Redis] status=connect'));
        client.on('ready', () => console.log('[Redis] status=ready'));
        client.on('reconnecting', () => console.log('[Redis] status=reconnecting'));
        client.on('error', (error: Error) =>
          console.log(`[Redis] status=error message=${error.message}`),
        );

        return client;
      },
    },
  ],
  exports: [INJECTION_TOKENS.REDIS_SERVICE],
})
export class RedisModule {}
