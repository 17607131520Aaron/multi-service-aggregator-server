import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import type { RequestWithContext } from '@/common/request-context.middleware';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<
      RequestWithContext & {
        method?: string;
        originalUrl?: string;
        url?: string;
        ip?: string;
      }
    >();
    const response = http.getResponse<{ statusCode?: number }>();
    const startedAt = Date.now();

    return next.handle().pipe(
      finalize(() => {
        const statusCode = response.statusCode ?? 500;
        const level = statusCode >= 400 ? 'error' : 'info';
        this.logRequest(level, request, statusCode, Date.now() - startedAt);
      }),
    );
  }

  private logRequest(
    level: 'info' | 'error',
    request: RequestWithContext & {
      method?: string;
      originalUrl?: string;
      url?: string;
      ip?: string;
    },
    statusCode: number,
    durationMs: number,
  ): void {
    const payload = JSON.stringify({
      event: 'http_request',
      level,
      requestId: request.requestId ?? 'unknown',
      method: request.method ?? 'UNKNOWN',
      path: request.originalUrl ?? request.url ?? '',
      ip: request.ip ?? 'unknown',
      statusCode,
      durationMs,
      timestamp: new Date().toISOString(),
    });

    if (level === 'error') {
      this.logger.error(payload);
      return;
    }

    this.logger.log(payload);
  }
}
