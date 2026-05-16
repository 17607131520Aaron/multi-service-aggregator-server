import { Injectable } from '@nestjs/common';
import {
  AIMessage,
  BaseMessage,
  countTokensApproximately,
  Document,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  trimMessages,
} from 'langchain';

import { normalizeImageUrlInput } from '@/ai/chat-content.util';
import { AuthenticatedUser } from '@/auth/auth.service';
import {
  WebAiChatContentBlockDto,
  WebAiChatMessageDto,
  WebAiChatMessageRole,
  WebAiChatStreamRequestDto,
} from '@/web/dto/ai.dto';

export interface PreparedAiMessage {
  role: string;
  content?: string | WebAiChatContentBlockDto[];
  toolCallId?: string;
}

export interface PreparedAiContext {
  messages: PreparedAiMessage[];
  historyMessageCount: number;
  contextDocumentCount: number;
}

const SERVER_SYSTEM_PROMPT = [
  '你是一个严谨、直接、对上下文敏感的中文 AI 助手。',
  '回答当前问题前，请优先结合当前对话历史和补充上下文理解用户真实意图。',
  '如果历史信息不足以支撑结论，请明确说出不确定点，不要编造事实。',
  '当用户的问题依赖前文指代、约束、偏好或术语时，优先沿用前文语义。',
].join('\n');

const MAX_CONTEXT_TOKENS = 3_500;
const MAX_CONTEXT_TURNS = 12;
type LangChainContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

@Injectable()
export class LangChainContextService {
  public async prepareMessages(
    dto: WebAiChatStreamRequestDto,
    user: AuthenticatedUser | undefined,
    requestId: string,
  ): Promise<PreparedAiContext> {
    const conversation = dto.messages.map((message) => this.toLangChainMessage(message));
    const systemMessages = conversation.filter((message) => message.type === 'system');
    const nonSystemConversation = conversation.filter((message) => message.type !== 'system');
    const boundedConversation = await trimMessages(nonSystemConversation, {
      maxTokens: MAX_CONTEXT_TOKENS,
      tokenCounter: countTokensApproximately,
      strategy: 'last',
      allowPartial: false,
    });
    const recentConversation = boundedConversation.slice(-MAX_CONTEXT_TURNS);
    const contextDocuments = this.buildContextDocuments(recentConversation, user, requestId);
    const mergedSystemPrompt = this.buildMergedSystemPrompt(systemMessages, contextDocuments);
    const promptMessages: BaseMessage[] = [
      new SystemMessage(mergedSystemPrompt),
      ...recentConversation,
    ];

    return {
      messages: promptMessages.map((message) => this.fromLangChainMessage(message)),
      historyMessageCount: recentConversation.length,
      contextDocumentCount: contextDocuments.length,
    };
  }

