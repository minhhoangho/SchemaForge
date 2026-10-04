import type * as CoreAi from "@schemaforge/core/ai";
import { ConsoleLogger } from "@nestjs/common";
import {
  type AiChatRequest,
  aiProposalDataSchema,
} from "@schemaforge/api-contract";
import { buildSchema, makeColumn, makeTable } from "@schemaforge/core/testing";
import {
  APICallError,
  type LanguageModel,
  UI_MESSAGE_STREAM_HEADERS,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AI_GLOBAL_REQUESTS_PER_HOUR,
  AI_LANGUAGE_MODEL,
} from "../src/modules/ai/ai-model.provider.js";
import {
  chatRequest,
  MESSAGE_TEXT,
  renameCall,
  SCHEMA,
  SCHEMA_NAME,
  TEXT_STEP,
  toolStep,
} from "./ai-chat-fixtures.js";
import { createTestApp, type TestApp } from "./create-test-app.js";
import { registerUser } from "./factories.js";
import { createHttpClient, type HttpClient } from "./http-client.js";
import {
  createFailingModel,
  createScriptedModel,
  type ProviderStreamPart,
  type ScriptedStep,
} from "./mock-ai-model.js";
import { lastResponse, readBody, retryAfterSeconds } from "./response-facts.js";

// Lets a test make the edit tools throw an internal error (see the tool test).
const coreAiControl = vi.hoisted((): { failWith: Error | null } => ({
  failWith: null,
}));
vi.mock("@schemaforge/core/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof CoreAi>();
  return {
    ...actual,
    applyAiEdit: (...args: Parameters<typeof actual.applyAiEdit>) => {
      if (coreAiControl.failWith !== null) {
        throw coreAiControl.failWith;
      }
      return actual.applyAiEdit(...args);
    },
  };
});

const FAKE_GEMINI_CREDENTIAL = "test-gemini-key-not-real";
const PROVIDER_ERROR_MESSAGE = "provider-error-message-fixture";
const INVALID_DOCUMENT = {};

function invalidChat(): AiChatRequest {
  return { ...chatRequest(), document: INVALID_DOCUMENT };
}

async function postRepeatedly(
  client: HttpClient,
  count: number,
  body: unknown = invalidChat(),
): Promise<Response[]> {
  const responses: Response[] = [];
  for (let index = 0; index < count; index += 1) {
    responses.push(await post(client, body));
  }
  return responses;
}

function post(client: HttpClient, body: unknown): Promise<Response> {
  return client.request("POST", "/ai/chat", { body });
}

async function signedIn(testApp: TestApp, label: string): Promise<HttpClient> {
  const client = createHttpClient(testApp.app);
  await registerUser(client, label);
  return client;
}

function modelOverride(
  model: LanguageModel | null,
  budget?: number,
): NonNullable<Parameters<typeof createTestApp>[0]>["overrideProviders"] {
  return [
    { token: AI_LANGUAGE_MODEL, value: model },
    ...(budget === undefined
      ? []
      : [{ token: AI_GLOBAL_REQUESTS_PER_HOUR, value: budget }]),
  ];
}

function textModel(turns = 1): LanguageModel {
  return createScriptedModel(Array.from({ length: turns }, () => TEXT_STEP));
}

