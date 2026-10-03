import type { AiStreamErrorCode } from "@schemaforge/api-contract";
import { AISDKError, APICallError, RetryError } from "ai";

/** Gemini answers these when the system key is over quota or the service is overloaded. */
const BUSY_STATUS_CODES: ReadonlySet<number> = new Set([429, 503]);

/**
 * `streamText` in `ai` 7.0.126 aborts with a `DOMException` of this name when
 * `timeout.totalMs` (`AbortSignal.timeout`) or `timeout.stepMs`
 * (`setAbortTimeout`) expires. A client disconnect aborts with `AbortError`.
 */
const STREAM_TIMEOUT_ERROR_NAME = "TimeoutError";

/** The whole-turn check failed or the turn's output is over its size limit. */
export class AiTurnInvalidError extends Error {
  override readonly name = "AiTurnInvalidError";
}

/**
 * Maps any error of an AI turn to a stable stream error code. Reads only the
 * error's class, status code and name, never its message, which may carry the
 * provider URL, headers or parts of the prompt.
 */
export function toAiStreamErrorCode(error: unknown): AiStreamErrorCode {
  if (error instanceof AiTurnInvalidError) {
    return "ai-output-invalid";
  }
  if (RetryError.isInstance(error)) {
    return toAiStreamErrorCode(error.lastError);
  }
  if (isBusyProviderError(error)) {
    return "ai-upstream-busy";
  }
  if (
    error instanceof DOMException &&
    error.name === STREAM_TIMEOUT_ERROR_NAME
  ) {
    return "ai-timeout";
  }
  if (AISDKError.isInstance(error)) {
    return "ai-upstream-failed";
  }
  return "internal-error";
}

function isBusyProviderError(error: unknown): boolean {
  return (
    APICallError.isInstance(error) &&
    error.statusCode !== undefined &&
    BUSY_STATUS_CODES.has(error.statusCode)
  );
}
