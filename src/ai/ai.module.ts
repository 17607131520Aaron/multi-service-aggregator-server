import { Module } from '@nestjs/common';

import { LangChainContextService } from '@/ai/langchain-context.service';
import { AiService } from '@/ai/ai.service';
import { WebAiApiKeyConfigCache } from '@/ai/web-ai-api-key-config.cache';
import { RedisModule } from '@/system/redis.module';
import { WebAiController } from '@/web/ai.controller';

@Module({
  imports: [RedisModule],
  controllers: [WebAiController],
  providers: [AiService, LangChainContextService, WebAiApiKeyConfigCache],
  exports: [AiService],
})
export class AiModule {}
