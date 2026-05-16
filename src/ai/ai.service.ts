import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import type Redis from 'ioredis';

import type { UploadedAiFile } from '@/ai/ai-upload.types';
import { AiFileStorageService } from '@/ai/ai-file-storage.service';
import {
  buildDataImageUrl,
  isBlobImageUrl,
  isDataImageUrl,
  normalizeImageUrlInput,
  parseStoredAiFileNameFromUrl,
  resolveUploadedImageMimeType,
} from '@/ai/chat-content.util';
import { LangChainContextService } from '@/ai/langchain-context.service';
import {
  StoredWebAiApiKeyConfig,
  WebAiApiKeyConfigCache,
} from '@/ai/web-ai-api-key-config.cache';
import {
  extractStreamError,
  normalizeUpstreamChunk,
  parseSseSegment,
  shouldEmitUpstreamChunk,
} from '@/ai/upstream-stream.parser';
import { AuthenticatedUser } from '@/auth/auth.service';
import {
  AppBusinessException,
  AppInternalErrorException,
  AppNotFoundException,
} from '@/common/enterprise-exceptions';
import { INJECTION_TOKENS } from '@/common/injection-tokens';
import { getAiStreamConfig, getAiUploadConfig } from '@/config/ai.config';
import {
  WebAiApiKeyConfigRequestDto,
  WebAiApiKeyConfigResponseDto,
  WebAiChatContentBlockDto,
  WebAiChatStreamRequestDto,
  WebAiFileUploadResponseDto,
} from '@/web/dto/ai.dto';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly aiFileStorageService: AiFileStorageService,
    private readonly langChainContextService: LangChainContextService,
    private readonly webAiApiKeyConfigCache: WebAiApiKeyConfigCache,
    @Optional()
    @Inject(INJECTION_TOKENS.REDIS_SERVICE)
    private readonly redisClient: Redis | null,
  ) {}

  public async getWebAiApiKeyConfig(
    user: AuthenticatedUser,
  ): Promise<WebAiApiKeyConfigResponseDto> {
    await this.ensureRedisReady();

    const storedConfig = await this.resolveWebAiApiKeyConfig(user.userId, true);
    return this.toWebAiApiKeyConfigResponse(storedConfig);
  }

  public async saveWebAiApiKeyConfig(
    user: AuthenticatedUser,
    dto: WebAiApiKeyConfigRequestDto,
  ): Promise<WebAiApiKeyConfigResponseDto> {
    await this.ensureRedisReady();

    const existingConfig = await this.resolveWebAiApiKeyConfig(user.userId, true);
    const apiKeyToken = dto.apiKeyToken?.trim() || existingConfig?.apiKeyToken || '';

    if (!apiKeyToken) {
      throw new AppBusinessException('API Key Token 不能为空');
    }

    const model = dto.model?.trim() || existingConfig?.model || '';

    if (!model) {
      throw new AppBusinessException('模型名称不能为空');
    }

    const storedConfig: StoredWebAiApiKeyConfig = {
      requestUrl: dto.requestUrl.trim(),
      apiKeyToken,
      model,
      updatedAt: new Date().toISOString(),
    };

    await this.redisClient!.set(this.buildWebAiApiKeyConfigKey(user.userId), JSON.stringify(storedConfig));
    this.webAiApiKeyConfigCache.set(user.userId, storedConfig);

    return this.toWebAiApiKeyConfigResponse(storedConfig);
  }

  public async deleteWebAiApiKeyConfig(
    user: AuthenticatedUser,
  ): Promise<WebAiApiKeyConfigResponseDto> {
    await this.ensureRedisReady();

    await this.redisClient!.del(this.buildWebAiApiKeyConfigKey(user.userId));
    this.webAiApiKeyConfigCache.set(user.userId, null);

    return this.toWebAiApiKeyConfigResponse(null);
  }

  public async uploadWebAiFile(
    file: UploadedAiFile | undefined,
    origin: string,
  ): Promise<WebAiFileUploadResponseDto> {
    if (!file) {
      throw new AppBusinessException('请上传文件');
    }

    const uploadConfig = getAiUploadConfig(this.configService);

    if (file.size > uploadConfig.maxFileSizeBytes) {
      throw new AppBusinessException(
        `文件大小不能超过 ${Math.floor(uploadConfig.maxFileSizeBytes / (1024 * 1024))}MB`,
      );
    }

    const mimeType = resolveUploadedImageMimeType(file.buffer, file.mimetype);

    if (!mimeType || !uploadConfig.allowedMimeTypes.includes(mimeType)) {
      throw new AppBusinessException('仅支持上传 PNG、JPEG、WebP 或 GIF 图片');
    }

    const storedName = await this.aiFileStorageService.saveImage(file.buffer, mimeType);
    const pathPrefix = this.aiFileStorageService.resolvePublicPathPrefix();

    return {
      url: this.aiFileStorageService.buildPublicFileUrl(origin, pathPrefix, storedName),
      filename: file.originalname || storedName,
      mimeType,
      size: file.size,
    };
  }

  public async readWebAiFile(
    storedName: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    try {
      return await this.aiFileStorageService.readImage(storedName);
    } catch {
      throw new AppNotFoundException('文件不存在');
    }
  }

  public async streamWebChat(
    dto: WebAiChatStreamRequestDto,
    user: AuthenticatedUser,
    response: Response,
    requestId: string,
  ): Promise<void> {
    await this.ensureRedisReady();
    const userConfig = await this.resolveWebAiApiKeyConfig(user.userId);

    if (!userConfig) {
      throw new AppBusinessException('请先在设置中配置 AI 请求 URL、API Key 和模型');
    }

    await this.streamCustomWebChat(dto, user, response, requestId, userConfig);
  }

  private async streamCustomWebChat(
    dto: WebAiChatStreamRequestDto,
    user: AuthenticatedUser,
    response: Response,
    requestId: string,
    customConfig: StoredWebAiApiKeyConfig,
  ): Promise<void> {
    if (!customConfig.requestUrl || !customConfig.apiKeyToken || !customConfig.model) {
      throw new AppBusinessException('请先在设置中配置完整的 AI 请求 URL、API Key 和模型');
    }

    const { streamTimeoutMs } = getAiStreamConfig(this.configService);
    const controller = new AbortController();
    let closed = false;

    const closeStream = (): void => {
      if (closed) {
        return;
      }

      closed = true;
      controller.abort();
    };

    response.on('close', closeStream);
    response.on('finish', closeStream);

    this.setupSseHeaders(response, requestId);
    const preparedContext = await this.langChainContextService.prepareMessages(dto, user, requestId);

    this.writeSse(response, 'meta', {
      requestId,
      model: customConfig.model,
      userId: user.userId,
      contextStrategy: 'langchain',
      provider: 'custom',
      historyMessageCount: preparedContext.historyMessageCount,
      contextDocumentCount: preparedContext.contextDocumentCount,
    });

    const upstreamUserId = user.userId;

    try {
      const upstreamResponse = await fetch(customConfig.requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customConfig.apiKeyToken}`,
        },
        body: JSON.stringify({
          model: customConfig.model,
          messages: await Promise.all(
            preparedContext.messages.map((message) => this.toUpstreamChatMessage(message)),
          ),
          stream: true,
          max_tokens: dto.maxTokens ?? 4096,
          temperature: dto.temperature ?? 1,
          top_p: dto.topP ?? 1,
          reasoning_effort: dto.deepThinking ? 'high' : (dto.reasoningEffort ?? 'none'),
          user: upstreamUserId,
        }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(streamTimeoutMs)]),
      });

      if (!upstreamResponse.ok || !upstreamResponse.body) {
        const errorText = await upstreamResponse.text();
        throw new AppBusinessException(
          `自定义 AI 请求失败: ${upstreamResponse.status} ${errorText || upstreamResponse.statusText}`,
        );
      }

      await this.forwardUpstreamSseStream(upstreamResponse.body, response);
    } catch (error) {
      if (controller.signal.aborted && response.writableEnded) {
        return;
      }

      const message =
        error instanceof Error && error.name === 'TimeoutError'
          ? `自定义 AI 响应超时（>${streamTimeoutMs}ms）`
          : error instanceof Error
            ? error.message
            : 'AI 对话服务暂时不可用';
      this.logger.error(`custom stream chat failed requestId=${requestId}: ${message}`);

      if (!response.writableEnded) {
        this.writeSse(response, 'error', { message });
        response.end();
      }
    } finally {
      response.off('close', closeStream);
      response.off('finish', closeStream);
    }
  }

  private setupSseHeaders(response: Response, requestId: string): void {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.setHeader('x-request-id', requestId);
    response.flushHeaders();
  }

  private async forwardUpstreamSseStream(
    stream: ReadableStream<Uint8Array>,
    response: Response,
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lastChunk: ReturnType<typeof normalizeUpstreamChunk> | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const segments = buffer.split(/\r?\n\r?\n/);
      buffer = segments.pop() ?? '';

      for (const segment of segments) {
        const parsedSegment = parseSseSegment(segment);
        if (!parsedSegment) {
          continue;
        }

        const { event, data } = parsedSegment;

        if (data === '[DONE]') {
          this.writeSse(response, 'done', {
            id: lastChunk?.id ?? null,
            model: lastChunk?.model ?? null,
            usage: lastChunk?.usage ?? null,
          });
          response.end();
          return;
        }

        let payload: unknown;
        try {
          payload = JSON.parse(data);
        } catch {
          continue;
        }

        const streamError = extractStreamError(payload);
        if (streamError) {
          throw new AppBusinessException(streamError);
        }

        if (!shouldEmitUpstreamChunk(event, payload)) {
          continue;
        }

        const normalized = normalizeUpstreamChunk(payload);
        lastChunk = normalized;

        if (!normalized.delta && !normalized.reasoning) {
          continue;
        }

        this.writeSse(response, 'chunk', {
          id: normalized.id,
          model: normalized.model,
          delta: normalized.delta,
          reasoning: normalized.reasoning,
          finishReason: normalized.finishReason,
          role: normalized.role,
          usage: normalized.usage,
        });
      }
    }

    if (!response.writableEnded) {
      this.writeSse(response, 'done', {
        id: lastChunk?.id ?? null,
        model: lastChunk?.model ?? null,
        usage: lastChunk?.usage ?? null,
      });
      response.end();
    }
  }

  private async toUpstreamChatMessage(message: {
    role: string;
    content?: string | WebAiChatContentBlockDto[];
    contentBlocks?: WebAiChatContentBlockDto[];
    toolCallId?: string;
  }): Promise<Record<string, unknown>> {
    const content = Array.isArray(message.content)
      ? await Promise.all(message.content.map((block) => this.toUpstreamContentBlock(block)))
      : Array.isArray(message.contentBlocks)
        ? await Promise.all(
            message.contentBlocks.map((block) => this.toUpstreamContentBlock(block)),
          )
        : message.content;

    return {
      role: message.role,
      content,
      ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
    };
  }

  private async toUpstreamContentBlock(
    block: WebAiChatContentBlockDto,
  ): Promise<Record<string, unknown>> {
    if (block.type === 'image_url') {
      const normalizedImageUrl = normalizeImageUrlInput(block.image_url);
      const resolvedUrl = await this.resolveUpstreamImageUrl(normalizedImageUrl?.url ?? '');

      return {
        type: 'image_url',
        image_url: {
          url: resolvedUrl,
        },
      };
    }

    return {
      type: 'text',
      text: block.text ?? '',
    };
  }

  private async resolveUpstreamImageUrl(url: string): Promise<string> {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      throw new AppBusinessException('图片地址不能为空，请使用 /api/web/ai/files 上传后传入 url');
    }

    if (isBlobImageUrl(trimmedUrl)) {
      throw new AppBusinessException(
        '浏览器 blob 图片无法被 AI 服务读取，请先调用 /api/web/ai/files 上传图片，再在消息中使用返回的 url',
      );
    }

    if (isDataImageUrl(trimmedUrl)) {
      return trimmedUrl;
    }

    const storedName = parseStoredAiFileNameFromUrl(trimmedUrl);

    if (storedName) {
      const { buffer, mimeType } = await this.readWebAiFile(storedName);

      return buildDataImageUrl(buffer, mimeType);
    }

    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }

    throw new AppBusinessException('图片地址格式无效，请使用已上传图片 url 或公网可访问的 http(s) 地址');
  }

  private writeSse(response: Response, event: string, data: unknown): void {
    if (response.writableEnded) {
      return;
    }

    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  private async resolveWebAiApiKeyConfig(
    userId: string,
    forceRefresh = false,
  ): Promise<StoredWebAiApiKeyConfig | null> {
    if (!forceRefresh) {
      const cached = this.webAiApiKeyConfigCache.get(userId);

      if (cached !== undefined) {
        return cached;
      }
    }

    const config = await this.loadWebAiApiKeyConfigFromRedis(userId);
    this.webAiApiKeyConfigCache.set(userId, config);

    return config;
  }

  private async loadWebAiApiKeyConfigFromRedis(
    userId: string,
  ): Promise<StoredWebAiApiKeyConfig | null> {
    const rawConfig = await this.redisClient!.get(this.buildWebAiApiKeyConfigKey(userId));

    if (!rawConfig) {
      return null;
    }

    try {
      const parsedConfig = JSON.parse(rawConfig) as Partial<StoredWebAiApiKeyConfig>;

      if (
        typeof parsedConfig.requestUrl !== 'string' ||
        typeof parsedConfig.apiKeyToken !== 'string' ||
        typeof parsedConfig.model !== 'string' ||
        !parsedConfig.requestUrl.trim() ||
        !parsedConfig.apiKeyToken.trim() ||
        !parsedConfig.model.trim()
      ) {
        return null;
      }

      return {
        requestUrl: parsedConfig.requestUrl.trim(),
        apiKeyToken: parsedConfig.apiKeyToken.trim(),
        model: parsedConfig.model.trim(),
        updatedAt:
          typeof parsedConfig.updatedAt === 'string'
            ? parsedConfig.updatedAt
            : new Date(0).toISOString(),
      };
    } catch {
      return null;
    }
  }

  private toWebAiApiKeyConfigResponse(
    config: StoredWebAiApiKeyConfig | null,
  ): WebAiApiKeyConfigResponseDto {
    return {
      requestUrl: config?.requestUrl ?? '',
      model: config?.model ?? '',
      hasApiKeyToken: Boolean(config?.apiKeyToken),
      apiKeyTokenMasked: config?.apiKeyToken ? this.maskApiKeyToken(config.apiKeyToken) : '',
      updatedAt: config?.updatedAt ?? null,
    };
  }

  private maskApiKeyToken(apiKeyToken: string): string {
    if (apiKeyToken.length <= 8) {
      return `${apiKeyToken.slice(0, 2)}****${apiKeyToken.slice(-2)}`;
    }

    return `${apiKeyToken.slice(0, 4)}****${apiKeyToken.slice(-4)}`;
  }

  private buildWebAiApiKeyConfigKey(userId: string): string {
    return `web:ai:api-key-config:${userId}`;
  }

  private async ensureRedisReady(): Promise<void> {
    if (!this.redisClient) {
      throw new AppInternalErrorException('redis 未启用，无法保存 AI API Key 配置');
    }

    if (this.redisClient.status === 'wait') {
      await this.redisClient.connect();
    }
  }
}
