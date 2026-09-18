import { MAX_REQUEST_BODY_BYTES } from "@schemaforge/api-contract";
import type { SchemaDocument } from "@schemaforge/core";
import { createSampleSchema } from "@schemaforge/core/testing";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/lib/api/api-client";
import type { SessionRefresher } from "@/lib/api/session-refresher";
import { logger } from "@/lib/logger";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";

import { pushSchemaOnce } from "./push-schema-once";
import type { PushOutcome } from "./push-schema-once";

const BASE_URL = "https://api.schemaforge.invalid";
const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const OTHER_USER_ID = "6a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";
const SAMPLE_DOCUMENT = createSampleSchema();
const CHANGED_DOCUMENT: SchemaDocument = {
  ...SAMPLE_DOCUMENT,
  name: "Changed",
};

type Fixture = {
  readonly repository: SchemaRepository;
  readonly fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly push: () => Promise<PushOutcome>;
};

type SeedOptions = {
  readonly ownerId?: string | null;
  readonly cloudRevision?: number | null;
  readonly document?: SchemaDocument;
};

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
  vi.restoreAllMocks();
});

function jsonResponse(
  body: unknown,
  status: number,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function summaryResponse(revision: number, status = 200): Response {
  return jsonResponse(
    {
      id: SCHEMA_ID,
      name: SAMPLE_DOCUMENT.name,
      revision,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    },
    status,
  );
}

function detailBody(revision: number, document: unknown) {
  return {
    id: SCHEMA_ID,
    name: SAMPLE_DOCUMENT.name,
    revision,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    document,
  };
}

function errorResponse(
  status: number,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Response {
  return jsonResponse({ statusCode: status, ...body }, status, headers);
}

// The API client only reaches the refresher after a 401 "unauthenticated";
// answering 401 here is a refresh token that is no longer valid.
const expiredSessionRefresher: SessionRefresher = {
  refresh: () =>
    Promise.resolve({
      isOk: false,
      error: {
        kind: "http",
        status: 401,
        body: { statusCode: 401, code: "session-expired" },
        retryAfterSeconds: null,
      },
    }),
};

function setUp(): Fixture {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  let now = 1_000;
  const repository = createSchemaRepository({
    database,
    clock: () => {
      now += 1;
      return now;
    },
    generateId: () => SCHEMA_ID,
  });
  const fetchImpl = vi.fn<typeof fetch>();
  const api = createApiClient({
    baseUrl: BASE_URL,
    fetchImpl,
    sessionRefresher: expiredSessionRefresher,
    onSessionExpired: vi.fn(),
  });
  return {
    repository,
    fetchImpl,
    push: () =>
      pushSchemaOnce({ api, repository, schemaId: SCHEMA_ID, userId: USER_ID }),
  };
}

async function seed(
  repository: SchemaRepository,
  options: SeedOptions = {},
): Promise<void> {
  const ownerId = options.ownerId === undefined ? USER_ID : options.ownerId;
  await repository.createSchema(
    "Billing",
    ownerId === null ? undefined : { ownerId },
  );
  await repository.saveDocument(SCHEMA_ID, options.document ?? SAMPLE_DOCUMENT);
  if (ownerId !== null && options.cloudRevision !== undefined) {
    await repository.setSyncState(SCHEMA_ID, {
      cloudRevision: options.cloudRevision,
      syncStatus: "pending",
    });
  }
}

function requestAt(
  fetchImpl: Fixture["fetchImpl"],
  index: number,
): { readonly method: string; readonly path: string; readonly body: unknown } {
  const call = fetchImpl.mock.calls[index];
  if (call === undefined) {
    throw new Error(`No fetch call recorded at index ${String(index)}.`);
  }
  const [input, init] = call;
  if (!(input instanceof URL)) {
    throw new Error("Expected the API client to call fetch with a URL.");
  }
  const body = init?.body;
  return {
    method: init?.method ?? "GET",
    path: input.pathname,
    body: typeof body === "string" ? JSON.parse(body) : undefined,
  };
}

describe("pushSchemaOnce requests", () => {
  it("creates the schema when cloudRevision is null", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl.mockResolvedValueOnce(summaryResponse(1, 201));

    await expect(push()).resolves.toEqual({ kind: "synced", revision: 1 });

    expect(requestAt(fetchImpl, 0)).toEqual({
      method: "POST",
      path: "/schemas",
      body: { id: SCHEMA_ID, document: SAMPLE_DOCUMENT },
    });
  });

  it("updates with expectedRevision when cloudRevision is set", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository, { cloudRevision: 3 });
    fetchImpl.mockResolvedValueOnce(summaryResponse(4));

    await expect(push()).resolves.toEqual({ kind: "synced", revision: 4 });

    expect(requestAt(fetchImpl, 0)).toEqual({
      method: "PUT",
      path: `/schemas/${SCHEMA_ID}`,
      body: { document: SAMPLE_DOCUMENT, expectedRevision: 3 },
    });
  });

  it("does not call the API when the document exceeds the size limit", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository, {
      document: {
        ...SAMPLE_DOCUMENT,
        name: "x".repeat(MAX_REQUEST_BODY_BYTES),
      },
    });

    await expect(push()).resolves.toEqual({
      kind: "failed",
      code: "payload-too-large",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips a guest record", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository, { ownerId: null });

    await expect(push()).resolves.toEqual({ kind: "not-pushable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips a record owned by another account", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository, { ownerId: OTHER_USER_ID });

    await expect(push()).resolves.toEqual({ kind: "not-pushable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips a record that is not pending", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    await repository.setSyncState(SCHEMA_ID, {
      cloudRevision: 2,
      syncStatus: "synced",
    });

    await expect(push()).resolves.toEqual({ kind: "not-pushable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips a schema that is missing from the cache", async () => {
    const { fetchImpl, push } = setUp();

    await expect(push()).resolves.toEqual({ kind: "not-pushable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("pushSchemaOnce success", () => {
  it("marks the record synced after a successful push", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl.mockResolvedValueOnce(summaryResponse(1, 201));

    await push();

    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { cloudRevision: 1, syncStatus: "synced" },
    );
  });

  it("keeps the record pending when it changed while sending", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl.mockImplementationOnce(async () => {
      await repository.saveDocument(SCHEMA_ID, CHANGED_DOCUMENT);
      return summaryResponse(1, 201);
    });

    await expect(push()).resolves.toEqual({
      kind: "changed-while-sending",
      revision: 1,
    });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { cloudRevision: 1, syncStatus: "pending" },
    );
  });
});

describe("pushSchemaOnce conflicts", () => {
  it("marks conflict and loads the cloud version on revision-conflict", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository, { cloudRevision: 3 });
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "revision-conflict", currentRevision: 5 }),
      )
      .mockResolvedValueOnce(
        jsonResponse(detailBody(5, CHANGED_DOCUMENT), 200),
      );

    await expect(push()).resolves.toEqual({
      kind: "conflict",
      cloud: detailBody(5, CHANGED_DOCUMENT),
    });
    expect(requestAt(fetchImpl, 1)).toMatchObject({
      method: "GET",
      path: `/schemas/${SCHEMA_ID}`,
    });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { cloudRevision: 3, syncStatus: "conflict" },
    );
  });

  it("reports a conflict without the cloud version when loading it fails", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository, { cloudRevision: 3 });
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "revision-conflict", currentRevision: 5 }),
      )
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(push()).resolves.toEqual({ kind: "conflict", cloud: null });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { syncStatus: "conflict" },
    );
  });

  it("treats schema-id-unavailable with an equal cloud document as synced", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(jsonResponse(detailBody(2, SAMPLE_DOCUMENT), 200));

    await expect(push()).resolves.toEqual({ kind: "synced", revision: 2 });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { cloudRevision: 2, syncStatus: "synced" },
    );
  });

  it("marks conflict for schema-id-unavailable with a different cloud document", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(
        jsonResponse(detailBody(2, CHANGED_DOCUMENT), 200),
      );

    await expect(push()).resolves.toEqual({
      kind: "conflict",
      cloud: detailBody(2, CHANGED_DOCUMENT),
    });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { cloudRevision: null, syncStatus: "conflict" },
    );
  });

  it("fails with schema-id-unavailable when the id belongs to another account", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(errorResponse(404, { code: "not-found" }));

    await expect(push()).resolves.toEqual({
      kind: "failed",
      code: "schema-id-unavailable",
    });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { syncStatus: "pending" },
    );
  });

  it("retries schema-id-unavailable when loading the cloud version fails", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(
        errorResponse(503, { code: "internal-error" }, { "Retry-After": "9" }),
      );

    await expect(push()).resolves.toEqual({
      kind: "retryable",
      retryAfterSeconds: 9,
      failure: "http",
    });
  });

  it("returns session-expired when loading the cloud version after schema-id-unavailable gets a 401", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl
      .mockResolvedValueOnce(
        errorResponse(409, { code: "schema-id-unavailable" }),
      )
      .mockResolvedValueOnce(errorResponse(401, { code: "unauthenticated" }));

    await expect(push()).resolves.toEqual({ kind: "session-expired" });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { syncStatus: "pending" },
    );
  });

  it("marks deleted-in-cloud on 404 for an update", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository, { cloudRevision: 3 });
    fetchImpl.mockResolvedValueOnce(errorResponse(404, { code: "not-found" }));

    await expect(push()).resolves.toEqual({ kind: "deleted-in-cloud" });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { cloudRevision: 3, syncStatus: "deleted-in-cloud" },
    );
  });
});

