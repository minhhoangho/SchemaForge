import type { SchemaDetail } from "@schemaforge/api-contract";
import type { Result } from "@schemaforge/core";
import { createSampleSchema } from "@schemaforge/core/testing";
import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "@/lib/api/api-client";
import type { ApiFailure } from "@/lib/api/api-failure";

import { fetchCloudSchema } from "./fetch-cloud-schema";

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";

const DETAIL: SchemaDetail = {
  id: SCHEMA_ID,
  name: "Billing",
  revision: 2,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  document: createSampleSchema(),
};

function httpFailure(status: number): ApiFailure {
  return {
    kind: "http",
    status,
    body: { statusCode: status, code: "internal-error" },
    retryAfterSeconds: null,
  };
}

function unexpectedCall(): never {
  throw new Error("Only schemas.get is expected in this test.");
}

// The API client is the boundary here; only the one call under test answers.
function createApi(answer: Result<SchemaDetail, ApiFailure>): ApiClient {
  return {
    auth: {
      register: unexpectedCall,
      login: unexpectedCall,
      logout: unexpectedCall,
      me: unexpectedCall,
    },
    schemas: {
      list: unexpectedCall,
      get: vi.fn<ApiClient["schemas"]["get"]>().mockResolvedValue(answer),
      create: unexpectedCall,
      update: unexpectedCall,
      remove: unexpectedCall,
    },
  };
}

describe("fetchCloudSchema", () => {
  it("maps a found schema", async () => {
    const api = createApi({ isOk: true, value: DETAIL });

    await expect(fetchCloudSchema(api, SCHEMA_ID)).resolves.toEqual({
      kind: "result",
      result: { kind: "found", detail: DETAIL },
    });
  });

  it("passes the abort signal to the request", async () => {
    const api = createApi({ isOk: true, value: DETAIL });
    const { signal } = new AbortController();

    await fetchCloudSchema(api, SCHEMA_ID, { signal });

    expect(api.schemas.get).toHaveBeenCalledWith(SCHEMA_ID, { signal });
  });

  it("maps 404 to not-found", async () => {
    const api = createApi({ isOk: false, error: httpFailure(404) });

    await expect(fetchCloudSchema(api, SCHEMA_ID)).resolves.toEqual({
      kind: "result",
      result: { kind: "not-found" },
    });
  });

  it("maps 401 to session-expired", async () => {
    const api = createApi({ isOk: false, error: httpFailure(401) });

    await expect(fetchCloudSchema(api, SCHEMA_ID)).resolves.toEqual({
      kind: "session-expired",
    });
  });

  it.each([
    ["network", { kind: "network" }],
    ["timeout", { kind: "timeout" }],
    ["invalid-response", { kind: "invalid-response" }],
    ["500", httpFailure(500)],
    ["429", httpFailure(429)],
  ] as const)("maps %s to unavailable", async (_label, failure) => {
    const api = createApi({ isOk: false, error: failure });

    await expect(fetchCloudSchema(api, SCHEMA_ID)).resolves.toEqual({
      kind: "result",
      result: { kind: "unavailable" },
    });
  });
});
