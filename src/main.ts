import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 全局请求体验证：把字段校验从 services 挪到 DTO + 管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 只保留在 DTO 上声明的字段
      forbidNonWhitelisted: true, // 请求里多出来的字段直接报错
      transform: true, // 自动把原始数据转换成 DTO 类型
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const env = 'dev';
  const port = 9000;

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
  logger.log(`Scalar UI: http://localhost:${port}/api-docs`);
  logger.log(`Environment: ${env}`);
  logger.log(`Port: ${port}`);
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port} (env=${env})`);
}
void bootstrap();
