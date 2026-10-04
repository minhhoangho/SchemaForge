import {
  type AiStreamErrorCode,
  isAiStreamErrorCode,
} from "@schemaforge/api-contract";
import type { GenerateId } from "@schemaforge/core";
import {
  isStepCount,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type StepResult,
  streamText,
  type TextStreamPart,
  type ToolSet,
  toUIMessageStream,
  type UIMessageStreamWriter,
} from "ai";

import {
  AI_MAX_OUTPUT_TOKENS,
  AI_MAX_RETRIES,
  AI_MAX_STEPS,
  AI_TIMEOUT,
} from "./ai.constants.js";
import { AI_INSTRUCTIONS } from "./ai.instructions.js";
import { AiTurnInvalidError, toAiStreamErrorCode } from "./ai-stream-errors.js";
import { createAiChunkFilter } from "./ai-stream-filter.js";
import { type AiTurnState, buildAiTools } from "./ai-tools.js";
import { type AiTurnInvalidReason, buildAiTurnParts } from "./ai-turn-parts.js";

/** The outcome kinds of the AI-R31 log line. */
export type AiTurnOutcome =
  "proposal" | "sampleData" | "findings" | "text" | "aborted" | "error";

/** Filled while the turn runs; `AiChatService` logs it in its finally. */
export type AiTurnReport = {
  outcome: AiTurnOutcome;
  errorCode?: AiStreamErrorCode;
  stepCount?: number;
  finishReason?: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type AiTurnRun = {
  readonly model: LanguageModel;
  readonly messages: readonly ModelMessage[];
  readonly abortSignal: AbortSignal;
  readonly state: AiTurnState;
  readonly generateId: GenerateId;
  readonly writer: UIMessageStreamWriter;
  readonly report: AiTurnReport;
  readonly onStreamError: (error: unknown) => void;
  readonly onTurnInvalid: (reason: AiTurnInvalidReason) => void;
};

type ModelAbort = { readonly reason: unknown; readonly stepCount: number };

/**
 * Writes the filtered model text chunk by chunk (plan Vấn đề 6, no merge, so
 * nothing overtakes it) and stops at an error chunk, the last chunk of a
 * failed turn (Vấn đề 7). Returns that chunk's code, or null.
 */
async function forwardModelText(
  stream: ReadableStream<TextStreamPart<ToolSet>>,
  writer: UIMessageStreamWriter,
): Promise<AiStreamErrorCode | null> {
  const chunks = toUIMessageStream({
    stream,
    // sendReasoning defaults to true in ai 7.0.126 (AI-R58).
    sendReasoning: false,
    sendSources: false,
    sendStart: true,
    sendFinish: false,
    onError: toAiStreamErrorCode,
  }).pipeThrough(createAiChunkFilter());
  for await (const chunk of chunks) {
    writer.write(chunk);
    if (chunk.type === "error") {
      return isAiStreamErrorCode(chunk.errorText)
        ? chunk.errorText
        : "internal-error";
    }
  }
  return null;
}

// AI-R19: the step limit ended the loop while the model was still calling tools.
function isStoppedEarly(steps: readonly StepResult<ToolSet>[]): boolean {
  const last = steps.at(-1);
  return (
    steps.length >= AI_MAX_STEPS &&
    last !== undefined &&
    last.toolCalls.length > 0
  );
}

function outcomeOf(state: AiTurnState): AiTurnOutcome {
  if (state.operations.length > 0) {
    return "proposal";
  }
  if (state.sampleData !== null) {
    return "sampleData";
  }
  return state.findings.length > 0 ? "findings" : "text";
}

/**
 * Runs the model with the turn's tools and writes the turn to `writer`:
 * text, then the checked data parts and `finish` (AI-R22). A client abort
 * writes nothing more (AI-R50); a timeout aborts the model call without an
 * error part, so its code is written here from the onAbort reason.
 */
export async function runAiTurn(run: AiTurnRun): Promise<void> {
  const { state, writer, report } = run;
  // Set from a callback, so it is an object TypeScript does not narrow to null.
  const modelAbort: { current: ModelAbort | null } = { current: null };
  const result = streamText({
    model: run.model,
    instructions: AI_INSTRUCTIONS,
    messages: [...run.messages],
    tools: buildAiTools(state, run.generateId),
    stopWhen: isStepCount(AI_MAX_STEPS),
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    maxRetries: AI_MAX_RETRIES,
    timeout: AI_TIMEOUT,
    abortSignal: run.abortSignal,
    telemetry: { isEnabled: false },
    onError: ({ error }) => {
      run.onStreamError(error);
    },
    onAbort: (event) => {
      modelAbort.current = {
        reason: event.reason,
        stepCount: event.steps.length,
      };
    },
  });
  const errorCode = await forwardModelText(result.stream, writer);
  if (errorCode !== null) {
    report.errorCode = errorCode;
    return;
  }
  if (run.abortSignal.aborted || modelAbort.current !== null) {
    finishAborted(run, modelAbort.current);
    return;
  }
  const [steps, usage] = await Promise.all([result.steps, result.usage]);
  finishCompleted(run, steps, usage);
}

// Checks the whole turn, then writes its data parts and `finish` (AI-R17,
// AI-R22); a failed check ends the stream with ai-output-invalid instead.
function finishCompleted(
  run: AiTurnRun,
  steps: readonly StepResult<ToolSet>[],
  usage: LanguageModelUsage,
): void {
  const { state, writer, report } = run;
  report.stepCount = steps.length;
  report.finishReason = steps.at(-1)?.finishReason;
  report.inputTokens = usage.inputTokens;
  report.outputTokens = usage.outputTokens;
  const parts = buildAiTurnParts(state, isStoppedEarly(steps));
  if (!parts.isOk) {
    run.onTurnInvalid(parts.error);
    throw new AiTurnInvalidError();
  }
  parts.value.forEach((part) => {
    writer.write(part);
  });
  writer.write({ type: "finish" });
  report.outcome = outcomeOf(state);
}

function finishAborted(run: AiTurnRun, modelAbort: ModelAbort | null): void {
  run.report.stepCount = modelAbort?.stepCount;
  if (run.abortSignal.aborted) {
    run.report.outcome = "aborted";
    return;
  }
  const code = toAiStreamErrorCode(modelAbort?.reason);
  run.report.errorCode = code;
  run.writer.write({ type: "error", errorText: code });
}
