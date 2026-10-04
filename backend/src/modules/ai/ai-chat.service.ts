import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  API_ERROR_STATUS,
  type AiChatRequest,
  type SimpleApiErrorCode,
} from "@schemaforge/api-contract";
import {
  type GenerateId,
  parseSchemaDocument,
  type SchemaDocument,
} from "@schemaforge/core";
import {
  APICallError,
  createUIMessageStream,
  type LanguageModel,
  type ModelMessage,
  type UIMessageChunk,
  type UIMessageStreamWriter,
} from "ai";

import { ApiException } from "../../common/api.exception.js";
import { Clock } from "../../common/clock.js";
import { MAX_DOCUMENT_ERRORS } from "../schemas/schemas.service.js";
import { AI_BUSY_RETRY_AFTER_SECONDS } from "./ai.constants.js";
import { AiCapacity } from "./ai-capacity.js";
import { type AiTurnReport, runAiTurn } from "./ai-chat-turn.js";
import { AI_GENERATE_ID, AI_LANGUAGE_MODEL } from "./ai-model.provider.js";
import {
  AiHistoryTooLargeError,
  AiPromptTooLargeError,
  buildAiMessages,
} from "./ai-prompt.js";
import { toAiStreamErrorCode } from "./ai-stream-errors.js";
import { type AiTurnState, createAiTurnState } from "./ai-tools.js";

type AiTurn = {
  readonly userId: string;
  readonly model: LanguageModel;
  readonly document: SchemaDocument;
  readonly messages: readonly ModelMessage[];
  readonly abortSignal: AbortSignal;
  readonly release: () => void;
};

function apiError(code: SimpleApiErrorCode): ApiException {
  return new ApiException({ statusCode: API_ERROR_STATUS[code], code });
}

function createClosedStream(): ReadableStream<UIMessageChunk> {
  return new ReadableStream({
    start(controller) {
      controller.close();
    },
  });
}

function parseDocument(document: unknown): SchemaDocument {
  const parsed = parseSchemaDocument(document);
  if (!parsed.isOk) {
    throw new ApiException({
      statusCode: API_ERROR_STATUS["document-invalid"],
      code: "document-invalid",
      documentErrors: parsed.error.slice(0, MAX_DOCUMENT_ERRORS),
    });
  }
  return parsed.value;
}

// Both size errors carry fixed messages; they become codes before the stream.
function buildMessages(
  document: SchemaDocument,
  request: AiChatRequest,
): ModelMessage[] {
  try {
    return buildAiMessages({
      document,
      messages: request.messages,
      locale: request.locale,
    });
  } catch (error: unknown) {
    if (error instanceof AiPromptTooLargeError) {
      throw apiError("ai-schema-too-large");
    }
    if (error instanceof AiHistoryTooLargeError) {
      throw apiError("payload-too-large");
    }
    throw error;
  }
}

/**
 * `POST /ai/chat` (AI-R21 to AI-R24): every check that can answer with an
 * HTTP error runs before the stream starts, in the order of plan Vấn đề 44.
 */
@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    @Inject(AI_LANGUAGE_MODEL) private readonly model: LanguageModel | null,
    @Inject(AI_GENERATE_ID) private readonly generateId: GenerateId,
    private readonly capacity: AiCapacity,
    private readonly clock: Clock,
  ) {}

  async chat(
    userId: string,
    request: AiChatRequest,
    abortSignal: AbortSignal,
  ): Promise<ReadableStream<UIMessageChunk>> {
    const model = this.model;
    if (model === null) {
      throw apiError("ai-unavailable");
    }
    // Nobody reads the answer of a request closed before the handler ran, so
    // it takes no lock and spends no budget. No await runs between this check
    // and the abort listener below, so a later close is always seen.
    if (abortSignal.aborted) {
      return createClosedStream();
    }
    const release = this.capacity.tryAcquireStream(userId);
    if (release === null) {
      throw new ApiException(
        {
          statusCode: API_ERROR_STATUS["too-many-requests"],
          code: "too-many-requests",
        },
        { retryAfterSeconds: AI_BUSY_RETRY_AFTER_SECONDS },
      );
    }
    // A closed response frees the lock at once (AI-R50, AI-R56); the release
    // is single-use, so the turn's own finally cannot free a newer lock.
    abortSignal.addEventListener("abort", release, { once: true });
    try {
      const document = parseDocument(request.document);
      const messages = buildMessages(document, request);
      const budget = await this.capacity.tryConsumeGlobalBudget();
      if (!budget.isAllowed) {
        throw new ApiException(
          {
            statusCode: API_ERROR_STATUS["ai-unavailable"],
            code: "ai-unavailable",
          },
          { retryAfterSeconds: budget.retryAfterSeconds },
        );
      }
      const turn = { userId, model, document, messages, abortSignal, release };
      return createUIMessageStream({
        execute: ({ writer }) => this.runTurn(turn, writer),
        onError: toAiStreamErrorCode,
      });
    } catch (error: unknown) {
      release();
      throw error;
    }
  }

  // An error thrown here reaches the client as the stream's last chunk
  // through the onError of createUIMessageStream (plan Vấn đề 7).
  private async runTurn(
    turn: AiTurn,
    writer: UIMessageStreamWriter,
  ): Promise<void> {
    const startedAt = this.clock.now().getTime();
    const state = createAiTurnState(turn.document);
    const report: AiTurnReport = { outcome: "error" };
    try {
      await runAiTurn({
        model: turn.model,
        messages: turn.messages,
        abortSignal: turn.abortSignal,
        state,
        generateId: this.generateId,
        writer,
        report,
        onStreamError: (error) => {
          this.logStreamError(error);
        },
        onTurnInvalid: (reason) => {
          this.logger.error({
            event: "ai.chat.turn-invalid",
            userId: turn.userId,
            reason,
          });
        },
      });
    } catch (error: unknown) {
      report.outcome = "error";
      report.errorCode = toAiStreamErrorCode(error);
      throw error;
    } finally {
      turn.release();
      this.logTurn(turn.userId, state, report, startedAt);
    }
  }

  // AI-R58: an APICallError carries the whole prompt in requestBodyValues, so
  // only the class name, status and mapped code are logged.
  private logStreamError(error: unknown): void {
    this.logger.warn({
      event: "ai.chat.stream-error",
      code: toAiStreamErrorCode(error),
      errorName: error instanceof Error ? error.name : typeof error,
      statusCode: APICallError.isInstance(error) ? error.statusCode : undefined,
    });
  }

  // AI-R31: one line per turn, ids and counts only.
  private logTurn(
    userId: string,
    state: AiTurnState,
    report: AiTurnReport,
    startedAt: number,
  ): void {
    const isFailed = report.outcome === "error";
    const line = {
      event: isFailed ? "ai.chat.failed" : "ai.chat.completed",
      userId,
      durationMs: this.clock.now().getTime() - startedAt,
      stepCount: report.stepCount,
      toolCallCount: state.toolCallCount,
      successfulToolCallCount: state.operations.length,
      finishReason: report.finishReason,
      inputTokens: report.inputTokens,
      outputTokens: report.outputTokens,
      outcome: report.outcome,
      errorCode: report.errorCode,
    };
    if (isFailed) {
      this.logger.warn(line);
    } else {
      this.logger.log(line);
    }
  }
}
