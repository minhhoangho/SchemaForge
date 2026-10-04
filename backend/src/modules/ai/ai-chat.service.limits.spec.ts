import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type * as ApiContract from "@schemaforge/api-contract";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import type { LanguageModel, UIMessageChunk } from "ai";
import { convertReadableStreamToArray } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createScriptedModel,
  type ScriptedStep,
  scriptedFinish,
  scriptedText,
  scriptedToolCall,
} from "../../../test/mock-ai-model.js";
import { Clock } from "../../common/clock.js";
import type * as AiConstants from "./ai.constants.js";
import { AiCapacity } from "./ai-capacity.js";
import { AiChatService } from "./ai-chat.service.js";
import {
  AI_GENERATE_ID,
  AI_GLOBAL_REQUESTS_PER_HOUR,
  AI_LANGUAGE_MODEL,
} from "./ai-model.provider.js";

// The real limits (1 MiB, 2 MiB) cannot be reached by tool inputs within their
// own .max() bounds, so this file lowers them per test through getters.
const limits = vi.hoisted(() => ({
  partBytes: Number.MAX_SAFE_INTEGER,
  documentBytes: Number.MAX_SAFE_INTEGER,
}));

vi.mock("./ai.constants.js", async (importOriginal) => ({
  ...(await importOriginal<typeof AiConstants>()),
  get AI_MAX_PROPOSAL_BYTES(): number {
    return limits.partBytes;
  },
}));

vi.mock("@schemaforge/api-contract", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiContract>()),
  get MAX_REQUEST_BODY_BYTES(): number {
    return limits.documentBytes;
  },
}));

const SMALL_LIMIT_BYTES = 16;
const OUTPUT_INVALID = { type: "error", errorText: "ai-output-invalid" };
const SCHEMA = buildSchema({
  name: "shop",
  tables: [
    makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_users_id"] }),
  ],
  columns: [
    makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
  ],
});
const TEXT_STEP: ScriptedStep = [
  ...scriptedText("text-1", "Done."),
  scriptedFinish("stop"),
];

function toolTurn(toolName: string, input: unknown): LanguageModel {
  return createScriptedModel([
    [
      ...scriptedToolCall("call-1", toolName, input),
      scriptedFinish("tool-calls"),
    ],
    TEXT_STEP,
  ]);
}

const RENAME_TURN = (): LanguageModel =>
  toolTurn("renameSchema", { name: "store" });
const SAMPLE_DATA_TURN = (): LanguageModel =>
  toolTurn("proposeSampleData", {
    tables: [{ table: "users", rows: [[{ column: "id", value: "1" }]] }],
  });
const FINDINGS_TURN = (): LanguageModel =>
  toolTurn("reportFindings", {
    findings: [
      {
        kind: "issue",
        category: "naming",
        title: "Unclear name",
        detail: "Rename the table.",
        table: "users",
      },
    ],
  });

async function runTurn(model: LanguageModel): Promise<UIMessageChunk[]> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AiChatService,
      AiCapacity,
      { provide: AI_LANGUAGE_MODEL, useValue: model },
      { provide: AI_GENERATE_ID, useValue: createCounterIdGenerator() },
      { provide: AI_GLOBAL_REQUESTS_PER_HOUR, useValue: 100 },
      { provide: Clock, useValue: { now: () => new Date(0) } },
    ],
  }).compile();
  const stream = await moduleRef.get(AiChatService).chat(
    "user-1",
    {
      document: SCHEMA,
      messages: [{ role: "user", text: "Go" }],
      locale: "en",
    },
    new AbortController().signal,
  );
  return convertReadableStreamToArray(stream);
}

function chunkTypes(chunks: readonly UIMessageChunk[]): string[] {
  return chunks.map((chunk) => chunk.type);
}

beforeEach(() => {
  limits.partBytes = Number.MAX_SAFE_INTEGER;
  limits.documentBytes = Number.MAX_SAFE_INTEGER;
  vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AiChatService output size limits", () => {
  it("writes the proposal while it is within the limits", async () => {
    const chunks = await runTurn(RENAME_TURN());

    expect(chunkTypes(chunks)).toContain("data-proposal");
  });

  it("writes ai-output-invalid when the proposal exceeds AI_MAX_PROPOSAL_BYTES", async () => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    limits.partBytes = SMALL_LIMIT_BYTES;

    const chunks = await runTurn(RENAME_TURN());

    expect(chunks.at(-1)).toStrictEqual(OUTPUT_INVALID);
    expect(chunkTypes(chunks)).not.toContain("data-proposal");
    expect(chunkTypes(chunks)).not.toContain("finish");
  });

  it("writes ai-output-invalid when the accepted document would exceed MAX_REQUEST_BODY_BYTES", async () => {
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    limits.documentBytes = SMALL_LIMIT_BYTES;

    const chunks = await runTurn(RENAME_TURN());

    expect(chunks.at(-1)).toStrictEqual(OUTPUT_INVALID);
    expect(chunkTypes(chunks)).not.toContain("data-proposal");
  });

  it.each([
    ["sample data", SAMPLE_DATA_TURN, "data-sample-data"],
    ["findings", FINDINGS_TURN, "data-findings"],
  ])(
    "writes ai-output-invalid when %s exceed AI_MAX_PROPOSAL_BYTES",
    async (_label, model, partType) => {
      vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      limits.partBytes = SMALL_LIMIT_BYTES;

      const chunks = await runTurn(model());

      expect(chunks.at(-1)).toStrictEqual(OUTPUT_INVALID);
      expect(chunkTypes(chunks)).not.toContain(partType);
    },
  );

  it("logs the turn-invalid reason and the failed turn with codes only", async () => {
    const error = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const warn = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    limits.documentBytes = SMALL_LIMIT_BYTES;

    await runTurn(RENAME_TURN());

    expect(error).toHaveBeenCalledWith({
      event: "ai.chat.turn-invalid",
      userId: "user-1",
      reason: "document-too-large",
    });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ai.chat.failed",
        outcome: "error",
        errorCode: "ai-output-invalid",
      }),
    );
  });
});
