import { LangChainContextService } from '@/ai/langchain-context.service';
import { WebAiChatMessageRole } from '@/web/dto/ai.dto';

describe('LangChainContextService', () => {
  const service = new LangChainContextService();

  it('builds prompt messages with server context and recent conversation', async () => {
    const result = await service.prepareMessages(
      {
        messages: [
          { role: WebAiChatMessageRole.USER, content: '我叫小王，正在改 AI 聊天接口。' },
          { role: WebAiChatMessageRole.ASSISTANT, content: '收到，我记住了。' },
          { role: WebAiChatMessageRole.USER, content: '现在帮我看一下超时问题。' },
        ],
      },
      {
        userId: 'u-1',
        username: 'xiaowang',
        email: 'xw@example.com',
        phone: null,
      },
      'req-1',
    );

    expect(result.contextDocumentCount).toBeGreaterThanOrEqual(2);
    expect(result.historyMessageCount).toBeGreaterThan(0);
    expect(result.messages[0]).toMatchObject({ role: 'system' });
    expect(result.messages[1]).toMatchObject({ role: 'user' });
    expect(
      result.messages.some(
        (message) =>
          message.role === 'user' && typeof message.content === 'string' && message.content.includes('超时问题'),
      ),
    ).toBe(true);
  });
});
