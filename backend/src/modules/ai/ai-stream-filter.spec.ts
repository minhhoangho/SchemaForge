import type { UIMessageChunk } from "ai";
import {
  convertArrayToReadableStream,
  convertReadableStreamToArray,
} from "ai/test";
import { describe, expect, it } from "vitest";

import {
  AI_ALLOWED_CHUNK_TYPES,
  createAiChunkFilter,
} from "./ai-stream-filter.js";

const PROVIDER_METADATA = { google: { thoughtSignature: "fixture-signature" } };

async function filterChunks(
  chunks: readonly UIMessageChunk[],
): Promise<UIMessageChunk[]> {
  return convertReadableStreamToArray(
    convertArrayToReadableStream([...chunks]).pipeThrough(
      createAiChunkFilter(),
    ),
  );
}

describe("AI_ALLOWED_CHUNK_TYPES", () => {
  it("lists only start, text and error chunk types", () => {
    expect([...AI_ALLOWED_CHUNK_TYPES].sort()).toEqual([
      "error",
      "start",
      "text-delta",
      "text-end",
      "text-start",
    ]);
  });
});

describe("createAiChunkFilter", () => {
  it("passes start, text and error chunks", async () => {
    const chunks: UIMessageChunk[] = [
      { type: "start", messageId: "message-1" },
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: "Hello" },
      { type: "text-end", id: "text-1" },
      { type: "error", errorText: "ai-upstream-busy" },
    ];

    expect(await filterChunks(chunks)).toEqual(chunks);
  });

  it("passes a start chunk without a message id", async () => {
    expect(await filterChunks([{ type: "start" }])).toEqual([
      { type: "start" },
    ]);
  });

  it("drops providerMetadata from text chunks", async () => {
    const filtered = await filterChunks([
      { type: "text-start", id: "text-1", providerMetadata: PROVIDER_METADATA },
      {
        type: "text-delta",
        id: "text-1",
        delta: "Hello",
        providerMetadata: PROVIDER_METADATA,
      },
      { type: "text-end", id: "text-1", providerMetadata: PROVIDER_METADATA },
    ]);

    expect(filtered).toEqual([
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: "Hello" },
      { type: "text-end", id: "text-1" },
    ]);
  });

  it("drops messageMetadata from start chunks", async () => {
    const filtered = await filterChunks([
      { type: "start", messageId: "message-1", messageMetadata: { secret: 1 } },
    ]);

    expect(filtered).toEqual([{ type: "start", messageId: "message-1" }]);
  });

  it("replaces an error text that is not a stream error code", async () => {
    const filtered = await filterChunks([
      { type: "error", errorText: "Request to https://provider failed" },
    ]);

    expect(filtered).toEqual([{ type: "error", errorText: "internal-error" }]);
  });

  it("drops data-* chunks coming from the model stream", async () => {
    const filtered = await filterChunks([
      { type: "data-proposal", data: { operation: {}, stoppedEarly: false } },
      { type: "data-findings", id: "findings-1", data: [] },
    ]);

    expect(filtered).toEqual([]);
  });

  it("drops finish coming from the model stream", async () => {
    expect(
      await filterChunks([{ type: "finish", finishReason: "stop" }]),
    ).toEqual([]);
  });

  it.each<[string, UIMessageChunk]>([
    [
      "tool-input-start",
      { type: "tool-input-start", toolCallId: "call-1", toolName: "addTable" },
    ],
    [
      "tool-input-delta",
      { type: "tool-input-delta", toolCallId: "call-1", inputTextDelta: "{" },
    ],
    [
      "tool-input-available",
      {
        type: "tool-input-available",
        toolCallId: "call-1",
        toolName: "addTable",
        input: { name: "users" },
      },
    ],
    [
      "tool-input-error",
      {
        type: "tool-input-error",
        toolCallId: "call-1",
        toolName: "addTable",
        input: {},
        errorText: "invalid",
      },
    ],
    [
      "tool-output-available",
      { type: "tool-output-available", toolCallId: "call-1", output: {} },
    ],
    [
      "tool-output-error",
      { type: "tool-output-error", toolCallId: "call-1", errorText: "x" },
    ],
    [
      "tool-output-denied",
      { type: "tool-output-denied", toolCallId: "call-1" },
    ],
    ["reasoning-start", { type: "reasoning-start", id: "r-1" }],
    ["reasoning-delta", { type: "reasoning-delta", id: "r-1", delta: "think" }],
    ["reasoning-end", { type: "reasoning-end", id: "r-1" }],
    [
      "source-url",
      { type: "source-url", sourceId: "s-1", url: "https://example.test" },
    ],
    [
      "source-document",
      {
        type: "source-document",
        sourceId: "s-1",
        mediaType: "text/plain",
        title: "doc",
      },
    ],
    [
      "file",
      { type: "file", url: "https://example.test/f", mediaType: "text/plain" },
    ],
    ["start-step", { type: "start-step" }],
    ["finish-step", { type: "finish-step" }],
    ["reset-step", { type: "reset-step" }],
    ["abort", { type: "abort", reason: "Step timeout of 5ms exceeded" }],
    ["message-metadata", { type: "message-metadata", messageMetadata: {} }],
    ["custom", { type: "custom", kind: "provider.event" }],
  ])(
    "drops tool, reasoning, source and step chunks (%s)",
    async (_type, chunk) => {
      expect(await filterChunks([chunk])).toEqual([]);
    },
  );

  it("drops an unknown future chunk type", async () => {
    const base: UIMessageChunk = { type: "text-end", id: "text-1" };
    // The chunk union cannot name a type a later AI SDK version adds, so the
    // runtime type is overwritten on a chunk the compiler already accepts.
    const futureChunk = Object.assign({ ...base }, { type: "future-chunk" });

    expect(await filterChunks([futureChunk])).toEqual([]);
  });
});
