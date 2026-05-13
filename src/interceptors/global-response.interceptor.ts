import { INJECTION_TOKENS } from '@/common/injection-tokens';
import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class GlobalResponseWrapperInterceptor implements NestInterceptor {
  constructor(
    @Inject(INJECTION_TOKENS.DEFAULT_SUCCESS_CODE) private readonly defaultSuccessCode: number,
  ) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        return {
          code: this.defaultSuccessCode ?? 0,
          data: data ?? true,
          message: 'success',
        };
      }),
    );
  }
}
