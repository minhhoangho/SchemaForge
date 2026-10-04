import { Logger } from "@nestjs/common";
import { aiFindingsDataSchema } from "@schemaforge/api-contract";
import { parseOperation } from "@schemaforge/core";
import type * as Ai from "ai";
import { toUIMessageStream } from "ai";
import { convertReadableStreamToArray } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  chatRequest,
  chunkTypes,
  createHangingModel,
  dataOf,
  proposalOperation,
  providerError,
  renameCall,
  runChatTurn,
  setupChat,
  START_TO_TEXT_END,
  TEXT_STEP,
  toolStep,
  USER_ID,
} from "../../../test/ai-chat-fixtures.js";
import {
  createFailingModel,
  createScriptedModel,
  scriptedFinish,
  scriptedToolCall,
} from "../../../test/mock-ai-model.js";
import { AI_MAX_STEPS } from "./ai.constants.js";

// Wraps the real toUIMessageStream so a test can read the options it got.
vi.mock("ai", async (importOriginal) => {
  const original = await importOriginal<typeof Ai>();
  return { ...original, toUIMessageStream: vi.fn(original.toUIMessageStream) };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AiChatService turn stream", () => {
  it("streams start, text, a proposal and finish in that order for a successful turn", async () => {
    const chunks = await runChatTurn(
      createScriptedModel([toolStep(renameCall("call-1", "store")), TEXT_STEP]),
    );

    expect(chunkTypes(chunks)).toStrictEqual([
      ...START_TO_TEXT_END,
      "data-proposal",
      "finish",
    ]);
    expect(parseOperation(proposalOperation(chunks)).isOk).toBe(true);
    expect(dataOf(chunks, "data-proposal")).toMatchObject({
      operation: {
        type: "batch",
        operations: [{ type: "renameSchema", name: "store" }],
      },
      stoppedEarly: false,
    });
  });

  it("returns a tool error to the model and accepts the corrected call in the next step", async () => {
    const model = createScriptedModel([
      toolStep(
        scriptedToolCall("call-1", "removeColumn", {
          table: "users",
          column: "missing",
        }),
      ),
      toolStep(renameCall("call-2", "store")),
      TEXT_STEP,
    ]);

    const chunks = await runChatTurn(model);

    expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain(
      "column-name-not-found",
    );
    expect(proposalOperation(chunks)).toMatchObject({
      operations: [{ type: "renameSchema", name: "store" }],
    });
  });

  it("stops applying tools after 30 calls", async () => {
    const calls = Array.from({ length: 31 }, (_, index) =>
      renameCall(`call-${String(index)}`, `store_${String(index)}`),
    );
    const model = createScriptedModel([toolStep(...calls), TEXT_STEP]);

    const chunks = await runChatTurn(model);

    expect(proposalOperation(chunks)).toMatchObject({
      operations: Array.from({ length: 30 }, () => ({ type: "renameSchema" })),
    });
    expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain(
      "tool-call-limit",
    );
  });

  it("streams sample data and findings for a sample data turn", async () => {
    const chunks = await runChatTurn(
      createScriptedModel([
        toolStep(
          scriptedToolCall("call-1", "proposeSampleData", {
            tables: [
              { table: "users", rows: [[{ column: "id", value: "1" }]] },
            ],
          }),
          scriptedToolCall("call-2", "reportFindings", {
            findings: [
              {
                kind: "suggestion",
                category: "naming",
                title: "Plural name",
                detail: "Fine as is.",
                table: "users",
              },
            ],
          }),
        ),
        TEXT_STEP,
      ]),
    );

    expect(chunkTypes(chunks)).toStrictEqual([
      ...START_TO_TEXT_END,
      "data-sample-data",
      "data-findings",
      "finish",
    ]);
    expect(
      aiFindingsDataSchema.safeParse(dataOf(chunks, "data-findings")).success,
    ).toBe(true);
    expect(dataOf(chunks, "data-sample-data")).toMatchObject({
      dataset: { tables: [{ tableId: "tbl_users" }] },
    });
  });

  it("streams only text for an explanation turn", async () => {
    const chunks = await runChatTurn(createScriptedModel([TEXT_STEP]));

    expect(chunkTypes(chunks)).toStrictEqual([...START_TO_TEXT_END, "finish"]);
  });

  it("marks the proposal stoppedEarly when the step limit ends a tool-calling turn", async () => {
    const steps = Array.from({ length: AI_MAX_STEPS }, (_, index) =>
      toolStep(renameCall(`call-${String(index)}`, `store_${String(index)}`)),
    );

    const chunks = await runChatTurn(createScriptedModel(steps));

    expect(dataOf(chunks, "data-proposal")).toMatchObject({
      stoppedEarly: true,
    });
  });

  it("maps a provider error to its stream error code and writes nothing after it", async () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

    const chunks = await runChatTurn(createFailingModel(providerError(400)));

    expect(chunks.at(-1)).toStrictEqual({
      type: "error",
      errorText: "ai-upstream-failed",
    });
    expect(chunkTypes(chunks).filter((type) => type === "error")).toHaveLength(
      1,
    );
  });

  it("sends no tool, reasoning or step chunks", async () => {
    const chunks = await runChatTurn(
      createScriptedModel([
        [
          { type: "reasoning-start", id: "reasoning-1" },
          { type: "reasoning-delta", id: "reasoning-1", delta: "Thinking" },
          { type: "reasoning-end", id: "reasoning-1" },
          ...renameCall("call-1", "store"),
          scriptedFinish("tool-calls"),
        ],
        TEXT_STEP,
      ]),
    );

    expect(chunkTypes(chunks)).toStrictEqual([
      ...START_TO_TEXT_END,
      "data-proposal",
      "finish",
    ]);
  });

  it("turns off reasoning and sources in the UI stream", async () => {
    vi.mocked(toUIMessageStream).mockClear();

    await runChatTurn(createScriptedModel([TEXT_STEP]));

    expect(toUIMessageStream).toHaveBeenCalledWith(
      expect.objectContaining({
        sendReasoning: false,
        sendSources: false,
        sendStart: true,
        sendFinish: false,
      }),
    );
  });

  it("sends ai-timeout when the model call times out", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { service } = await setupChat(createHangingModel());
    const stream = await service.chat(
      USER_ID,
      chatRequest(),
      new AbortController().signal,
    );
    const collected = convertReadableStreamToArray(stream);

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect((await collected).at(-1)).toStrictEqual({
      type: "error",
      errorText: "ai-timeout",
    });
  });
});
