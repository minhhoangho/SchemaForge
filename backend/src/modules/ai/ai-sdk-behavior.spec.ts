import {
  AI_COLUMN_TYPE_KINDS,
  AI_MAX_NAME_LENGTH,
  AI_MAX_SAMPLE_STRING_LENGTH,
  aiEditToolInputShapes,
  proposeSampleDataInputShape,
} from "@schemaforge/core/ai";
import { isStepCount, streamText, tool } from "ai";
import type { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

import {
  createScriptedModel,
  scriptedFinish,
  scriptedText,
  scriptedToolCall,
} from "../../../test/mock-ai-model.js";

// Probes of how `ai` 7.0.126 really treats the core tool shapes (plan Task 16,
// Risks 2, 3 and 12), written before `ai-tools.ts` depends on them.

type ProviderCall = MockLanguageModelV4["doStreamCalls"][number];

function providerTool(call: ProviderCall | undefined, name: string): unknown {
  return call?.tools?.find((candidate) => candidate.name === name);
}

function toolMessages(call: ProviderCall | undefined): unknown[] {
  return (call?.prompt ?? []).filter((message) => message.role === "tool");
}

const SAMPLE_INPUT = {
  tables: [{ table: "users", rows: [[{ column: "__proto__", value: "1" }]] }],
};

describe("AI SDK behavior with the core tool shapes", () => {
  it("passes nested tool input schemas to the provider", async () => {
    const model = createScriptedModel([
      [...scriptedText("text-1", "ok"), scriptedFinish("stop")],
    ]);

    await streamText({
      model,
      prompt: "fixture prompt",
      tools: {
        createTable: tool({
          inputSchema: aiEditToolInputShapes.createTable,
          execute: () => ({ ok: true }),
        }),
        proposeSampleData: tool({
          inputSchema: proposeSampleDataInputShape,
          execute: () => ({ ok: true }),
        }),
      },
    }).consumeStream();

    const call = model.doStreamCalls[0];
    expect(providerTool(call, "createTable")).toMatchObject({
      type: "function",
      inputSchema: {
        required: ["name", "columns", "primaryKey"],
        properties: {
          name: { type: "string", maxLength: AI_MAX_NAME_LENGTH },
          columns: {
            type: "array",
            items: {
              required: ["name", "type", "isNullable"],
              properties: {
                type: {
                  required: ["kind"],
                  properties: { kind: { enum: [...AI_COLUMN_TYPE_KINDS] } },
                },
              },
            },
          },
        },
      },
    });
    expect(providerTool(call, "proposeSampleData")).toMatchObject({
      inputSchema: {
        properties: {
          tables: {
            items: {
              properties: {
                rows: {
                  type: "array",
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["column", "value"],
                      properties: {
                        column: {
                          type: "string",
                          maxLength: AI_MAX_NAME_LENGTH,
                        },
                        value: {
                          anyOf: [
                            {
                              type: "string",
                              maxLength: AI_MAX_SAMPLE_STRING_LENGTH,
                            },
                            { type: "null" },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });

  it("returns an input error to the model without calling execute", async () => {
    const execute = vi.fn(() => ({ ok: true }));
    const onError = vi.fn();
    const model = createScriptedModel([
      [
        ...scriptedToolCall("call-1", "renameSchema", { name: 42 }),
        scriptedFinish("tool-calls"),
      ],
      [...scriptedText("text-1", "fixed"), scriptedFinish("stop")],
    ]);

    await streamText({
      model,
      prompt: "fixture prompt",
      stopWhen: isStepCount(2),
      onError,
      tools: {
        renameSchema: tool({
          inputSchema: aiEditToolInputShapes.renameSchema,
          execute,
        }),
      },
    }).consumeStream();

    expect(execute).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(toolMessages(model.doStreamCalls[1])).toMatchObject([
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "renameSchema",
            output: { type: "error-text" },
          },
        ],
      },
    ]);
  });

  it("keeps a __proto__ column name from tool input to execute", async () => {
    const execute = vi.fn(() => ({ ok: true }));
    const model = createScriptedModel([
      [
        ...scriptedToolCall("call-1", "proposeSampleData", SAMPLE_INPUT),
        scriptedFinish("tool-calls"),
      ],
    ]);

    await streamText({
      model,
      prompt: "fixture prompt",
      tools: {
        proposeSampleData: tool({
          inputSchema: proposeSampleDataInputShape,
          execute,
        }),
      },
    }).consumeStream();

    expect(execute).toHaveBeenCalledWith(SAMPLE_INPUT, expect.anything());
  });
});
