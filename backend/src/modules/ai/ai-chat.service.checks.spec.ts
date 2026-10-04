import { Logger } from "@nestjs/common";
import {
  AI_MAX_SCHEMA_PROMPT_LENGTH,
  type AiChatRequest,
} from "@schemaforge/api-contract";
import type { LanguageModel } from "ai";
import { convertReadableStreamToArray } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  chatRequest,
  createAbortingModel,
  createHangingModel,
  createThrowingStreamModel,
  documentWithTableComment,
  providerError,
  SCHEMA,
  setupChat,
  TEXT_STEP,
  USER_ID,
} from "../../../test/ai-chat-fixtures.js";
import {
  createFailingModel,
  createScriptedModel,
} from "../../../test/mock-ai-model.js";
import { ApiException } from "../../common/api.exception.js";

const OTHER_USER_ID = "user-2";

function tooLargeSchemaRequest(): AiChatRequest {
  return chatRequest(
    documentWithTableComment("a".repeat(AI_MAX_SCHEMA_PROMPT_LENGTH)),
  );
}

function retryAfterOf(error: unknown): number | null {
  return error instanceof ApiException ? error.retryAfterSeconds : null;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AiChatService checks before the stream", () => {
  it("rejects with ai-unavailable when the model is null", async () => {
    const { service } = await setupChat(null);

    await expect(
      service.chat(USER_ID, chatRequest(), new AbortController().signal),
    ).rejects.toMatchObject({
      body: { statusCode: 503, code: "ai-unavailable" },
    });
  });

  it("rejects an invalid document with document-invalid", async () => {
    const { service } = await setupChat(createScriptedModel([TEXT_STEP]));

    await expect(
      service.chat(
        USER_ID,
        chatRequest({ version: 999 }),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      body: {
        statusCode: 422,
        code: "document-invalid",
        documentErrors: [{ code: "version-unsupported", path: ["version"] }],
      },
    });
  });

  it("rejects a schema over the prompt limit with ai-schema-too-large", async () => {
    const { service } = await setupChat(createScriptedModel([TEXT_STEP]));

    await expect(
      service.chat(
        USER_ID,
        tooLargeSchemaRequest(),
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({
      body: { statusCode: 413, code: "ai-schema-too-large" },
    });
  });

  it("rejects 413 when escaping or issues push the prompt over the cap", async () => {
    const { service } = await setupChat(createScriptedModel([TEXT_STEP]), 1);
    const document = documentWithTableComment(
      "<".repeat(AI_MAX_SCHEMA_PROMPT_LENGTH / 4),
    );
    const tooLarge = { body: { statusCode: 413, code: "ai-schema-too-large" } };
    const signal = new AbortController().signal;

    await expect(
      service.chat(USER_ID, chatRequest(document), signal),
    ).rejects.toMatchObject(tooLarge);
    await expect(
      service.chat(USER_ID, chatRequest(document), signal),
    ).rejects.toMatchObject(tooLarge);
    await expect(
      convertReadableStreamToArray(
        await service.chat(USER_ID, chatRequest(), signal),
      ),
    ).resolves.toContainEqual({ type: "finish" });
  });

  it("rejects a history too long after escaping with payload-too-large", async () => {
    const { service, capacity } = await setupChat(
      createScriptedModel([TEXT_STEP]),
    );
    const request: AiChatRequest = {
      document: SCHEMA,
      messages: [
        { role: "assistant", text: "<".repeat(8000) },
        { role: "assistant", text: "<".repeat(8000) },
        { role: "assistant", text: "<".repeat(8000) },
        { role: "assistant", text: "<".repeat(8000) },
        { role: "user", text: "hi" },
      ],
      locale: "en",
    };

    await expect(
      service.chat(USER_ID, request, new AbortController().signal),
    ).rejects.toMatchObject({
      body: { statusCode: 413, code: "payload-too-large" },
    });
    expect(capacity.tryAcquireStream(USER_ID)).not.toBeNull();
  });

  it("spends no budget and holds no lock when the request was aborted before the turn", async () => {
    const model = createScriptedModel([TEXT_STEP]);
    const { service, capacity } = await setupChat(model, 1);
    const controller = new AbortController();
    controller.abort();

    const chunks = await convertReadableStreamToArray(
      await service.chat(USER_ID, chatRequest(), controller.signal),
    );

    expect(chunks).toStrictEqual([]);
    expect(model.doStreamCalls).toHaveLength(0);
    expect(capacity.tryAcquireStream(OTHER_USER_ID)).not.toBeNull();
    await expect(capacity.tryConsumeGlobalBudget()).resolves.toStrictEqual({
      isAllowed: true,
    });
  });
});

describe("AiChatService capacity", () => {
  it("rejects a second concurrent turn of the same user with too-many-requests and retry after 10 seconds", async () => {
    const { service } = await setupChat(createHangingModel());
    const controller = new AbortController();
    const first = await service.chat(USER_ID, chatRequest(), controller.signal);

    const second = service.chat(USER_ID, chatRequest(), controller.signal);

    await expect(second).rejects.toMatchObject({
      body: { statusCode: 429, code: "too-many-requests" },
      retryAfterSeconds: 10,
    });
    controller.abort();
    await convertReadableStreamToArray(first);
  });

  it("checks the stream lock before parsing the document", async () => {
    const { service } = await setupChat(createHangingModel());
    const controller = new AbortController();
    const first = await service.chat(USER_ID, chatRequest(), controller.signal);

    const second = service.chat(
      USER_ID,
      chatRequest({ version: 999 }),
      controller.signal,
    );

    await expect(second).rejects.toMatchObject({
      body: { code: "too-many-requests" },
    });
    controller.abort();
    await convertReadableStreamToArray(first);
  });

  it("releases the lock when building the prompt throws", async () => {
    const { service, capacity } = await setupChat(
      createScriptedModel([TEXT_STEP]),
    );

    await service
      .chat(USER_ID, tooLargeSchemaRequest(), new AbortController().signal)
      .catch(() => undefined);

    expect(capacity.tryAcquireStream(USER_ID)).not.toBeNull();
  });

  it("releases the lock when the budget check rejects, with Retry-After", async () => {
    vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const { service, capacity } = await setupChat(
      createScriptedModel([TEXT_STEP]),
      1,
    );
    const signal = new AbortController().signal;
    await convertReadableStreamToArray(
      await service.chat(OTHER_USER_ID, chatRequest(), signal),
    );

    const rejected: unknown = await service
      .chat(USER_ID, chatRequest(), signal)
      .catch((error: unknown) => error);

    expect(rejected).toMatchObject({
      body: { statusCode: 503, code: "ai-unavailable" },
    });
    expect(retryAfterOf(rejected)).toBeGreaterThan(0);
    expect(capacity.tryAcquireStream(USER_ID)).not.toBeNull();
  });

  it.each<[string, () => LanguageModel]>([
    ["a provider error", () => createFailingModel(providerError(400))],
    ["a model stream that throws mid-stream", createThrowingStreamModel],
  ])(
    "releases the stream lock after a failed turn (%s)",
    async (_label, model) => {
      vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      const { service, capacity } = await setupChat(model());

      await convertReadableStreamToArray(
        await service.chat(
          USER_ID,
          chatRequest(),
          new AbortController().signal,
        ),
      );

      expect(capacity.tryAcquireStream(USER_ID)).not.toBeNull();
    },
  );

  it("releases the stream lock after an aborted turn", async () => {
    const controller = new AbortController();
    const { service, capacity } = await setupChat(
      createAbortingModel(() => {
        controller.abort();
      }),
    );

    await convertReadableStreamToArray(
      await service.chat(USER_ID, chatRequest(), controller.signal),
    );

    expect(capacity.tryAcquireStream(USER_ID)).not.toBeNull();
  });
});
