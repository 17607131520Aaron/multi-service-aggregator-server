import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

function normalizeCorsOrigins(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 全局请求体验证：把字段校验从 services 挪到 DTO + 管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 只保留在 DTO 上声明的字段
      forbidNonWhitelisted: true, // 请求里多出来的字段直接报错
      transform: true, // 自动把原始数据转换成 DTO 类型
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const env = configService.get<string>('app.env') ?? process.env.NODE_ENV ?? 'development';
  const port = configService.get<number>('app.port') ?? 9000;
  const apiPrefix = configService.get<string>('app.apiPrefix') ?? '';
  const corsOrigins = normalizeCorsOrigins(configService.get<unknown>('app.corsOrigins'));

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.length === 0 || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['x-request-id'],
    credentials: true,
  });

  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix);
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API 文档')
    .setDescription('API 描述')
    .setVersion('1.0')
    .addTag('api')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Scalar UI - 现代化的 API 文档界面
  app.use(
    '/api-docs',
    apiReference({
      sources: [{ content: document }],
      theme: 'default',
      layout: 'modern',
      defaultHttpClient: {
        targetKey: 'js',
        clientKey: 'axios',
      },
    }),
  );

  logger.log('API docs enabled');
  logger.log(`Scalar UI: http://localhost:${port}${apiPrefix}/api-docs`);
  logger.log(`Environment: ${env}`);
  logger.log(`Port: ${port}`);
  logger.log(`CORS origins: ${corsOrigins.length > 0 ? corsOrigins.join(', ') : '*'}`);
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port} (env=${env})`);
}
void bootstrap();
