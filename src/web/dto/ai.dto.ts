import { Type } from 'class-transformer';
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
  Max,
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

  @ApiPropertyOptional({
    description: '指定模型，不传则使用服务端默认模型 sensenova-6.7-flash-lite',
  })
  @IsOptional()
  @IsString()
  public model?: string;

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
