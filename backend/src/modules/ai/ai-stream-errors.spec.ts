import { AISDKError, APICallError, RetryError, streamText } from "ai";
import type { TimeoutConfiguration, ToolSet } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { AiTurnInvalidError, toAiStreamErrorCode } from "./ai-stream-errors.js";

const PROVIDER_URL = "https://provider.example.test/v1/models/test:stream";

function apiCallError(
  statusCode: number,
  message = "upstream failure",
): APICallError {
  return new APICallError({
    message,
    url: PROVIDER_URL,
    requestBodyValues: {},
    statusCode,
  });
}

type StreamTimeout = TimeoutConfiguration<ToolSet>;

/** A model stream that never sends a chunk and fails only when its call is aborted. */
function createHangingModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: ({ abortSignal }) =>
      Promise.resolve({
        stream: new ReadableStream({
          start(controller) {
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

/** Runs the real `streamText` until its timeout fires and returns the abort reason it reports. */
async function captureStreamTimeoutReason(
  timeout: StreamTimeout,
): Promise<unknown> {
  let reason: unknown;
  const result = streamText({
    model: createHangingModel(),
    prompt: "fixture prompt",
    timeout,
    maxRetries: 0,
    onAbort: (event) => {
      reason = event.reason;
    },
  });
  await result.consumeStream();
  return reason;
}

describe("toAiStreamErrorCode", () => {
  it.each([429, 503])("maps provider %i to ai-upstream-busy", (statusCode) => {
    expect(toAiStreamErrorCode(apiCallError(statusCode))).toBe(
      "ai-upstream-busy",
    );
  });

  it.each([
    ["a 400 response", apiCallError(400)],
    ["a 500 response", apiCallError(500)],
    [
      "a non-HTTP provider error",
      new AISDKError({ name: "AI_FixtureError", message: "blocked" }),
    ],
  ])(
    "maps another provider error to ai-upstream-failed (%s)",
    (_label, error) => {
      expect(toAiStreamErrorCode(error)).toBe("ai-upstream-failed");
    },
  );

  it.each([
    [503, "ai-upstream-busy"],
    [500, "ai-upstream-failed"],
  ])(
    "maps a retry error by its last error (last status %i)",
    (lastStatusCode, expected) => {
      const error = new RetryError({
        message: "retries exhausted",
        reason: "maxRetriesExceeded",
        errors: [apiCallError(400), apiCallError(lastStatusCode)],
      });

      expect(toAiStreamErrorCode(error)).toBe(expected);
    },
  );

  it.each<[string, StreamTimeout]>([
    ["totalMs", { totalMs: 5 }],
    ["stepMs", { stepMs: 5 }],
  ])(
    "maps the stream timeout error to ai-timeout (%s)",
    async (_label, timeout) => {
      const reason = await captureStreamTimeoutReason(timeout);

      expect(toAiStreamErrorCode(reason)).toBe("ai-timeout");
    },
  );

  it("does not treat a client abort as a timeout", () => {
    const controller = new AbortController();
    controller.abort();

    expect(toAiStreamErrorCode(controller.signal.reason)).toBe(
      "internal-error",
    );
  });

  it("maps an invalid turn to ai-output-invalid", () => {
    expect(toAiStreamErrorCode(new AiTurnInvalidError())).toBe(
      "ai-output-invalid",
    );
  });

  it.each([
    ["a plain error", new Error("boom")],
    ["a string", "boom"],
    ["undefined", undefined],
  ])("maps an unknown error to internal-error (%s)", (_label, error) => {
    expect(toAiStreamErrorCode(error)).toBe("internal-error");
  });

  it.each([
    ["a plain error", new Error("ai-timeout"), "internal-error"],
    [
      "a provider error",
      apiCallError(500, "ai-upstream-busy"),
      "ai-upstream-failed",
    ],
  ])("never returns the error message (%s)", (_label, error, expected) => {
    expect(toAiStreamErrorCode(error)).toBe(expected);
  });
});
