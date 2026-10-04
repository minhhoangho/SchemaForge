import { convertReadableStreamToArray } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  chatRequest,
  chunkTypes,
  createAbortingModel,
  createHangingModel,
  loggedText,
  providerError,
  renameCall,
  runChatTurn,
  SCHEMA_NAME,
  SENTINEL,
  setupChat,
  spyOnLogger,
  TEXT_STEP,
  toolStep,
  USER_ID,
} from "../../../test/ai-chat-fixtures.js";
import {
  createFailingModel,
  createScriptedModel,
} from "../../../test/mock-ai-model.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AiChatService abort", () => {
  it("abort reaches the model call", async () => {
    const controller = new AbortController();
    const model = createAbortingModel(() => {
      controller.abort();
    });

    const chunks = await runChatTurn(model, controller.signal);

    expect(model.doStreamCalls[0]?.abortSignal?.aborted).toBe(true);
    expect(chunkTypes(chunks)).not.toContain("data-proposal");
    expect(chunkTypes(chunks)).not.toContain("finish");
    expect(chunkTypes(chunks)).not.toContain("error");
  });

  it("frees the stream lock as soon as the request is aborted", async () => {
    const { service, capacity } = await setupChat(createHangingModel());
    const controller = new AbortController();
    const stream = await service.chat(
      USER_ID,
      chatRequest(),
      controller.signal,
    );

    controller.abort();

    expect(capacity.tryAcquireStream(USER_ID)).not.toBeNull();
    await convertReadableStreamToArray(stream);
  });
});

describe("AiChatService logging", () => {
  it("logs one completion line without message text, schema or key", async () => {
    const { service } = await setupChat(
      createScriptedModel([toolStep(renameCall("call-1", "store")), TEXT_STEP]),
    );
    const logger = spyOnLogger();

    await convertReadableStreamToArray(
      await service.chat(USER_ID, chatRequest(), new AbortController().signal),
    );

    expect(logger.log).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalledWith({
      event: "ai.chat.completed",
      userId: USER_ID,
      durationMs: 250,
      stepCount: 2,
      toolCallCount: 1,
      successfulToolCallCount: 1,
      finishReason: "stop",
      inputTokens: 240,
      outputTokens: 60,
      outcome: "proposal",
      errorCode: undefined,
    });
    expect(loggedText(logger)).not.toContain("fixture-message-text");
    expect(loggedText(logger)).not.toContain(SCHEMA_NAME);
    expect(loggedText(logger)).not.toContain("test-gemini-key-not-real");
  });

  it("logs a failed turn with its error code only", async () => {
    const logger = spyOnLogger();

    await runChatTurn(createFailingModel(providerError(400)));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ai.chat.failed",
        outcome: "error",
        errorCode: "ai-upstream-failed",
      }),
    );
  });

  it("keeps the provider error body and prompt out of every log line", async () => {
    const logger = spyOnLogger();

    await runChatTurn(createFailingModel(providerError(400)));

    expect(logger.warn).toHaveBeenCalledWith({
      event: "ai.chat.stream-error",
      code: "ai-upstream-failed",
      errorName: "AI_APICallError",
      statusCode: 400,
    });
    expect(loggedText(logger)).not.toContain(SENTINEL);
    expect(loggedText(logger)).not.toContain("fixture-message-text");
  });

  it("logs an aborted turn as aborted", async () => {
    const logger = spyOnLogger();
    const controller = new AbortController();

    await runChatTurn(
      createAbortingModel(() => {
        controller.abort();
      }),
      controller.signal,
    );

    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ai.chat.completed",
        outcome: "aborted",
      }),
    );
  });
});
