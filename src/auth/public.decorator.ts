import { METADATA_KEYS } from '@/common/metadata-keys';
import { SetMetadata } from '@nestjs/common';

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(METADATA_KEYS.PUBLIC_ROUTE, true);
