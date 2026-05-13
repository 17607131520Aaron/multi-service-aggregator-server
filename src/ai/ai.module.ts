import { Module } from '@nestjs/common';

import { LangChainContextService } from '@/ai/langchain-context.service';
import { AiService } from '@/ai/ai.service';
import { WebAiController } from '@/web/ai.controller';

@Module({
  controllers: [WebAiController],
  providers: [AiService, LangChainContextService],
  exports: [AiService],
})
export class AiModule {}
