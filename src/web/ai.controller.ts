import { AiService } from '@/ai/ai.service';
import { AuthenticatedUser } from '@/auth/auth.service';
import { Public } from '@/auth/public.decorator';
import type { RequestWithContext } from '@/common/request-context.middleware';
import { RateLimit } from '@/decorators/rate-limit.decorator';
import { WebAiChatStreamRequestDto } from '@/web/dto/ai.dto';
import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';

interface AuthenticatedRequest extends RequestWithContext {
  user?: AuthenticatedUser;
}

@ApiTags('web/ai')
@Controller('/web/ai')
export class WebAiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat/stream')
  @Public()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Web 端 AI 对话流式接口（SSE）' })
  @ApiProduces('text/event-stream')
  @ApiBody({ type: WebAiChatStreamRequestDto })
  @RateLimit({ limit: 20, windowMs: 60_000 })
  public async streamChat(
    @Body() body: WebAiChatStreamRequestDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.aiService.streamWebChat(
      body,
      request.user,
      response,
      request.requestId ?? 'unknown',
    );
  }
}
