import { Module, type OnModuleInit } from "@nestjs/common";

import { AiCapacity } from "./ai-capacity.js";
import { AiChatService } from "./ai-chat.service.js";
import { AI_PROVIDERS } from "./ai-model.provider.js";
import { AiStreamResponse } from "./ai-stream-response.js";
import { AiController } from "./ai.controller.js";

@Module({
  controllers: [AiController],
  providers: [...AI_PROVIDERS, AiCapacity, AiChatService, AiStreamResponse],
})
export class AiModule implements OnModuleInit {
  // AI-R58: the AI SDK's warning logger may print the model settings.
  onModuleInit(): void {
    globalThis.AI_SDK_LOG_WARNINGS = false;
  }
}
