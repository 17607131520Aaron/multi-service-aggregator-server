import { WebAiApiKeyConfigCache } from '@/ai/web-ai-api-key-config.cache';

describe('WebAiApiKeyConfigCache', () => {
  it('returns cached config before ttl expires', () => {
    const cache = new WebAiApiKeyConfigCache();
    const config = {
      requestUrl: 'https://api.example.com/v1/chat/completions',
      apiKeyToken: 'sk-test',
      model: 'gpt-4o-mini',
      updatedAt: '2026-05-15T12:00:00.000Z',
    };

    cache.set('1', config);

    expect(cache.get('1')).toEqual(config);
  });

  it('invalidates cached config', () => {
    const cache = new WebAiApiKeyConfigCache();

    cache.set('1', {
      requestUrl: 'https://api.example.com/v1/chat/completions',
      apiKeyToken: 'sk-test',
      model: 'gpt-4o-mini',
      updatedAt: '2026-05-15T12:00:00.000Z',
    });
    cache.invalidate('1');

    expect(cache.get('1')).toBeUndefined();
  });
});
