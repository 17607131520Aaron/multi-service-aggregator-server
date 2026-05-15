import { AiService } from '@/ai/ai.service';
import { AuthenticatedUser } from '@/auth/auth.service';
import type { RequestWithContext } from '@/common/request-context.middleware';
import { RateLimit } from '@/decorators/rate-limit.decorator';
import { useDto } from '@/decorators/use-dto.decorator';
import {
  WebAiApiKeyConfigRequestDto,
  WebAiApiKeyConfigResponseDto,
  WebAiChatStreamRequestDto,
} from '@/web/dto/ai.dto';
import { Body, Controller, Delete, Get, Post, Put, Req, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';

interface ProtectedAuthenticatedRequest extends RequestWithContext {
  user: AuthenticatedUser;
}

@ApiTags('web/ai')
@ApiBearerAuth()
@Controller('/web/ai')
export class WebAiController {
  constructor(private readonly aiService: AiService) {}

  @Get('api-key-config')
  @ApiOperation({ summary: '获取当前用户的 AI API Key 配置（脱敏）' })
  @ApiOkResponse({ type: WebAiApiKeyConfigResponseDto, description: '获取成功' })
  @useDto(WebAiApiKeyConfigResponseDto)
  public async getApiKeyConfig(
    @Req() request: ProtectedAuthenticatedRequest,
  ): Promise<WebAiApiKeyConfigResponseDto> {
    return this.aiService.getWebAiApiKeyConfig(request.user);
  }

  @Put('api-key-config')
  @ApiOperation({ summary: '保存当前用户的 AI API Key 配置到 Redis' })
  @ApiBody({ type: WebAiApiKeyConfigRequestDto })
  @ApiOkResponse({ type: WebAiApiKeyConfigResponseDto, description: '保存成功' })
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @useDto(WebAiApiKeyConfigResponseDto)
  public async saveApiKeyConfig(
    @Req() request: ProtectedAuthenticatedRequest,
    @Body() body: WebAiApiKeyConfigRequestDto,
  ): Promise<WebAiApiKeyConfigResponseDto> {
    return this.aiService.saveWebAiApiKeyConfig(request.user, body);
  }

  @Delete('api-key-config')
  @ApiOperation({ summary: '删除当前用户的 AI API Key 配置' })
  @ApiOkResponse({ type: WebAiApiKeyConfigResponseDto, description: '删除成功' })
  @useDto(WebAiApiKeyConfigResponseDto)
  public async deleteApiKeyConfig(
    @Req() request: ProtectedAuthenticatedRequest,
  ): Promise<WebAiApiKeyConfigResponseDto> {
    return this.aiService.deleteWebAiApiKeyConfig(request.user);
  }

  @Post('chat/stream')
  @ApiOperation({ summary: 'Web 端 AI 对话流式接口（SSE，需登录且已配置 Redis AI 参数）' })
  @ApiProduces('text/event-stream')
  @ApiBody({ type: WebAiChatStreamRequestDto })
  @RateLimit({ limit: 20, windowMs: 60_000 })
  public async streamChat(
    @Body() body: WebAiChatStreamRequestDto,
    @Req() request: ProtectedAuthenticatedRequest,
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
