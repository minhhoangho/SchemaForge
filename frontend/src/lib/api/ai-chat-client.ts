// The only frontend module that imports the `ai` package (AI spec section 5).
// Load it with a dynamic import() only, so the AI SDK stays out of the initial
// editor bundle. `uiMessageChunkSchema` is a lazy schema, created on first use
// and so after frontend/src/lib/zod-config.ts (Zod jitless).
import type {
  AiChatRequest,
  AiFindingsData,
  AiProposalData,
  AiSampleData,
  AiStreamErrorCode,
} from "@schemaforge/api-contract";
import {
  AI_DATA_PART_TYPES,
  aiFindingsDataSchema,
  aiProposalDataSchema,
  aiSampleDataSchema,
  isAiStreamErrorCode,
} from "@schemaforge/api-contract";
import {
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
} from "ai";
import type { UIMessage, UIMessageChunk } from "ai";

import { logger } from "@/lib/logger";

import { withAutoRefresh } from "./api-client";
import type { ApiFailure } from "./api-failure";
import { AI_CHAT_ROUTE, openStream, startRun } from "./ai-chat-request";
import type { AiChatTransport, TurnRun } from "./ai-chat-request";

export type { AiChatTransport } from "./ai-chat-request";
export {
  AI_CLIENT_TIMEOUT_MS,
  AI_FIRST_BYTE_TIMEOUT_MS,
} from "./ai-chat-request";

export type AiChatErrorCode =
  AiStreamErrorCode | "network" | "timeout" | "invalid-response";

export type AiChatEvent =
  // The whole text of the reply so far, not only the newest delta.
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "proposal"; readonly data: AiProposalData }
  | { readonly kind: "findings"; readonly data: AiFindingsData }
  | { readonly kind: "sampleData"; readonly data: AiSampleData }
  // Always the last event.
  | { readonly kind: "error"; readonly code: AiChatErrorCode }
  // failure.kind is always "http"; always the last event.
  | { readonly kind: "http-failure"; readonly failure: ApiFailure };

export type AiChatClient = {
  readonly stream: (
    request: AiChatRequest,
    options: { readonly signal: AbortSignal },
  ) => AsyncIterable<AiChatEvent>;
};

type ChunkParseResult =
  ReturnType<
    typeof parseJsonEventStream<UIMessageChunk>
  > extends ReadableStream<infer Parsed>
    ? Parsed
    : never;
const OUTPUT_INVALID: AiStreamErrorCode = "ai-output-invalid";
const UNKNOWN_STREAM_ERROR: AiStreamErrorCode = "internal-error";

// An `error` chunk is the last chunk of a turn (AI plan, Vấn đề 7), so the
// guard ends the stream with its code. Handing it to readUIMessageStream
// would surface a plain Error that cannot be told apart from a dropped
// connection, and its raw text must never reach the caller.
function createChunkGuard(): TransformStream<ChunkParseResult, UIMessageChunk> {
  return new TransformStream({
    transform(result, controller) {
      if (!result.success) {
        controller.error(new Error(OUTPUT_INVALID));
        return;
      }
      const chunk = result.value;
      if (chunk.type === "error") {
        const code = isAiStreamErrorCode(chunk.errorText)
          ? chunk.errorText
          : UNKNOWN_STREAM_ERROR;
        controller.error(new Error(code));
        return;
      }
      controller.enqueue(chunk);
    },
  });
}

function invalidDataPart(type: string): AiChatEvent {
  // The type only: the payload is model output and may hold user data.
  logger.warn("ai.chat.invalid-data-part", { type });
  return { kind: "error", code: OUTPUT_INVALID };
}

