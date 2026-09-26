import { randomUUID } from "node:crypto";

import {
  MAX_REQUEST_BODY_BYTES,
  MAX_SCHEMAS_PER_USER,
  parseApiErrorBody,
  type SchemaSummary,
  schemaDetailSchema,
  schemaListSchema,
  schemaSummarySchema,
} from "@schemaforge/api-contract";
import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createSampleSchema,
  makeTable,
} from "@schemaforge/core/testing";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestApp, type TestApp } from "./create-test-app.js";
import { registerUser } from "./factories.js";
import { createHttpClient, type HttpClient } from "./http-client.js";
import { readBody } from "./response-facts.js";

const CREATED_STATUS = 201;
const DOCUMENT = createSampleSchema();
const NOT_FOUND = { statusCode: 404, code: "not-found" };
const SCHEMA_ID_UNAVAILABLE = {
  statusCode: 409,
  code: "schema-id-unavailable",
};
const VALIDATION_FAILED = { statusCode: 400, code: "validation-failed" };

async function createSchema(
  client: HttpClient,
  document: unknown,
  id: string = randomUUID(),
): Promise<Response> {
  return client.request("POST", "/schemas", { body: { id, document } });
}

function readSummary(response: Response): SchemaSummary {
  return schemaSummarySchema.parse(readBody(response));
}

/**
 * The contract parser checks every entry has a string `code` and an array
 * `path`, so the test never copies core's error codes.
 */
function readDocumentErrors(
  response: Response,
): readonly { readonly code: string }[] {
  const body = parseApiErrorBody(readBody(response));
  if (body?.code !== "document-invalid") {
    throw new Error(`Expected a document-invalid body, got ${response.text}`);
  }
  return body.documentErrors;
}

/** Sequential so each create sees the count of the previous ones. */
async function createSchemas(
  client: HttpClient,
  count: number,
): Promise<readonly SchemaSummary[]> {
  const summaries: SchemaSummary[] = [];
  for (let index = 0; index < count; index += 1) {
    const response = await createSchema(client, DOCUMENT);
    if (response.status !== CREATED_STATUS) {
      throw new Error(
        `Create ${String(index + 1)} answered ${String(response.status)}`,
      );
    }
    summaries.push(readSummary(response));
  }
  return summaries;
}

/** The documented list order: `updatedAt` descending, then `id` descending. */
function newestFirstIds(
  summaries: readonly SchemaSummary[],
): readonly string[] {
  return [...summaries]
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.id.localeCompare(left.id),
    )
    .map((summary) => summary.id);
}

/** Valid JSON whose byte length is exactly one over the body limit. */
function oversizedBody(): string {
  const prefix = `{"id":"${randomUUID()}","document":{"name":"`;
  const suffix = `"}}`;
  const padding = "a".repeat(
    MAX_REQUEST_BODY_BYTES + 1 - prefix.length - suffix.length,
  );
  return `${prefix}${padding}${suffix}`;
}

