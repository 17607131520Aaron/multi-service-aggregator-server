import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';

import { AuthenticatedUser } from '@/auth/auth.service';
import { AppBusinessException, AppInternalErrorException } from '@/common/enterprise-exceptions';
import { getSenseNovaConfig } from '@/config/sensenova.config';
import {
  WebAiChatContentBlockDto,
  WebAiChatStreamRequestDto,
} from '@/web/dto/ai.dto';

interface SenseNovaDelta {
  role?: string;
  content?: string | null;
  reasoning_content?: string | null;
  tool_calls?: unknown[];
}

interface SenseNovaChoice {
  index?: number;
  delta?: SenseNovaDelta;
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: unknown[];
  };
  finish_reason?: string | null;
}

interface SenseNovaUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: Record<string, unknown>;
  completion_tokens_details?: Record<string, unknown>;
}

interface SenseNovaStreamPayload {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices?: SenseNovaChoice[];
  usage?: SenseNovaUsage;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly configService: ConfigService) {}

  public async streamWebChat(
    dto: WebAiChatStreamRequestDto,
    user: AuthenticatedUser | undefined,
    response: Response,
    requestId: string,
  ): Promise<void> {
    const config = getSenseNovaConfig(this.configService);

    if (!config.apiToken) {
      throw new AppInternalErrorException('SenseNova API Token 未配置');
    }

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
    this.writeSse(response, 'meta', {
      requestId,
      model: dto.model ?? config.model,
      userId: user?.userId ?? null,
    });

    const upstreamUserId = user?.userId ?? `anonymous:${requestId}`;

    try {
      const upstreamResponse = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiToken}`,
        },
        body: JSON.stringify({
          model: dto.model ?? config.model,
          messages: dto.messages.map((message) => this.toSenseNovaMessage(message)),
          stream: true,
          stream_options: {
            include_usage: true,
          },
          max_tokens: dto.maxTokens ?? 4096,
          temperature: dto.temperature ?? 1,
          top_p: dto.topP ?? 1,
          reasoning_effort: dto.deepThinking ? 'high' : (dto.reasoningEffort ?? 'none'),
          user: upstreamUserId,
        }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(config.timeoutMs)]),
      });

      if (!upstreamResponse.ok || !upstreamResponse.body) {
        const errorText = await upstreamResponse.text();
        throw new AppBusinessException(
          `SenseNova 请求失败: ${upstreamResponse.status} ${errorText || upstreamResponse.statusText}`,
        );
      }

      await this.forwardSenseNovaStream(upstreamResponse.body, response);
    } catch (error) {
      if (controller.signal.aborted && response.writableEnded) {
        return;
      }

      const message =
        error instanceof Error && error.name === 'TimeoutError'
          ? `SenseNova 响应超时（>${config.timeoutMs}ms）`
          : error instanceof Error
            ? error.message
            : 'AI 对话服务暂时不可用';
      this.logger.error(`stream chat failed requestId=${requestId}: ${message}`);

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

  private async forwardSenseNovaStream(
    stream: ReadableStream<Uint8Array>,
    response: Response,
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let lastPayload: SenseNovaStreamPayload | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const segments = buffer.split('\n\n');
      buffer = segments.pop() ?? '';

      for (const segment of segments) {
        const payload = this.extractSseData(segment);
        if (!payload) {
          continue;
        }

        if (payload === '[DONE]') {
          this.writeSse(response, 'done', {
            id: lastPayload?.id ?? null,
            model: lastPayload?.model ?? null,
            usage: lastPayload?.usage ?? null,
          });
          response.end();
          return;
        }

        const parsed = JSON.parse(payload) as SenseNovaStreamPayload;
        if (parsed.error) {
          throw new AppBusinessException(parsed.error.message ?? 'SenseNova 对话失败');
        }

        const choice = parsed.choices?.[0];
        lastPayload = parsed;

        this.writeSse(response, 'chunk', {
          id: parsed.id ?? null,
          model: parsed.model ?? null,
          delta: choice?.delta?.content ?? '',
          reasoning: choice?.delta?.reasoning_content ?? '',
          finishReason: choice?.finish_reason ?? '',
          role: choice?.delta?.role ?? choice?.message?.role ?? 'assistant',
          toolCalls: choice?.delta?.tool_calls ?? choice?.message?.tool_calls ?? null,
          usage: parsed.usage ?? null,
        });
      }
    }

    if (!response.writableEnded) {
      this.writeSse(response, 'done', {
        id: lastPayload?.id ?? null,
        model: lastPayload?.model ?? null,
        usage: lastPayload?.usage ?? null,
      });
      response.end();
    }
  }

  private toSenseNovaMessage(message: {
    role: string;
    content?: string | WebAiChatContentBlockDto[];
    contentBlocks?: WebAiChatContentBlockDto[];
    toolCallId?: string;
  }): Record<string, unknown> {
    const content = Array.isArray(message.content)
      ? message.content.map((block) => this.toSenseNovaContentBlock(block))
      : Array.isArray(message.contentBlocks)
        ? message.contentBlocks.map((block) => this.toSenseNovaContentBlock(block))
        : message.content;

    return {
      role: message.role,
      content,
      ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
    };
  }

  private toSenseNovaContentBlock(block: WebAiChatContentBlockDto): Record<string, unknown> {
    if (block.type === 'image_url') {
      return {
        type: 'image_url',
        image_url: {
          url: block.image_url?.url ?? '',
        },
      };
    }

    return {
      type: 'text',
      text: block.text ?? '',
    };
  }

  private extractSseData(segment: string): string | null {
    const lines = segment
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'));

    if (lines.length === 0) {
      return null;
    }

    return lines.map((line) => line.slice(5).trim()).join('\n');
  }

  private writeSse(response: Response, event: string, data: unknown): void {
    if (response.writableEnded) {
      return;
    }

    response.write(`event: ${event}\n`);
    response.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}