  private buildMergedSystemPrompt(messages: BaseMessage[], documents: Document[]): string {
    const upstreamSystemPrompt = messages
      .map((message) => this.stringifyContent(message.content))
      .filter(Boolean)
      .join('\n');

    return [
      SERVER_SYSTEM_PROMPT,
      upstreamSystemPrompt ? `用户补充系统要求：\n${upstreamSystemPrompt}` : '',
      `补充上下文资料如下，可在回答当前问题时按需使用：\n${this.formatDocuments(documents)}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildContextDocuments(
    messages: BaseMessage[],
    user: AuthenticatedUser | undefined,
    requestId: string,
  ): Document[] {
    const documents: Document[] = [
      new Document({
        pageContent: `requestId=${requestId}\nchannel=web/ai/chat/stream`,
        metadata: { source: 'request' },
      }),
    ];

    if (user) {
      documents.push(
        new Document({
          pageContent: [
            `userId=${user.userId}`,
            `username=${user.username ?? ''}`,
            `email=${user.email ?? ''}`,
            `phone=${user.phone ?? ''}`,
          ]
            .filter(Boolean)
            .join('\n'),
          metadata: { source: 'authenticated-user' },
        }),
      );
    }

    const recentTurns = messages
      .filter((message) => message.type !== 'system')
      .slice(-6)
      .map((message, index) => `${index + 1}. ${this.describeMessage(message)}`);

    if (recentTurns.length > 0) {
      documents.push(
        new Document({
          pageContent: recentTurns.join('\n'),
          metadata: { source: 'recent-turns' },
        }),
      );
    }

    return documents;
  }

  private formatDocuments(documents: Document[]): string {
    if (documents.length === 0) {
      return '无额外上下文资料。';
    }

    return documents
      .map((document, index) => {
        const source =
          typeof document.metadata?.source === 'string' ? document.metadata.source : 'context';
        return `[${index + 1}] source=${source}\n${document.pageContent}`;
      })
      .join('\n\n');
  }

  private describeMessage(message: BaseMessage): string {
    const role = this.toApiRole(message.type);
    return `${role}: ${this.stringifyContent(message.content)}`;
  }

  private toLangChainMessage(message: WebAiChatMessageDto): BaseMessage {
    const content = this.toLangChainContent(message.content);

    switch (message.role) {
      case WebAiChatMessageRole.SYSTEM:
        return new SystemMessage({ content });
      case WebAiChatMessageRole.ASSISTANT:
        return new AIMessage({ content });
      case WebAiChatMessageRole.TOOL:
        return new ToolMessage({
          content,
          tool_call_id: message.toolCallId ?? 'tool-call',
        });
      case WebAiChatMessageRole.USER:
      default:
        return new HumanMessage({ content });
    }
  }

  private fromLangChainMessage(message: BaseMessage): PreparedAiMessage {
    return {
      role: this.toApiRole(message.type),
      content: this.toApiContent(message.content),
      ...(message.type === 'tool' && 'tool_call_id' in message
        ? { toolCallId: String(message.tool_call_id) }
        : {}),
    };
  }

  private toApiRole(role: string): string {
    switch (role) {
      case 'human':
        return WebAiChatMessageRole.USER;
      case 'ai':
        return WebAiChatMessageRole.ASSISTANT;
      case 'tool':
        return WebAiChatMessageRole.TOOL;
      case 'system':
      default:
        return WebAiChatMessageRole.SYSTEM;
    }
  }

  private toLangChainContent(
    content: string | WebAiChatContentBlockDto[] | undefined,
  ): string | LangChainContentBlock[] {
    if (Array.isArray(content)) {
      return content.map((block) => {
        if (block.type === 'image_url') {
          const normalizedImageUrl = normalizeImageUrlInput(block.image_url);

          return {
            type: 'image_url',
            image_url: {
              url: normalizedImageUrl?.url ?? '',
            },
          };
        }

        return {
          type: 'text',
          text: block.text ?? '',
        };
      });
    }

    return content ?? '';
  }

  private toApiContent(content: unknown): string | WebAiChatContentBlockDto[] {
    if (Array.isArray(content)) {
      return content.map((block) => {
        const typedBlock = block as { type?: string; text?: string; image_url?: { url?: string } };

        if (typedBlock.type === 'image_url') {
          const normalizedImageUrl = normalizeImageUrlInput(typedBlock.image_url);

          return {
            type: 'image_url',
            image_url: {
              url: normalizedImageUrl?.url ?? '',
            },
          };
        }

        return {
          type: 'text',
          text: typedBlock.text ?? '',
        };
      });
    }

    return typeof content === 'string' ? content : '';
  }

  private stringifyContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((block) => {
          const typedBlock = block as {
            type?: string;
            text?: string;
            image_url?: { url?: string };
          };
          if (typedBlock.type === 'image_url') {
            return `[image] ${typedBlock.image_url?.url ?? ''}`;
          }

          return typedBlock.text ?? '';
        })
        .filter(Boolean)
        .join(' ');
    }

    return '';
  }
}
