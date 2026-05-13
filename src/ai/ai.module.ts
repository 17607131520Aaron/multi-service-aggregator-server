import { Module } from '@nestjs/common';

import { AiService } from '@/ai/ai.service';
import { WebAiController } from '@/web/ai.controller';

@Module({
  controllers: [WebAiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
