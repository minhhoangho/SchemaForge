import {
  authUserResponseSchema,
  MAX_SCHEMAS_PER_USER,
  parseApiErrorBody,
  schemaListSchema,
  schemaSummarySchema,
} from "@schemaforge/api-contract";
import type { SchemaDocument } from "@schemaforge/core";
import { buildSchema } from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { createFakeApiBackend } from "./fake-api-backend";
import type { FakeApiBackend } from "./fake-api-backend";

const ORIGIN = "http://api.test";
const EMAIL = "user@example.com";
const PASSWORD = "stapler-42";
const OTHER_EMAIL = "other@example.com";
const SCHEMA_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_SCHEMA_ID = "22222222-2222-4222-8222-222222222222";
const ID_PREFIX = "33333333-3333-4333-8333-";
const ID_SUFFIX_LENGTH = 12;

function createCounter(): () => number {
  let count = 0;
  return () => {
    count += 1;
    return count;
  };
}

function createBackend(): FakeApiBackend {
  return createFakeApiBackend({ clock: createCounter() });
}

function createDocument(name = "shop"): SchemaDocument {
  return buildSchema({ name });
}

async function readJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  return body;
}

function send(
  backend: FakeApiBackend,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return backend.fetch(
    new URL(path, ORIGIN),
    body === undefined ? { method } : { method, body: JSON.stringify(body) },
  );
}

async function signIn(backend: FakeApiBackend): Promise<string> {
  const userId = backend.seedUser({ email: EMAIL, password: PASSWORD });
  await send(backend, "POST", "/auth/login", {
    email: EMAIL,
    password: PASSWORD,
  });
  return userId;
}

function nthSchemaId(index: number): string {
  return `${ID_PREFIX}${String(index).padStart(ID_SUFFIX_LENGTH, "0")}`;
}

function seedManySchemas(
  backend: FakeApiBackend,
  ownerId: string,
  count: number,
): void {
  Array.from({ length: count }, (_unused, index) => index).forEach((index) => {
    backend.seedSchema({
      ownerId,
      id: nthSchemaId(index),
      document: createDocument(`shop-${String(index)}`),
    });
  });
}

