import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

// Scripted stand-ins for the Gemini model (plan Task 16, Risk 9). The chunk
// shapes follow `LanguageModelV4StreamPart` of `@ai-sdk/provider` 4.0.21 and
// what `@ai-sdk/google` 4.0.87 emits in `google-language-model.ts`: a complete
// function call arrives as tool-input-start, -delta, -end, then tool-call with
// the arguments as a JSON string, and every step ends with a finish chunk.

type DoStreamResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;

export type ProviderStreamPart =
  DoStreamResult["stream"] extends ReadableStream<infer Part> ? Part : never;

/** The chunks of one model call, without the leading stream-start. */
export type ScriptedStep = readonly ProviderStreamPart[];

const SCRIPTED_USAGE = {
  inputTokens: {
    total: 120,
    noCache: 120,
    cacheRead: 0,
    cacheWrite: undefined,
  },
  outputTokens: { total: 30, text: 30, reasoning: 0 },
} as const;

export function scriptedText(id: string, text: string): ProviderStreamPart[] {
  return [
    { type: "text-start", id },
    { type: "text-delta", id, delta: text },
    { type: "text-end", id },
  ];
}

/** `input` is sent as JSON text, exactly as given, so it may break the tool's shape. */
export function scriptedToolCall(
  toolCallId: string,
  toolName: string,
  input: unknown,
): ProviderStreamPart[] {
  const json = JSON.stringify(input);
  return [
    { type: "tool-input-start", id: toolCallId, toolName },
    { type: "tool-input-delta", id: toolCallId, delta: json },
    { type: "tool-input-end", id: toolCallId },
    { type: "tool-call", toolCallId, toolName, input: json },
  ];
}

/** Gemini reports STOP for both; the provider maps it by whether tools were called. */
export function scriptedFinish(
  reason: "stop" | "tool-calls" | "length" | "content-filter",
): ProviderStreamPart {
  return {
    type: "finish",
    finishReason: { unified: reason, raw: "STOP" },
    usage: SCRIPTED_USAGE,
  };
}

/**
 * Answers the n-th model call with the n-th step. A call past the last step
 * fails, which surfaces a test whose script is too short.
 */
export function createScriptedModel(
  steps: readonly ScriptedStep[],
): MockLanguageModelV4 {
  let callCount = 0;
  return new MockLanguageModelV4({
    doStream: () => {
      const step = steps[callCount];
      callCount += 1;
      if (step === undefined) {
        throw new Error(`The scripted model has no step ${String(callCount)}`);
      }
      return Promise.resolve({
        stream: simulateReadableStream<ProviderStreamPart>({
          chunks: [{ type: "stream-start", warnings: [] }, ...step],
          initialDelayInMs: null,
          chunkDelayInMs: null,
        }),
      });
    },
  });
}

/** A model whose call fails before streaming, like a rejected HTTP request. */
export function createFailingModel(error: unknown): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: () => {
      // The provider rejects with whatever its HTTP layer threw.
      throw error;
    },
  });
}
