import { INJECTION_TOKENS } from '@/common/injection-tokens';
import { getDbConfig } from '@/config/db.config';
import { getHealthConfig } from '@/config/health.config';
import { getRedisConfig } from '@/config/redis.config';
import { Inject, Injectable, Logger, OnApplicationBootstrap, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { DataSource } from 'typeorm';

type DependencyStatus = 'up' | 'down' | 'disabled';

interface HealthDependencyResult {
  status: DependencyStatus;
  message: string;
}

export interface HealthCheckResult {
  status: 'ok' | 'error';
  environment: string;
  timestamp: string;
  details: {
    mysql: HealthDependencyResult;
    redis: HealthDependencyResult;
  };
}

@Injectable()
export class HealthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(INJECTION_TOKENS.REDIS_SERVICE)
    private readonly redisClient: Redis | null,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    const env = this.configService.get<string>('app.env') ?? process.env.NODE_ENV ?? 'development';
    const port = this.configService.get<number>('app.port') ?? 9000;
    const apiPrefix = this.configService.get<string>('app.apiPrefix') ?? '';
    const mysqlConfig = getDbConfig(this.configService);
    const healthConfig = getHealthConfig(this.configService);
    const redisConfig = getRedisConfig(this.configService);

    this.logger.log(`App config: env=${env}, port=${port}, apiPrefix=${apiPrefix || '/'}`);
    this.logger.log(
      `MySQL config: host=${mysqlConfig.host}, port=${mysqlConfig.port}, database=${mysqlConfig.database}, username=${mysqlConfig.username}, synchronize=${mysqlConfig.synchronize}, logging=${mysqlConfig.logging}`,
    );
    this.logger.log(
      `MySQL status: ${this.dataSource.isInitialized ? 'connected' : 'disconnected'}`,
    );
    this.logger.log(
      `Redis config: host=${redisConfig.host}, port=${redisConfig.port}, db=${redisConfig.db}, keyPrefix=${redisConfig.keyPrefix ?? ''}, required=${redisConfig.required}`,
    );
    this.logger.log(
      `Health config: mysql(enabled=${healthConfig.mysql.enabled}, timeoutMs=${healthConfig.mysql.timeoutMs}), redis(enabled=${healthConfig.redis.enabled}, timeoutMs=${healthConfig.redis.timeoutMs})`,
    );

    const redisStatus = await this.checkRedis();
    this.logger.log(`Redis status: ${redisStatus.message}`);
  }

  public getLiveness(): { status: 'ok'; environment: string; timestamp: string } {
    return {
      status: 'ok',
      environment:
        this.configService.get<string>('app.env') ?? process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
    };
  }

  public async getReadiness(): Promise<HealthCheckResult> {
    const [mysql, redis] = await Promise.all([this.checkMysql(), this.checkRedis()]);
    const status = mysql.status === 'up' && redis.status !== 'down' ? 'ok' : 'error';

    return {
      status,
      environment:
        this.configService.get<string>('app.env') ?? process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
      details: { mysql, redis },
    };
  }

  private async checkMysql(): Promise<HealthDependencyResult> {
    const healthConfig = getHealthConfig(this.configService);

    if (!healthConfig.mysql.enabled) {
      return { status: 'disabled', message: 'disabled by config' };
    }

    try {
      await this.withTimeout(this.dataSource.query('SELECT 1'), healthConfig.mysql.timeoutMs, 'mysql');
      return { status: 'up', message: 'connected' };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'mysql check failed',
      };
    }
  }

  private async checkRedis(): Promise<HealthDependencyResult> {
    const healthConfig = getHealthConfig(this.configService);
    const redisConfig = getRedisConfig(this.configService);

    if (!healthConfig.redis.enabled) {
      return { status: 'disabled', message: 'disabled by config' };
    }

    if (!redisConfig.required) {
      return { status: 'disabled', message: 'disabled by config' };
    }

    if (!this.redisClient) {
      return { status: 'down', message: 'redis client unavailable' };
    }

    try {
      if (this.redisClient.status === 'wait') {
        await this.withTimeout(this.redisClient.connect(), healthConfig.redis.timeoutMs, 'redis');
      }

      const response = await this.withTimeout(
        this.redisClient.ping(),
        healthConfig.redis.timeoutMs,
        'redis',
      );
      return {
        status: response === 'PONG' ? 'up' : 'down',
        message: response === 'PONG' ? `connected (${this.redisClient.status})` : response,
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'redis check failed',
      };
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, dependency: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${dependency} health check timeout (${timeoutMs}ms)`)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
