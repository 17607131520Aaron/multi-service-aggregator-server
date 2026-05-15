import { Injectable } from '@nestjs/common';

export interface StoredWebAiApiKeyConfig {
  requestUrl: string;
  apiKeyToken: string;
  model: string;
  updatedAt: string;
}

type CacheEntry = {
  config: StoredWebAiApiKeyConfig | null;
  expiresAt: number;
};

/** 用户 AI 配置进程内缓存，避免每次对话都访问 Redis */
@Injectable()
export class WebAiApiKeyConfigCache {
  private readonly store = new Map<string, CacheEntry>();
  private readonly ttlMs = 5 * 60 * 1000;

  public get(userId: string): StoredWebAiApiKeyConfig | null | undefined {
    const entry = this.store.get(userId);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(userId);
      return undefined;
    }

    return entry.config;
  }

  public set(userId: string, config: StoredWebAiApiKeyConfig | null): void {
    this.store.set(userId, {
      config,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  public invalidate(userId: string): void {
    this.store.delete(userId);
  }
}
