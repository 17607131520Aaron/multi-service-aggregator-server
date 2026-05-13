import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AuthController } from '@/app/user-controller';
import { INJECTION_TOKENS } from '@/common/injection-tokens';
import { RequestContextMiddleware } from '@/common/request-context.middleware';
import { DtoTransformInterceptor } from '@/interceptors/dto-transform.interceptor';
import { GlobalResponseWrapperInterceptor } from '@/interceptors/global-response.interceptor';
import { HttpExceptionFilter } from '@/interceptors/http-exception.interceptor';
import { RequestLoggingInterceptor } from '@/interceptors/request-logging.interceptor';

@Module({
  imports: [],
  controllers: [AuthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: GlobalResponseWrapperInterceptor },
    { provide: APP_INTERCEPTOR, useClass: DtoTransformInterceptor },
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
