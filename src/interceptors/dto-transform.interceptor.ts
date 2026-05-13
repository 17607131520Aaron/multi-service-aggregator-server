/**
 * DTO 转换拦截器
 *
 * 全局的返回结果 DTO 映射能力：
 * - 当路由处理器方法使用 UseDto 指定 DTO 时，返回数据将映射为该 DTO。
 * - 如果没有路由级 DTO，且配置了 DEFAULT_DTO，则返回数据将映射为 DEFAULT_DTO。
 * - 如果两者都未配置，返回数据保持原样。
 *
 * 说明：使用 class-transformer 的 plainToInstance，将对象转换为 DTO，并通过 excludeExtraneousValues 只暴露 DTO 字段。
 */
import { INJECTION_TOKENS } from '@/common/injection-tokens';
import { METADATA_KEYS } from '@/common/metadata-keys';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ClassConstructor } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

type DataDict = Record<string, unknown>;

@Injectable()
export class DtoTransformInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(INJECTION_TOKENS.DEFAULT_DTO)
    private readonly defaultDto?: ClassConstructor<object>,
  ) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Record<string, unknown>> {
    // 尝试从路由处理器的元数据中获取 DTO 类型
    const dto = this.reflector.get<ClassConstructor<object>>(
      METADATA_KEYS.DTO,
      context.getHandler(),
    );
    if (dto) {
      const dtoClass: ClassConstructor<object> = dto as ClassConstructor<object>;
      const source$ = next.handle() as Observable<DataDict>;
      return source$.pipe(
        map((data: DataDict) => {
          const inst = plainToInstance(dtoClass, data, { excludeExtraneousValues: true });
          // 将实例转换为普通对象，只暴露 DTO 字段
          return inst as unknown as Record<string, unknown>;
        }),
      ) as Observable<Record<string, unknown>>;
    }
    // 如果没有路由指定的 DTO，且配置了 DEFAULT_DTO，则映射为默认 DTO
    if (this.defaultDto) {
      const defaultClass: ClassConstructor<object> = this.defaultDto as ClassConstructor<object>;
      const source$ = next.handle() as Observable<DataDict>;
      return source$.pipe(
        map((data: DataDict) => {
          const inst = plainToInstance(defaultClass, data, { excludeExtraneousValues: true });
          return inst as unknown as Record<string, unknown>;
        }),
      ) as Observable<Record<string, unknown>>;
    }
    // 没有配置 DTO，原样返回
    return next.handle();
  }
}