/** The `data:` payloads of an SSE body, without the `[DONE]` marker. */
function sseChunks(response: Response): readonly Record<string, unknown>[] {
  return response.text
    .split("\n")
    .filter((line) => line.startsWith("data: ") && !line.endsWith("[DONE]"))
    .map((line): unknown => JSON.parse(line.slice("data: ".length)))
    .filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A model that answers `step` only once the test opens the gate. */
function createGatedModel(step: ScriptedStep): {
  readonly model: MockLanguageModelV4;
  readonly open: () => void;
} {
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const model = new MockLanguageModelV4({
    doStream: () =>
      Promise.resolve({
        stream: new ReadableStream<ProviderStreamPart>({
          async start(controller) {
            await gate;
            controller.enqueue({ type: "stream-start", warnings: [] });
            step.forEach((chunk) => {
              controller.enqueue(chunk);
            });
            controller.close();
          },
        }),
      }),
  });
  return { model, open };
}

async function waitForModelCall(model: MockLanguageModelV4): Promise<void> {
  await vi.waitFor(() => {
    expect(model.doStreamCalls).toHaveLength(1);
  });
}

describe("POST /ai/chat e2e", () => {
  let testApp: TestApp | null = null;
  let captured: string[] = [];

  async function start(
    model: LanguageModel | null,
    budget?: number,
  ): Promise<TestApp> {
    testApp = await createTestApp({
      overrideProviders: modelOverride(model, budget),
    });
    return testApp;
  }

  function captureConsole(): void {
    // The testing module only logs errors; switch on the levels the app logs.
    testApp?.app.useLogger(new ConsoleLogger());
    const record = (...args: unknown[]): boolean => {
      captured.push(args.map((arg) => String(arg)).join(" "));
      return true;
    };
    vi.spyOn(process.stdout, "write").mockImplementation(record);
    vi.spyOn(process.stderr, "write").mockImplementation(record);
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation(record);
    }
  }

  beforeEach(() => {
    captured = [];
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    coreAiControl.failWith = null;
    await testApp?.close();
    testApp = null;
  });

  describe("before the stream", () => {
    it("answers 401 without a session", async () => {
      const { app } = await start(textModel());
      const response = await post(createHttpClient(app), chatRequest());
      expect([response.status, readBody(response)]).toStrictEqual([
        401,
        { statusCode: 401, code: "unauthenticated" },
      ]);
    });

    it("answers 403 origin-not-allowed for a foreign Origin", async () => {
      const app = await start(textModel());
      const client = await signedIn(app, "origin");
      const response = await client.request("POST", "/ai/chat", {
        body: chatRequest(),
        origin: "https://evil.example.com",
      });
      expect([response.status, readBody(response)]).toStrictEqual([
        403,
        { statusCode: 403, code: "origin-not-allowed" },
      ]);
    });

    it("answers 422 document-invalid for a document with a __proto__ key", async () => {
      const app = await start(textModel());
      const client = await signedIn(app, "proto");
      const response = await client.request("POST", "/ai/chat", {
        rawBody: `{"document":{"__proto__":{"x":1}},"messages":[{"role":"user","text":"hi"}],"locale":"en"}`,
      });
      expect([response.status, response.body]).toMatchObject([
        422,
        { code: "document-invalid" },
      ]);
    });

    it("answers 400 validation-failed for a history over the limit", async () => {
      const app = await start(textModel());
      const client = await signedIn(app, "history");
      const long = "x".repeat(8000);
      const messages = [
        ...Array.from({ length: 8 }, (_, index) => ({
          role: index % 2 === 0 ? "user" : "assistant",
          text: long,
        })),
        { role: "user", text: "y".repeat(4000) },
      ];
      const response = await post(client, {
        ...chatRequest(),
        messages,
      });
      expect([response.status, response.body]).toMatchObject([
        400,
        { code: "validation-failed" },
      ]);
    });

    it("answers 413 ai-schema-too-large for a schema over the prompt limit", async () => {
      const app = await start(textModel());
      const client = await signedIn(app, "large");
      const tables = Array.from({ length: 200 }, (_, index) =>
        makeTable({ id: `tbl_${String(index)}` }),
      );
      const columns = tables.flatMap((table) =>
        Array.from({ length: 10 }, (_, index) =>
          makeColumn({
            id: `col_${table.id}_${String(index)}`,
            tableId: table.id,
            name: `column_with_a_long_name_${String(index)}`,
          }),
        ),
      );
      const response = await post(
        client,
        chatRequest(buildSchema({ name: "big", tables, columns })),
      );
      expect([response.status, response.body]).toMatchObject([
        413,
        { code: "ai-schema-too-large" },
      ]);
    });

    it("answers 503 ai-unavailable when no model is configured", async () => {
      const app = await start(null);
      const client = await signedIn(app, "nomodel");
      const response = await post(client, chatRequest());
      expect([response.status, response.body]).toMatchObject([
        503,
        { code: "ai-unavailable" },
      ]);
    });

    it("answers 429 with Retry-After on the 11th request of one user in a minute and leaves another user unaffected", async () => {
      const app = await start(textModel());
      const first = await signedIn(app, "first");
      const second = await signedIn(app, "second");
      const responses = await postRepeatedly(first, 11);
      const last = lastResponse(responses);
      const other = await post(second, invalidChat());
      expect(
        responses.slice(0, 10).every((response) => response.status === 422),
      ).toBe(true);
      expect([last.status, readBody(last), other.status]).toStrictEqual([
        429,
        { statusCode: 429, code: "too-many-requests" },
        422,
      ]);
      expect(retryAfterSeconds(last)).toBeGreaterThan(0);
    });

    it("answers 429 on the 21st request in a minute from one IP across three accounts", async () => {
      const app = await start(textModel());
      const clients = await Promise.all(
        ["ip-a", "ip-b", "ip-c"].map((label) => signedIn(app, label)),
      );
      const responses: Response[] = [];
      for (let count = 0; count < 21; count += 1) {
        const client = clients[count % clients.length];
        if (client === undefined) {
          throw new Error("Expected a client");
        }
        responses.push(await post(client, invalidChat()));
      }
      expect(responses.map((response) => response.status)).toStrictEqual([
        ...Array.from({ length: 20 }, () => 422),
        429,
      ]);
    });

    it("answers 429 with Retry-After 10 to a second concurrent stream of the same user", async () => {
      const gated = createGatedModel(TEXT_STEP);
      const app = await start(gated.model);
      const client = await signedIn(app, "busy");
      const running = post(client, chatRequest());
      await waitForModelCall(gated.model);
      const second = await post(client, chatRequest());
      gated.open();
      const finished = await running;
      expect([
        second.status,
        readBody(second),
        retryAfterSeconds(second),
        finished.status,
      ]).toStrictEqual([
        429,
        { statusCode: 429, code: "too-many-requests" },
        10,
        200,
      ]);
    });

    it("answers 429 to a second concurrent stream even when its document is invalid", async () => {
      const gated = createGatedModel(TEXT_STEP);
      const app = await start(gated.model);
      const client = await signedIn(app, "busy-invalid");
      const running = post(client, chatRequest());
      await waitForModelCall(gated.model);
      const second = await post(client, invalidChat());
      gated.open();
      await running;
      expect(second.status).toBe(429);
    });

    it("answers 503 ai-unavailable once the global budget is spent", async () => {
      const app = await start(textModel(3), 2);
      const client = await signedIn(app, "budget");
      const responses = await postRepeatedly(client, 3, chatRequest());
      const last = lastResponse(responses);
      expect(responses.map((response) => response.status)).toStrictEqual([
        200, 200, 503,
      ]);
      expect(last.body).toMatchObject({ code: "ai-unavailable" });
      expect(retryAfterSeconds(last)).toBeGreaterThan(0);
    });
  });

  describe("the stream", () => {
    it("streams SSE with the AI SDK headers and data parts of the contract shape", async () => {
      const app = await start(
        createScriptedModel([
          toolStep(renameCall("call-1", "store")),
          TEXT_STEP,
        ]),
      );
      const client = await signedIn(app, "stream");
      const response = await post(client, chatRequest(SCHEMA));
      const proposal = sseChunks(response).find(
        (chunk) => chunk.type === "data-proposal",
      );
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/event-stream");
      for (const [name, value] of Object.entries(UI_MESSAGE_STREAM_HEADERS)) {
        expect(response.headers[name.toLowerCase()]).toBe(value);
      }
      expect(aiProposalDataSchema.safeParse(proposal?.data).success).toBe(true);
      expect(sseChunks(response).at(-1)).toStrictEqual({ type: "finish" });
    });

    it("sends only the ai-upstream-failed code in the raw SSE body after a provider error", async () => {
      const app = await start(createFailingModel(providerFailure()));
      const client = await signedIn(app, "failing");
      const response = await post(client, chatRequest());
      const chunks = sseChunks(response);
      expect(chunks.find((chunk) => chunk.type === "error")).toStrictEqual({
        type: "error",
        errorText: "ai-upstream-failed",
      });
      expect(
        chunks.some((chunk) => String(chunk.type).startsWith("tool-")),
      ).toBe(false);
      for (const secret of leakCandidates()) {
        expect(response.text).not.toContain(secret);
      }
      expect(response.text).not.toContain("reasoning");
    });
  });

  describe("leaks", () => {
    it("leaves no message text, schema or key in console output after a forced provider error", async () => {
      const app = await start(createFailingModel(providerFailure()));
      const client = await signedIn(app, "leak-provider");
      captureConsole();
      await post(client, chatRequest());
      const output = captured.join("\n");
      expect(output).toContain("ai.chat");
      for (const secret of leakCandidates()) {
        expect(output).not.toContain(secret);
      }
    });

    it("leaves no message text, schema or key in console output after a tool throws", async () => {
      coreAiControl.failWith = new Error(`internal failure ${SCHEMA_NAME}`);
      const app = await start(
        createScriptedModel([
          toolStep(renameCall("call-1", "store")),
          TEXT_STEP,
        ]),
      );
      const client = await signedIn(app, "leak-tool");
      captureConsole();
      const response = await post(client, chatRequest());
      const output = captured.join("\n");
      expect(output).toContain("ai.chat");
      for (const text of [output, response.text]) {
        expect(text).not.toContain(SCHEMA_NAME);
        expect(text).not.toContain(MESSAGE_TEXT);
        expect(text).not.toContain("internal failure");
      }
    });

    it("does not log request bodies", async () => {
      const app = await start(textModel());
      const client = await signedIn(app, "no-body-log");
      captureConsole();
      await post(client, chatRequest());
      expect(captured.length).toBeGreaterThan(0);
      expect(captured.join("\n")).not.toContain(MESSAGE_TEXT);
    });
  });
});

function providerFailure(): APICallError {
  return new APICallError({
    message: `${PROVIDER_ERROR_MESSAGE} ${MESSAGE_TEXT} ${SCHEMA_NAME}`,
    url: `https://provider.example.test/v1/models/test:stream?key=${FAKE_GEMINI_CREDENTIAL}`,
    requestBodyValues: {
      contents: [{ text: `${MESSAGE_TEXT} ${SCHEMA_NAME}` }],
    },
    statusCode: 400,
    responseBody: FAKE_GEMINI_CREDENTIAL,
  });
}

function leakCandidates(): readonly string[] {
  return [
    PROVIDER_ERROR_MESSAGE,
    MESSAGE_TEXT,
    SCHEMA_NAME,
    FAKE_GEMINI_CREDENTIAL,
  ];
}
