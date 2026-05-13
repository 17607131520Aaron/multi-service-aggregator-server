import { APP_ERROR_CODES, AppHttpException } from '@/common/common-errors'; // 企业级错误定义与代码常量
import { INJECTION_TOKENS } from '@/common/injection-tokens';
import type { RequestWithContext } from '@/common/request-context.middleware';
import {
  ArgumentsHost, // 异常过滤器接口
  Catch,
  ExceptionFilter, // 请求上下文宿主
  HttpException, // HTTP 异常基类
  HttpStatus, // 使类可注入的装饰器
  Inject, // HTTP 状态码枚举
  Injectable, // 依赖注入标记
  Logger,
} from '@nestjs/common';
import { Response } from 'express'; // Express.Response 类型
import { QueryFailedError } from 'typeorm';

@Injectable() // 将该类标注为可注入的服务
@Catch() // 捕获所有异常
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(
    @Inject(INJECTION_TOKENS.DEFAULT_ERROR_CODE) private readonly defaultErrorCode: number,
  ) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp(); // 将执行上下文切换到 HTTP 上下文
    const response = ctx.getResponse<Response>(); // 获取 Express 的响应对象
    const request = ctx.getRequest<RequestWithContext>(); // 获取 Express 的请求对象

    const errorPayload = this.resolveErrorPayload(exception);

    this.logServerError(exception, request, errorPayload.status);

    response.status(errorPayload.status).json({
      code: errorPayload.code,
      data: null,
      message: errorPayload.message,
      path: request?.url,
      requestId: request?.requestId,
      timestamp: new Date().toISOString(),
    }); // 返回统一结构
  }

  private resolveErrorPayload(exception: unknown): {
    status: HttpStatus;
    code: number;
    message: string;
  } {
    if (exception instanceof QueryFailedError) {
      return this.resolveQueryFailedError(exception);
    }

    if (exception instanceof AppHttpException) {
      return {
        code: exception.getCode(),
        status: exception.getStatus ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message ?? APP_ERROR_CODES.UNKNOWN_ERROR.message,
      };
    }

    if (exception instanceof HttpException) {
      return {
        code: this.resolveHttpExceptionCode(exception),
        status: exception.getStatus ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message ?? APP_ERROR_CODES.INTERNAL_ERROR.message,
      };
    }

    return {
      code: APP_ERROR_CODES.UNKNOWN_ERROR.code,
      message: APP_ERROR_CODES.UNKNOWN_ERROR.message,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    };
  }

  private resolveHttpExceptionCode(exception: HttpException): number {
    const candidate = exception as HttpException & { getCode?: () => number };
    if (typeof candidate.getCode === 'function') {
      return candidate.getCode();
    }

    return this.defaultErrorCode ?? APP_ERROR_CODES.INTERNAL_ERROR.code;
  }

  private resolveQueryFailedError(exception: QueryFailedError): {
    status: HttpStatus;
    code: number;
    message: string;
  } {
    const driverError = exception.driverError as {
      code?: string;
      errno?: number;
      sqlMessage?: string;
    };

    if (driverError?.code === 'ER_DUP_ENTRY' || driverError?.errno === 1062) {
      return {
        code: APP_ERROR_CODES.DATA_EXISTS.code,
        status: HttpStatus.CONFLICT,
        message: '数据已存在',
      };
    }

    if (driverError?.code === 'ER_NO_SUCH_TABLE' || driverError?.errno === 1146) {
      return {
        code: APP_ERROR_CODES.INTERNAL_ERROR.code,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: '数据库表不存在，请先执行迁移',
      };
    }

    return {
      code: APP_ERROR_CODES.INTERNAL_ERROR.code,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '数据库操作失败',
    };
  }

  private logServerError(
    exception: unknown,
    request: RequestWithContext,
    status: HttpStatus,
  ): void {
    if (status < HttpStatus.INTERNAL_SERVER_ERROR) {
      return;
    }

    this.logger.error(
      `Unhandled exception requestId=${request?.requestId ?? 'unknown'} on ${request?.method ?? 'UNKNOWN'} ${request?.url ?? ''}: ${
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception)
      }`,
    );
  }
}