function parseDataPart(type: string, data: unknown): AiChatEvent | null {
  switch (type) {
    case AI_DATA_PART_TYPES.proposal: {
      const parsed = aiProposalDataSchema.safeParse(data);
      return parsed.success
        ? { kind: "proposal", data: parsed.data }
        : invalidDataPart(type);
    }
    case AI_DATA_PART_TYPES.findings: {
      const parsed = aiFindingsDataSchema.safeParse(data);
      return parsed.success
        ? { kind: "findings", data: parsed.data }
        : invalidDataPart(type);
    }
    case AI_DATA_PART_TYPES.sampleData: {
      const parsed = aiSampleDataSchema.safeParse(data);
      return parsed.success
        ? { kind: "sampleData", data: parsed.data }
        : invalidDataPart(type);
    }
    default:
      return null;
  }
}

// Each snapshot holds every part so far; a data part is reported once.
function collectDataEvents(
  message: UIMessage,
  reported: Set<string>,
): AiChatEvent[] {
  const events: AiChatEvent[] = [];
  for (const part of message.parts) {
    if (!("data" in part) || reported.has(part.type)) {
      continue;
    }
    const event = parseDataPart(part.type, part.data);
    if (event === null) {
      continue;
    }
    reported.add(part.type);
    events.push(event);
    if (event.kind === "error") {
      break;
    }
  }
  return events;
}

function joinText(message: UIMessage): string {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

type ReadState = { text: string; readonly reported: Set<string> };

// The events one message snapshot adds; an error event is always last.
function toSnapshotEvents(message: UIMessage, state: ReadState): AiChatEvent[] {
  const text = joinText(message);
  const textEvents: AiChatEvent[] =
    text === state.text ? [] : [{ kind: "text", text }];
  state.text = text;
  return [...textEvents, ...collectDataEvents(message, state.reported)];
}

function toStreamErrorCode(
  cause: unknown,
  run: TurnRun,
): AiChatErrorCode | null {
  if (run.callerSignal.aborted) {
    return null;
  }
  if (cause instanceof Error && isAiStreamErrorCode(cause.message)) {
    return cause.message;
  }
  return run.hasTimedOut() ? "timeout" : "network";
}

async function* readEvents(
  body: ReadableStream<Uint8Array>,
  run: TurnRun,
): AsyncGenerator<AiChatEvent, void, undefined> {
  const chunks = parseJsonEventStream({
    stream: body,
    schema: uiMessageChunkSchema,
  }).pipeThrough(createChunkGuard());
  const state: ReadState = { text: "", reported: new Set() };
  try {
    for await (const message of readUIMessageStream({
      stream: chunks,
      terminateOnError: true,
    })) {
      const events = toSnapshotEvents(message, state);
      yield* events;
      if (events.at(-1)?.kind === "error") {
        return;
      }
    }
  } catch (cause) {
    const code = toStreamErrorCode(cause, run);
    if (code !== null) {
      yield { kind: "error", code };
    }
  }
}

function toFailureEvent(failure: ApiFailure): AiChatEvent {
  return failure.kind === "http"
    ? { kind: "http-failure", failure }
    : { kind: "error", code: failure.kind };
}

async function* streamTurn(
  transport: AiChatTransport,
  request: AiChatRequest,
  callerSignal: AbortSignal,
): AsyncGenerator<AiChatEvent, void, undefined> {
  const run = startRun(callerSignal);
  try {
    const opened = await withAutoRefresh(
      AI_CHAT_ROUTE,
      transport.sessionRefresher,
      transport.onSessionExpired,
      () => openStream(transport, request, run),
    );
    if (!opened.isOk) {
      yield toFailureEvent(opened.error);
      return;
    }
    yield* readEvents(opened.value, run);
  } catch (cause) {
    // A stopped turn ends quietly; the caller knows it stopped it.
    if (!callerSignal.aborted) {
      throw cause;
    }
  } finally {
    run.dispose();
  }
}

export function createAiChatClient(transport: AiChatTransport): AiChatClient {
  return {
    stream: (request, options) =>
      streamTurn(transport, request, options.signal),
  };
}
