import type { UploadedAiFile } from '@/ai/ai-upload.types';
import { AiService } from '@/ai/ai.service';
import { AuthenticatedUser } from '@/auth/auth.service';
import { Public } from '@/auth/public.decorator';
import type { RequestWithContext } from '@/common/request-context.middleware';
import { RateLimit } from '@/decorators/rate-limit.decorator';
import { useDto } from '@/decorators/use-dto.decorator';
import {
  WebAiApiKeyConfigRequestDto,
  WebAiApiKeyConfigResponseDto,
  WebAiChatStreamRequestDto,
  WebAiFileUploadResponseDto,
} from '@/web/dto/ai.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
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

  @Post('files')
  @ApiOperation({ summary: '上传 AI 对话图片（multipart/form-data，字段名 file）' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '图片文件，支持 PNG / JPEG / WebP / GIF',
        },
      },
    },
  })
  @ApiOkResponse({ type: WebAiFileUploadResponseDto, description: '上传成功' })
  @RateLimit({ limit: 30, windowMs: 60_000 })
  @useDto(WebAiFileUploadResponseDto)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  public async uploadFile(
    @UploadedFile() file: UploadedAiFile | undefined,
    @Req() request: ProtectedAuthenticatedRequest,
  ): Promise<WebAiFileUploadResponseDto> {
    const origin = this.resolveRequestOrigin(request);

    return this.aiService.uploadWebAiFile(file, origin);
  }

  @Public()
  @Get('files/:storedName')
  @ApiOperation({ summary: '访问已上传的 AI 图片' })
  public async getFile(
    @Param('storedName') storedName: string,
    @Res() response: Response,
  ): Promise<void> {
    const { buffer, mimeType } = await this.aiService.readWebAiFile(storedName);

    response.setHeader('Content-Type', mimeType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.send(buffer);
  }

  private resolveRequestOrigin(request: ProtectedAuthenticatedRequest): string {
    const forwardedProto = request.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : (forwardedProto?.split(',')[0] ?? request.protocol);
    const host = request.get('host');

    return `${protocol}://${host}`;
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