describe("pushSchemaOnce failures", () => {
  it.each([
    {
      status: 403,
      body: { code: "schema-limit-reached" },
      code: "schema-limit-reached",
    },
    {
      status: 413,
      body: { code: "payload-too-large" },
      code: "payload-too-large",
    },
    {
      status: 422,
      body: {
        code: "document-invalid",
        documentErrors: [{ code: "dangling-reference", path: ["relations"] }],
      },
      code: "document-invalid",
    },
  ])("fails with $code on $status", async ({ status, body, code }) => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl.mockResolvedValueOnce(errorResponse(status, body));

    await expect(push()).resolves.toEqual({ kind: "failed", code });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { syncStatus: "pending" },
    );
  });

  it("reports version-unsupported for a 422 with that structural error", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl.mockResolvedValueOnce(
      errorResponse(422, {
        code: "document-invalid",
        documentErrors: [{ code: "version-unsupported", path: ["version"] }],
      }),
    );

    await expect(push()).resolves.toEqual({
      kind: "failed",
      code: "version-unsupported",
    });
  });

  it("returns session-expired and keeps pending after a 401", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl.mockResolvedValueOnce(
      errorResponse(401, { code: "unauthenticated" }),
    );

    await expect(push()).resolves.toEqual({ kind: "session-expired" });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { cloudRevision: null, syncStatus: "pending" },
    );
  });

  it.each([
    {
      name: "429",
      respond: () =>
        Promise.resolve(
          errorResponse(
            429,
            { code: "too-many-requests" },
            { "Retry-After": "7" },
          ),
        ),
      expected: { retryAfterSeconds: 7, failure: "http" },
    },
    {
      name: "500",
      respond: () =>
        Promise.resolve(errorResponse(500, { code: "internal-error" })),
      expected: { retryAfterSeconds: null, failure: "http" },
    },
    {
      name: "network",
      respond: () => Promise.reject(new TypeError("Failed to fetch")),
      expected: { retryAfterSeconds: null, failure: "network" },
    },
    {
      name: "timeout",
      respond: () =>
        Promise.reject(new DOMException("Timed out.", "TimeoutError")),
      expected: { retryAfterSeconds: null, failure: "timeout" },
    },
    {
      name: "invalid-response",
      respond: () => Promise.resolve(jsonResponse({ unexpected: true }, 201)),
      expected: { retryAfterSeconds: null, failure: "invalid-response" },
    },
  ])("returns retryable after $name", async ({ respond, expected }) => {
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl.mockImplementationOnce(respond);

    await expect(push()).resolves.toEqual({ kind: "retryable", ...expected });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { syncStatus: "pending" },
    );
  });

  it.each([
    {
      name: "400 validation-failed on an update",
      cloudRevision: 3,
      status: 400,
      body: {
        code: "validation-failed",
        fields: [{ path: "document", constraint: "required" }],
      },
    },
    {
      name: "403 origin-not-allowed",
      cloudRevision: 3,
      status: 403,
      body: { code: "origin-not-allowed" },
    },
    {
      name: "404 on a create",
      cloudRevision: undefined,
      status: 404,
      body: { code: "not-found" },
    },
  ])(
    "backs off like a server error after $name",
    async ({ cloudRevision, status, body }) => {
      const { repository, fetchImpl, push } = setUp();
      await seed(repository, { cloudRevision });
      fetchImpl.mockResolvedValueOnce(errorResponse(status, body));

      await expect(push()).resolves.toEqual({
        kind: "retryable",
        retryAfterSeconds: null,
        failure: "http",
      });
      await expect(
        repository.readSchemaRecord(SCHEMA_ID),
      ).resolves.toMatchObject({ syncStatus: "pending" });
    },
  );
});

describe("pushSchemaOnce cache changes during a request", () => {
  it("is not pushable when the schema is deleted while sending", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl.mockImplementationOnce(async () => {
      await repository.deleteSchema(SCHEMA_ID);
      return summaryResponse(1, 201);
    });

    await expect(push()).resolves.toEqual({ kind: "not-pushable" });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toBeNull();
  });

  it("keeps pending when the schema changed while resolving schema-id-unavailable", async () => {
    const { repository, fetchImpl, push } = setUp();
    await seed(repository);
    fetchImpl
      .mockImplementationOnce(async () => {
        await repository.saveDocument(SCHEMA_ID, CHANGED_DOCUMENT);
        return errorResponse(409, { code: "schema-id-unavailable" });
      })
      .mockResolvedValueOnce(jsonResponse(detailBody(2, SAMPLE_DOCUMENT), 200));

    await expect(push()).resolves.toEqual({
      kind: "changed-while-sending",
      revision: 2,
    });
    await expect(repository.readSchemaRecord(SCHEMA_ID)).resolves.toMatchObject(
      { cloudRevision: 2, syncStatus: "pending" },
    );
  });
});
