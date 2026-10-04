import type { ServerResponse } from "node:http";

import { Injectable, Logger } from "@nestjs/common";
import { pipeUIMessageStreamToResponse, type UIMessageChunk } from "ai";

import { toAiStreamErrorCode } from "./ai-stream-errors.js";

/**
 * The HTTP side of `POST /ai/chat` (nestjs.md, plan Vấn đề 51): links the
 * response to an abort signal and writes the UI message stream as SSE.
 */
@Injectable()
export class AiStreamResponse {
  private readonly logger = new Logger(AiStreamResponse.name);

  /**
   * Aborts when the client goes away before the response finished (AI-R50).
   * A request's `close` also fires after its body was read, so only the
   * response is watched.
   */
  linkAbort(response: ServerResponse): AbortSignal {
    const controller = new AbortController();
    response.on("close", () => {
      if (!response.writableFinished) {
        controller.abort();
      }
    });
    // The client may have gone before this handler ran; `close` is then past.
    if (response.destroyed && !response.writableFinished) {
      controller.abort();
    }
    return controller.signal;
  }

  /** The `ai` package sets the SSE headers (plan Risk 6). */
  async send(
    response: ServerResponse,
    stream: ReadableStream<UIMessageChunk>,
  ): Promise<void> {
    try {
      await pipeUIMessageStreamToResponse({ response, stream });
    } catch (error: unknown) {
      // Before the headers, ApiExceptionFilter can still answer with a status.
      if (!response.headersSent) {
        throw error;
      }
      this.logger.warn({
        event: "ai.chat.response-failed",
        code: toAiStreamErrorCode(error),
      });
      response.end();
    }
  }
}
