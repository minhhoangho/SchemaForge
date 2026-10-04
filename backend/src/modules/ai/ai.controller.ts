import { Body, Controller, HttpCode, Post, Res } from "@nestjs/common";
import type { Response } from "express";

import {
  type AuthenticatedUser,
  CurrentUser,
} from "../../common/current-user.decorator.js";
import { RateLimit } from "../rate-limit/rate-limit.decorator.js";
import { AiChatService } from "./ai-chat.service.js";
import { AiStreamResponse } from "./ai-stream-response.js";
import { AiChatRequestDto } from "./dto/ai-chat-request.dto.js";

/**
 * Private (AI-R21): no `@Public()`, so the global OriginGuard, JwtAuthGuard
 * and RateLimitGuard run in that order before the handler.
 */
@Controller("ai")
export class AiController {
  constructor(
    private readonly aiChatService: AiChatService,
    private readonly streamResponse: AiStreamResponse,
  ) {}

  @Post("chat")
  @HttpCode(200)
  @RateLimit("ai")
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AiChatRequestDto,
    @Res() response: Response,
  ): Promise<void> {
    const signal = this.streamResponse.linkAbort(response);
    const stream = await this.aiChatService.chat(user.userId, dto, signal);
    await this.streamResponse.send(response, stream);
  }
}
