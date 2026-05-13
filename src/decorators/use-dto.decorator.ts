import type { ClassConstructor } from 'class-transformer';
import 'reflect-metadata';

import { METADATA_KEYS } from '@/common/metadata-keys';

export function useDto<T>(
  dto: ClassConstructor<T>,
): (target: Object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => void {
  return function (
    _target: Object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): void {
    Reflect.defineMetadata(METADATA_KEYS.DTO, dto, descriptor.value as unknown as object);
  };
}
