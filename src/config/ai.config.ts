import type { ConfigService } from '@nestjs/config';

export interface AiStreamConfig {
  streamTimeoutMs: number;
}

export function getAiStreamConfig(configService: ConfigService): AiStreamConfig {
  return {
    streamTimeoutMs: Number(configService.get<number>('ai.streamTimeoutMs') ?? 60_000),
  };
}
