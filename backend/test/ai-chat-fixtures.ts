import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { AiChatRequest } from "@schemaforge/api-contract";
import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { APICallError, type LanguageModel, type UIMessageChunk } from "ai";
import { convertReadableStreamToArray, MockLanguageModelV4 } from "ai/test";
import { type MockInstance, vi } from "vitest";

import { Clock } from "../src/common/clock.js";
import { AiCapacity } from "../src/modules/ai/ai-capacity.js";
import { AiChatService } from "../src/modules/ai/ai-chat.service.js";
import {
  AI_GENERATE_ID,
  AI_GLOBAL_REQUESTS_PER_HOUR,
  AI_LANGUAGE_MODEL,
} from "../src/modules/ai/ai-model.provider.js";
import {
  type ProviderStreamPart,
  type ScriptedStep,
  scriptedFinish,
  scriptedText,
  scriptedToolCall,
} from "./mock-ai-model.js";

// Shared fixtures of the AiChatService unit specs (and the AI e2e of Task 19).

export const USER_ID = "user-1";
export const MESSAGE_TEXT = "Rename the schema to store, fixture-message-text";
export const SCHEMA_NAME = "fixture_schema_name";
export const SENTINEL = "fixture-sentinel-prompt-body";
export const SCHEMA = buildSchema({
  name: SCHEMA_NAME,
  tables: [
    makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_users_id"] }),
  ],
  columns: [
    makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
  ],
});
export const TEXT_STEP: ScriptedStep = [
  ...scriptedText("text-1", "Done."),
  scriptedFinish("stop"),
];
export const START_TO_TEXT_END = [
  "start",
  "text-start",
  "text-delta",
  "text-end",
];

export function toolStep(...calls: ProviderStreamPart[][]): ScriptedStep {
  return [...calls.flat(), scriptedFinish("tool-calls")];
}

export function renameCall(callId: string, name: string): ProviderStreamPart[] {
  return scriptedToolCall(callId, "renameSchema", { name });
}

export function chatRequest(document: unknown = SCHEMA): AiChatRequest {
  return {
    document,
    messages: [{ role: "user", text: MESSAGE_TEXT }],
    locale: "en",
  };
}

export type ChatSetup = {
  readonly service: AiChatService;
  readonly capacity: AiCapacity;
};

/** The clock answers 1000 ms at the start of a turn and 1250 ms at its end. */
export async function setupChat(
  model: LanguageModel | null,
  budget = 100,
): Promise<ChatSetup> {
  const clock = { now: vi.fn() };
  clock.now
    .mockReturnValueOnce(new Date(1000))
    .mockReturnValueOnce(new Date(1250));
  const moduleRef = await Test.createTestingModule({
    providers: [
      AiChatService,
      AiCapacity,
      { provide: AI_LANGUAGE_MODEL, useValue: model },
      { provide: AI_GENERATE_ID, useValue: createCounterIdGenerator() },
      { provide: AI_GLOBAL_REQUESTS_PER_HOUR, useValue: budget },
      { provide: Clock, useValue: clock },
    ],
  }).compile();
  return {
    service: moduleRef.get(AiChatService),
    capacity: moduleRef.get(AiCapacity),
  };
}

export async function runChatTurn(
  model: LanguageModel,
  signal: AbortSignal = new AbortController().signal,
): Promise<UIMessageChunk[]> {
  const { service } = await setupChat(model);
  return convertReadableStreamToArray(
    await service.chat(USER_ID, chatRequest(), signal),
  );
}

export function chunkTypes(chunks: readonly UIMessageChunk[]): string[] {
  return chunks.map((chunk) => chunk.type);
}

export function dataOf(
  chunks: readonly UIMessageChunk[],
  type: string,
): unknown {
  const chunk = chunks.find((candidate) => candidate.type === type);
  return chunk !== undefined && "data" in chunk ? chunk.data : undefined;
}

export function proposalOperation(chunks: readonly UIMessageChunk[]): unknown {
  const data = dataOf(chunks, "data-proposal");
  return typeof data === "object" && data !== null && "operation" in data
    ? data.operation
    : undefined;
}

/**
 * A model call that streams nothing and fails only when it is aborted,
 * including a signal that is already aborted when the call starts.
 */
export function createHangingModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: ({ abortSignal }) =>
      Promise.resolve({
        stream: new ReadableStream<ProviderStreamPart>({
          start(controller) {
            if (abortSignal?.aborted === true) {
              controller.error(abortSignal.reason);
              return;
            }
            abortSignal?.addEventListener(
              "abort",
              () => {
                controller.error(abortSignal.reason);
              },
              { once: true },
            );
          },
        }),
      }),
  });
}

/** Streams text, lets the test abort, then sends a tool call that must not run. */
export function createAbortingModel(abort: () => void): MockLanguageModelV4 {
  const chunks: ProviderStreamPart[] = [
    { type: "stream-start", warnings: [] },
    ...scriptedText("text-1", "Working"),
  ];
  const late = toolStep(renameCall("call-1", "store"));
  return new MockLanguageModelV4({
    doStream: () =>
      Promise.resolve({
        stream: new ReadableStream<ProviderStreamPart>({
          start(controller) {
            chunks.forEach((chunk) => {
              controller.enqueue(chunk);
            });
          },
          pull(controller) {
            abort();
            late.forEach((chunk) => {
              controller.enqueue(chunk);
            });
            controller.close();
          },
        }),
      }),
  });
}

/** A model stream that fails after its first chunk. */
export function createThrowingStreamModel(): LanguageModel {
  return new MockLanguageModelV4({
    doStream: () =>
      Promise.resolve({
        stream: new ReadableStream<ProviderStreamPart>({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            controller.error(new Error(SENTINEL));
          },
        }),
      }),
  });
}

/** A provider error whose message and bodies carry `SENTINEL`, like a real prompt. */
export function providerError(statusCode: number): APICallError {
  return new APICallError({
    message: `upstream failure ${SENTINEL}`,
    url: "https://provider.example.test/v1/models/test:stream",
    requestBodyValues: { contents: [{ text: SENTINEL }] },
    statusCode,
    responseBody: SENTINEL,
  });
}

type LoggerMethod = (message: unknown, ...rest: unknown[]) => void;

export type LoggerSpies = {
  readonly log: MockInstance<LoggerMethod>;
  readonly warn: MockInstance<LoggerMethod>;
  readonly error: MockInstance<LoggerMethod>;
};

export function spyOnLogger(): LoggerSpies {
  return {
    log: vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined),
    warn: vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined),
    error: vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined),
  };
}

export function loggedText(logger: LoggerSpies): string {
  return JSON.stringify([
    logger.log.mock.calls,
    logger.warn.mock.calls,
    logger.error.mock.calls,
  ]);
}

export function documentWithTableComment(comment: string): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({
        id: "tbl_users",
        comment,
        primaryKeyColumnIds: ["col_users_id"],
      }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
    ],
  });
}