describe("schemas e2e", () => {
  let testApp: TestApp;
  let alice: HttpClient;

  async function signedInClient(label: string): Promise<HttpClient> {
    const client = createHttpClient(testApp.app);
    await registerUser(client, label);
    return client;
  }

  beforeEach(async () => {
    testApp = await createTestApp();
    alice = await signedInClient("alice");
  });

  afterEach(async () => {
    await testApp.close();
  });

  describe("journey 4: create, update, delete", () => {
    it("creates a schema with revision 1 and returns its summary without the document", async () => {
      const id = randomUUID();

      const response = await createSchema(alice, DOCUMENT, id);

      expect(response.status).toBe(201);
      expect(readBody(response)).not.toHaveProperty("document");
      expect(readSummary(response)).toMatchObject({
        id,
        name: DOCUMENT.name,
        revision: 1,
      });
    });

    it("returns the created schema with a document deep-equal to the one sent", async () => {
      const { id } = readSummary(await createSchema(alice, DOCUMENT));

      const response = await alice.request("GET", `/schemas/${id}`);

      expect(response.status).toBe(200);
      expect(schemaDetailSchema.parse(readBody(response)).document).toEqual(
        DOCUMENT,
      );
    });

    it("updates the schema with the current revision and returns revision 2", async () => {
      const { id } = readSummary(await createSchema(alice, DOCUMENT));

      const response = await alice.request("PUT", `/schemas/${id}`, {
        body: { document: DOCUMENT, expectedRevision: 1 },
      });

      expect(response.status).toBe(200);
      expect(readSummary(response).revision).toBe(2);
    });

    it("rejects an update with revision 1 after revision 2 with revision-conflict and currentRevision 2", async () => {
      const { id } = readSummary(await createSchema(alice, DOCUMENT));
      const update = { body: { document: DOCUMENT, expectedRevision: 1 } };
      await alice.request("PUT", `/schemas/${id}`, update);

      const response = await alice.request("PUT", `/schemas/${id}`, update);

      expect(response.status).toBe(409);
      expect(readBody(response)).toEqual({
        statusCode: 409,
        code: "revision-conflict",
        currentRevision: 2,
      });
    });

    it("deletes the schema with 204 and then answers not-found on get", async () => {
      const { id } = readSummary(await createSchema(alice, DOCUMENT));

      const deleted = await alice.request("DELETE", `/schemas/${id}`);
      const response = await alice.request("GET", `/schemas/${id}`);

      expect(deleted.status).toBe(204);
      expect(response.status).toBe(404);
      expect(readBody(response)).toEqual(NOT_FOUND);
    });
  });

  describe("journey 5: ownership", () => {
    it.each([
      { method: "GET", body: undefined },
      { method: "PUT", body: { document: DOCUMENT, expectedRevision: 1 } },
      { method: "DELETE", body: undefined },
    ] as const)(
      "answers not-found when another user reads, updates or deletes the schema ($method)",
      async ({ method, body }) => {
        const { id } = readSummary(await createSchema(alice, DOCUMENT));
        const bob = await signedInClient("bob");

        const response = await bob.request(method, `/schemas/${id}`, { body });
        const own = await alice.request("GET", `/schemas/${id}`);

        expect(response.status).toBe(404);
        expect(readBody(response)).toEqual(NOT_FOUND);
        expect(readSummary(own).revision).toBe(1);
      },
    );

    it("does not list schemas of another user", async () => {
      await createSchema(alice, DOCUMENT);
      const bob = await signedInClient("bob");

      const response = await bob.request("GET", "/schemas");

      expect(response.status).toBe(200);
      expect(schemaListSchema.parse(readBody(response))).toEqual({
        items: [],
        nextCursor: null,
      });
    });

    it.each([
      {
        owner: "the same user",
        pickOwner: (own: HttpClient): HttpClient => own,
      },
      {
        owner: "another user",
        pickOwner: (_own: HttpClient, other: HttpClient): HttpClient => other,
      },
    ])(
      "rejects creating a schema with an id that already exists with schema-id-unavailable (owned by $owner)",
      async ({ pickOwner }) => {
        const bob = await signedInClient("bob");
        const id = randomUUID();
        await createSchema(pickOwner(alice, bob), DOCUMENT, id);

        const response = await createSchema(alice, DOCUMENT, id);

        expect(response.status).toBe(409);
        expect(readBody(response)).toEqual(SCHEMA_ID_UNAVAILABLE);
      },
    );
  });

  describe("journey 6: document validation", () => {
    it("rejects a structurally invalid document with document-invalid listing code and path", async () => {
      const response = await createSchema(alice, {
        ...createSampleSchema(),
        tables: "not-a-table-map",
      });

      expect(response.status).toBe(422);
      expect(readDocumentErrors(response).length).toBeGreaterThan(0);
    });

    it("stores a document with two tables of the same name", async () => {
      const document: SchemaDocument = buildSchema({
        tables: [
          makeTable({ id: "tbl_first", name: "users" }),
          makeTable({ id: "tbl_second", name: "users" }),
        ],
      });

      const created = await createSchema(alice, document);
      const response = await alice.request(
        "GET",
        `/schemas/${readSummary(created).id}`,
      );

      expect(created.status).toBe(201);
      expect(schemaDetailSchema.parse(readBody(response)).document).toEqual(
        document,
      );
    });
  });

  describe("journey 7: concurrent updates", () => {
    it("lets exactly one of two concurrent updates with the same expected revision succeed", async () => {
      const { id } = readSummary(await createSchema(alice, DOCUMENT));
      const update = { body: { document: DOCUMENT, expectedRevision: 1 } };

      const responses = await Promise.all([
        alice.request("PUT", `/schemas/${id}`, update),
        alice.request("PUT", `/schemas/${id}`, update),
      ]);
      const final = await alice.request("GET", `/schemas/${id}`);

      expect(responses.map((response) => response.status).sort()).toEqual([
        200, 409,
      ]);
      expect(readSummary(final).revision).toBe(2);
    });
  });

  describe("journey 8: pagination", () => {
    it("pages three schemas with limit 2 newest first and ends with a null cursor", async () => {
      const created = await createSchemas(alice, 3);

      const first = schemaListSchema.parse(
        readBody(await alice.request("GET", "/schemas?limit=2")),
      );
      const second = schemaListSchema.parse(
        readBody(
          await alice.request(
            "GET",
            `/schemas?limit=2&cursor=${first.nextCursor ?? ""}`,
          ),
        ),
      );

      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();
      expect(second.items).toHaveLength(1);
      expect(second.nextCursor).toBeNull();
      expect([...first.items, ...second.items].map((item) => item.id)).toEqual(
        newestFirstIds(created),
      );
    });

    it("rejects limit 101 with validation-failed", async () => {
      const response = await alice.request("GET", "/schemas?limit=101");

      expect(response.status).toBe(400);
      expect(readBody(response)).toMatchObject(VALIDATION_FAILED);
    });

    it("rejects an undecodable cursor with validation-failed", async () => {
      const response = await alice.request(
        "GET",
        "/schemas?cursor=not-a-cursor",
      );

      expect(response.status).toBe(400);
      expect(readBody(response)).toMatchObject(VALIDATION_FAILED);
    });
  });

  describe("journey 9: request bodies", () => {
    it("rejects a body larger than 2 MiB with payload-too-large", async () => {
      const response = await alice.request("POST", "/schemas", {
        rawBody: oversizedBody(),
      });

      expect(response.status).toBe(413);
      expect(readBody(response)).toEqual({
        statusCode: 413,
        code: "payload-too-large",
      });
    });

    it("rejects malformed JSON with validation-failed", async () => {
      const response = await alice.request("POST", "/schemas", {
        rawBody: '{"id":',
      });

      expect(response.status).toBe(400);
      expect(readBody(response)).toMatchObject(VALIDATION_FAILED);
    });
  });

  describe("journey 14: schema limit", () => {
    it("rejects the 101st schema of a user with schema-limit-reached", async () => {
      await createSchemas(alice, MAX_SCHEMAS_PER_USER);

      const response = await createSchema(alice, DOCUMENT);

      expect(response.status).toBe(403);
      expect(readBody(response)).toEqual({
        statusCode: 403,
        code: "schema-limit-reached",
      });
    });
  });
});