describe("createFakeApiBackend", () => {
  it("registers a user and returns a response matching the contract", async () => {
    const backend = createBackend();

    const response = await send(backend, "POST", "/auth/register", {
      email: EMAIL,
      password: PASSWORD,
    });

    expect({
      status: response.status,
      body: authUserResponseSchema.safeParse(await readJson(response)).success,
    }).toEqual({ status: 201, body: true });
  });

  it("returns the same error for an unknown email and a wrong password", async () => {
    const backend = createBackend();
    backend.seedUser({ email: EMAIL, password: PASSWORD });

    const unknownEmail = await send(backend, "POST", "/auth/login", {
      email: OTHER_EMAIL,
      password: PASSWORD,
    });
    const wrongPassword = await send(backend, "POST", "/auth/login", {
      email: EMAIL,
      password: "no-match",
    });

    expect([
      { status: unknownEmail.status, body: await readJson(unknownEmail) },
      { status: wrongPassword.status, body: await readJson(wrongPassword) },
    ]).toEqual([
      { status: 401, body: { statusCode: 401, code: "invalid-credentials" } },
      { status: 401, body: { statusCode: 401, code: "invalid-credentials" } },
    ]);
  });

  it("returns 401 for a private route without a session", async () => {
    const backend = createBackend();

    const response = await send(backend, "GET", "/schemas");

    expect({ status: response.status, body: await readJson(response) }).toEqual(
      {
        status: 401,
        body: { statusCode: 401, code: "unauthenticated" },
      },
    );
  });

  it("creates a schema with revision 1", async () => {
    const backend = createBackend();
    await signIn(backend);

    const response = await send(backend, "POST", "/schemas", {
      id: SCHEMA_ID,
      document: createDocument(),
    });
    const summary = schemaSummarySchema.parse(await readJson(response));

    expect({
      status: response.status,
      revision: summary.revision,
      name: summary.name,
      stored: backend.getStoredSchema(SCHEMA_ID)?.revision ?? null,
    }).toEqual({ status: 201, revision: 1, name: "shop", stored: 1 });
  });

  it("returns 409 schema-id-unavailable for an existing id", async () => {
    const backend = createBackend();
    const userId = await signIn(backend);
    backend.seedSchema({
      ownerId: userId,
      id: SCHEMA_ID,
      document: createDocument(),
    });

    const response = await send(backend, "POST", "/schemas", {
      id: SCHEMA_ID,
      document: createDocument("other"),
    });

    expect({ status: response.status, body: await readJson(response) }).toEqual(
      {
        status: 409,
        body: { statusCode: 409, code: "schema-id-unavailable" },
      },
    );
  });

  it("returns 409 revision-conflict with the current revision", async () => {
    const backend = createBackend();
    const userId = await signIn(backend);
    backend.seedSchema({
      ownerId: userId,
      id: SCHEMA_ID,
      document: createDocument(),
    });
    backend.writeFromOtherDevice(SCHEMA_ID, createDocument("newer"));

    const response = await send(backend, "PUT", `/schemas/${SCHEMA_ID}`, {
      document: createDocument("mine"),
      expectedRevision: 1,
    });

    expect({ status: response.status, body: await readJson(response) }).toEqual(
      {
        status: 409,
        body: {
          statusCode: 409,
          code: "revision-conflict",
          currentRevision: 2,
        },
      },
    );
  });

  it("returns 404 for a schema of another user", async () => {
    const backend = createBackend();
    await signIn(backend);
    const otherUserId = backend.seedUser({
      email: OTHER_EMAIL,
      password: PASSWORD,
    });
    backend.seedSchema({
      ownerId: otherUserId,
      id: OTHER_SCHEMA_ID,
      document: createDocument(),
    });

    const response = await send(backend, "GET", `/schemas/${OTHER_SCHEMA_ID}`);

    expect({ status: response.status, body: await readJson(response) }).toEqual(
      {
        status: 404,
        body: { statusCode: 404, code: "not-found" },
      },
    );
  });

  it("returns 403 after 100 schemas", async () => {
    const backend = createBackend();
    const userId = await signIn(backend);
    seedManySchemas(backend, userId, MAX_SCHEMAS_PER_USER);

    const response = await send(backend, "POST", "/schemas", {
      id: SCHEMA_ID,
      document: createDocument(),
    });

    expect({ status: response.status, body: await readJson(response) }).toEqual(
      {
        status: 403,
        body: { statusCode: 403, code: "schema-limit-reached" },
      },
    );
  });

  it("pages the schema list with a cursor", async () => {
    const backend = createBackend();
    const userId = await signIn(backend);
    seedManySchemas(backend, userId, 3);

    const firstPage = schemaListSchema.parse(
      await readJson(await send(backend, "GET", "/schemas?limit=2")),
    );
    const secondPage = schemaListSchema.parse(
      await readJson(
        await send(
          backend,
          "GET",
          `/schemas?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor ?? "")}`,
        ),
      ),
    );

    expect({
      first: firstPage.items.map((item) => item.name),
      hasCursor: firstPage.nextCursor !== null,
      second: secondPage.items.map((item) => item.name),
      secondCursor: secondPage.nextCursor,
    }).toEqual({
      first: ["shop-2", "shop-1"],
      hasCursor: true,
      second: ["shop-0"],
      secondCursor: null,
    });
  });

  it("rejects a structurally invalid document with 422", async () => {
    const backend = createBackend();
    await signIn(backend);

    const response = await send(backend, "POST", "/schemas", {
      id: SCHEMA_ID,
      document: { name: 42 },
    });
    const body = parseApiErrorBody(await readJson(response));

    expect({
      status: response.status,
      code: body?.code,
      hasErrors:
        body?.code === "document-invalid" && body.documentErrors.length > 0,
      stored: backend.getStoredSchema(SCHEMA_ID),
    }).toEqual({
      status: 422,
      code: "document-invalid",
      hasErrors: true,
      stored: null,
    });
  });

  it("rejects every request while offline and still records it", async () => {
    const backend = createBackend();
    backend.setOffline(true);

    const rejection = await send(backend, "GET", "/auth/me").catch(
      (cause: unknown) => cause,
    );

    expect({
      isTypeError: rejection instanceof TypeError,
      requests: backend.requests.map((request) => ({
        method: request.method,
        path: request.path,
      })),
    }).toEqual({
      isTypeError: true,
      requests: [{ method: "GET", path: "/auth/me" }],
    });
  });

  it("bumps the revision on a write from another device", async () => {
    const backend = createBackend();
    const userId = await signIn(backend);
    backend.seedSchema({
      ownerId: userId,
      id: SCHEMA_ID,
      document: createDocument(),
    });

    backend.writeFromOtherDevice(SCHEMA_ID, createDocument("renamed"));

    expect({
      revision: backend.getStoredSchema(SCHEMA_ID)?.revision,
      name: backend.getStoredSchema(SCHEMA_ID)?.document.name,
    }).toEqual({ revision: 2, name: "renamed" });
  });

  it("answers POST /ai/chat with the queued turn", async () => {
    const backend = createBackend();
    await signIn(backend);
    backend.queueAiTurn({ text: "Hello" });

    const response = await send(backend, "POST", "/ai/chat", { messages: [] });
    const body = await response.text();

    expect({
      status: response.status,
      type: response.headers.get("content-type"),
      hasText: body.includes('"delta":"'),
      hasFinish: body.includes('"type":"finish"'),
    }).toEqual({
      status: 200,
      type: "text/event-stream",
      hasText: true,
      hasFinish: true,
    });
  });

  it("answers POST /ai/chat with an error chunk when no turn is queued", async () => {
    const backend = createBackend();
    await signIn(backend);

    const response = await send(backend, "POST", "/ai/chat", { messages: [] });

    expect(await response.text()).toContain('"errorText":"internal-error"');
  });

  it("answers POST /ai/chat with 401 without a session", async () => {
    const backend = createBackend();
    backend.queueAiTurn({ text: "Hello" });

    const response = await send(backend, "POST", "/ai/chat", { messages: [] });

    expect({ status: response.status, body: await readJson(response) }).toEqual(
      { status: 401, body: { statusCode: 401, code: "unauthenticated" } },
    );
  });
});
