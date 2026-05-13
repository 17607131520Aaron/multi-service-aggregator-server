import type { ConfigService } from '@nestjs/config';

export interface SenseNovaConfig {
  apiUrl: string;
  apiToken: string;
  model: string;
  timeoutMs: number;
}

export function getSenseNovaConfig(configService: ConfigService): SenseNovaConfig {
  return {
    apiUrl:
      configService.get<string>('sensenova.apiUrl') ??
      'https://token.sensenova.cn/v1/chat/completions',
    apiToken: configService.get<string>('sensenova.apiToken') ?? '',
    model: configService.get<string>('sensenova.model') ?? 'sensenova-6.7-flash-lite',
    timeoutMs: Number(configService.get<number>('sensenova.timeoutMs') ?? 60_000),
  };
}
