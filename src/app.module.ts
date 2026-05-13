import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { load } from 'js-yaml';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { AuthModule } from '@/auth/auth.module';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { INJECTION_TOKENS } from '@/common/injection-tokens';
import { RequestContextMiddleware } from '@/common/request-context.middleware';
import { getDbConfig } from '@/config/db.config';
import { HealthModule } from '@/health/health.module';
import { DtoTransformInterceptor } from '@/interceptors/dto-transform.interceptor';
import { GlobalResponseWrapperInterceptor } from '@/interceptors/global-response.interceptor';
import { HttpExceptionFilter } from '@/interceptors/http-exception.interceptor';
import { RequestLoggingInterceptor } from '@/interceptors/request-logging.interceptor';

function resolveConfigFilePath(): string {
  const runtimeEnv = process.env.NODE_ENV ?? 'development';
  const configFilePath = join(process.cwd(), 'config', `application.${runtimeEnv}.yml`);

  if (existsSync(configFilePath)) {
    return configFilePath;
  }

  return join(process.cwd(), 'config', 'application.test.yml');
}

function loadYamlConfig(): Record<string, unknown> {
  const configFilePath = resolveConfigFilePath();
  const fileContent = readFileSync(configFilePath, 'utf8');

  return (load(fileContent) as Record<string, unknown>) ?? {};
}

function logEnvironmentConfig(configService: ConfigService): void {
  const env = configService.get<string>('app.env') ?? process.env.NODE_ENV ?? 'development';
  const port = configService.get<number>('app.port') ?? 9000;
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? '';
  const mysqlConfig = getDbConfig(configService);

  console.log(`[Config] app env=${env}, port=${port}, apiPrefix=${apiPrefix || '/'}`);
  console.log(
    `[Config] mysql host=${mysqlConfig.host}, port=${mysqlConfig.port}, database=${mysqlConfig.database}, username=${mysqlConfig.username}, synchronize=${mysqlConfig.synchronize}, logging=${mysqlConfig.logging}`,
  );
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [loadYamlConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        logEnvironmentConfig(configService);
        const mysqlConfig = getDbConfig(configService);

        return {
          type: 'mysql' as const,
          host: mysqlConfig.host,
          port: mysqlConfig.port,
          username: mysqlConfig.username,
          password: mysqlConfig.password,
          database: mysqlConfig.database,
          synchronize: mysqlConfig.synchronize,
          logging: mysqlConfig.logging,
          autoLoadEntities: true,
          connectTimeout: 10_000,
        };
      },
    }),
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: GlobalResponseWrapperInterceptor },
    { provide: APP_INTERCEPTOR, useClass: DtoTransformInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: INJECTION_TOKENS.DEFAULT_DTO, useValue: null },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: INJECTION_TOKENS.DEFAULT_SUCCESS_CODE, useValue: 0 },
    { provide: INJECTION_TOKENS.DEFAULT_ERROR_CODE, useValue: 9000 },
  ],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
