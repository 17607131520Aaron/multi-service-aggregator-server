import { SetMetadata } from '@nestjs/common';

import { METADATA_KEYS } from '@/common/metadata-keys';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export const RateLimit = (options: RateLimitOptions): ReturnType<typeof SetMetadata> =>
  SetMetadata(METADATA_KEYS.RATE_LIMIT, options);
