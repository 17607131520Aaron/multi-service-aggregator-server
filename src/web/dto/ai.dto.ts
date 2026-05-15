import { Type } from 'class-transformer';
import { Exclude, Expose } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export enum WebAiChatMessageRole {
  SYSTEM = 'system',
  USER = 'user',
  ASSISTANT = 'assistant',
  TOOL = 'tool',
}

export class WebAiImageUrlDto {
  @ApiProperty({ description: '图片 URL' })
  @IsString()
  public url: string;
}

export class WebAiChatContentBlockDto {
  @ApiProperty({ enum: ['text', 'image_url'], description: '内容块类型' })
  @IsIn(['text', 'image_url'])
  public type: 'text' | 'image_url';

  @ApiPropertyOptional({ description: '文本内容，仅 type=text 时需要' })
  @ValidateIf((block: WebAiChatContentBlockDto) => block.type === 'text')
  @IsString()
  public text?: string;

  @ApiPropertyOptional({
    type: WebAiImageUrlDto,
    description: '图片地址，仅 type=image_url 时需要',
  })
  @ValidateIf((block: WebAiChatContentBlockDto) => block.type === 'image_url')
  @IsObject()
  @ValidateNested()
  @Type(() => WebAiImageUrlDto)
  public image_url?: WebAiImageUrlDto;
}

export class WebAiChatMessageDto {
  @ApiProperty({ enum: WebAiChatMessageRole, description: '消息角色' })
  @IsEnum(WebAiChatMessageRole)
  public role: WebAiChatMessageRole;

  @ApiPropertyOptional({ description: '消息内容，可为纯文本或多模态内容块数组' })
  @IsOptional()
  public content?: string | WebAiChatContentBlockDto[];

  @ApiPropertyOptional({ description: '工具调用结果关联 ID，仅 role=tool 时需要' })
  @IsOptional()
  @IsString()
  public toolCallId?: string;
}

export class WebAiChatStreamRequestDto {
  @ApiProperty({
    type: [WebAiChatMessageDto],
    description: '对话消息列表，支持纯文本和图像输入',
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WebAiChatMessageDto)
  public messages: WebAiChatMessageDto[];

  @ApiPropertyOptional({ description: '最大输出 token 数', default: 4096 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65536)
  public maxTokens?: number;

  @ApiPropertyOptional({ description: '温度参数', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  public temperature?: number;

  @ApiPropertyOptional({ description: 'top_p 参数', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(1)
  public topP?: number;

  @ApiPropertyOptional({
    description: '推理力度，可选 low / medium / high / none',
    default: 'none',
  })
  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'none'])
  public reasoningEffort?: 'low' | 'medium' | 'high' | 'none';

  @ApiPropertyOptional({
    description: '是否开启深度思考，传 true 时优先使用高推理力度',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  public deepThinking?: boolean;
}

export class WebAiApiKeyConfigRequestDto {
  @ApiProperty({
    description: '自定义 AI 请求 URL，需为 HTTP/HTTPS 绝对地址',
    example: 'https://api.openai.com/v1/chat/completions',
  })
  @IsUrl(
    {
      require_protocol: true,
      protocols: ['http', 'https'],
      require_tld: false,
    },
    { message: '请求 URL 必须是有效的 HTTP/HTTPS 地址' },
  )
  @MaxLength(2048, { message: '请求 URL 长度不能超过 2048 个字符' })
  public requestUrl: string;

  @ApiPropertyOptional({
    description: '自定义 AI API Key Token；留空则保留已保存的 Token',
    example: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4096, { message: 'API Key Token 长度不能超过 4096 个字符' })
  public apiKeyToken?: string;

  @ApiPropertyOptional({
    description: '模型名称；留空则保留已保存的模型',
    example: 'gpt-4o-mini',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128, { message: '模型名称长度不能超过 128 个字符' })
  public model?: string;
}

@Exclude()
export class WebAiApiKeyConfigResponseDto {
  @ApiProperty({
    description: '自定义 AI 请求 URL，未配置时为空字符串',
    example: 'https://api.openai.com/v1/chat/completions',
  })
  @Expose()
  public requestUrl: string;

  @ApiProperty({
    description: '模型名称，未配置时为空字符串',
    example: 'gpt-4o-mini',
  })
  @Expose()
  public model: string;

  @ApiProperty({ description: '当前用户是否已配置 API Key Token', example: true })
  @Expose()
  public hasApiKeyToken: boolean;

  @ApiProperty({
    description: '脱敏后的 API Key Token，未配置时为空字符串',
    example: 'sk-****abcd',
  })
  @Expose()
  public apiKeyTokenMasked: string;

  @ApiProperty({
    description: '配置更新时间，未配置时为 null',
    example: '2026-05-15T12:00:00.000Z',
    nullable: true,
  })
  @Expose()
  public updatedAt: string | null;
}
