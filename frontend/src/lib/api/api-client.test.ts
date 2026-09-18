import { describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";

import {
  createApiClient,
  createRawAuthCalls,
  REQUEST_TIMEOUT_MS,
} from "./api-client";
import type { ApiClient } from "./api-client";
import type { SessionRefresher } from "./session-refresher";

const BASE_URL = "https://api.schemaforge.invalid";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SCHEMA_ID = "22222222-2222-4222-8222-222222222222";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(
  body: unknown,
  status: number,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function userBody() {
  return {
    user: {
      id: USER_ID,
      email: "user@example.com",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function createFakeSessionRefresher(
  refresh: SessionRefresher["refresh"] = vi.fn(() =>
    Promise.resolve({ isOk: true as const, value: undefined }),
  ),
): SessionRefresher {
  return { refresh };
}

function getFetchCall(
  fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>,
  index = 0,
): { readonly url: URL; readonly init: RequestInit } {
  const call = fetchImpl.mock.calls[index];
  if (call === undefined) {
    throw new Error(`No fetch call recorded at index ${String(index)}.`);
  }
  const [input, init] = call;
  if (!(input instanceof URL)) {
    throw new Error("Expected the API client to call fetch with a URL.");
  }
  return { url: input, init: init ?? {} };
}

function createClient(input?: {
  readonly fetchImpl?: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly sessionRefresher?: SessionRefresher;
  readonly onSessionExpired?: () => void;
}): {
  readonly client: ApiClient;
  readonly fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly onSessionExpired: ReturnType<typeof vi.fn>;
} {
  const fetchImpl = input?.fetchImpl ?? vi.fn<typeof fetch>();
  const onSessionExpired = vi.fn();
  const client = createApiClient({
    baseUrl: BASE_URL,
    fetchImpl,
    sessionRefresher: input?.sessionRefresher ?? createFakeSessionRefresher(),
    onSessionExpired: input?.onSessionExpired ?? onSessionExpired,
  });
  return { client, fetchImpl, onSessionExpired };
}

describe("createApiClient requests", () => {
  it("sends credentials, no-store cache and the JSON accept header", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(jsonResponse(userBody()));

    await client.auth.me();

    expect(fetchImpl).toHaveBeenCalledOnce();
    const { url, init } = getFetchCall(fetchImpl);
    expect(url.toString()).toBe(`${BASE_URL}/auth/me`);
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toMatchObject({ Accept: "application/json" });
    expect(init.headers).not.toHaveProperty("Content-Type");
  });

  it("adds the JSON content type only when there is a body", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({
        id: SCHEMA_ID,
        name: "Shop",
        revision: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );

    await client.schemas.create({ id: SCHEMA_ID, document: {} });

    const { init } = getFetchCall(fetchImpl);
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ id: SCHEMA_ID, document: {} }));
  });

  it("parses a successful user response with the contract schema", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(jsonResponse(userBody()));

    const result = await client.auth.me();

    expect(result).toStrictEqual({
      isOk: true,
      value: {
        id: USER_ID,
        email: "user@example.com",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("returns undefined for a 204 response", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await client.auth.logout();

    expect(result).toStrictEqual({ isOk: true, value: undefined });
  });

  it("returns an http failure with the error code for a contract error body", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(
      errorResponse({ statusCode: 404, code: "not-found" }, 404),
    );

    const result = await client.schemas.get(SCHEMA_ID);

    expect(result).toStrictEqual({
      isOk: false,
      error: {
        kind: "http",
        status: 404,
        body: { statusCode: 404, code: "not-found" },
        retryAfterSeconds: null,
      },
    });
  });

  it("includes currentRevision for a revision conflict", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(
      errorResponse(
        { statusCode: 409, code: "revision-conflict", currentRevision: 3 },
        409,
      ),
    );

    const result = await client.schemas.update(SCHEMA_ID, {
      document: {},
      expectedRevision: 1,
    });

    expect(result).toStrictEqual({
      isOk: false,
      error: {
        kind: "http",
        status: 409,
        body: {
          statusCode: 409,
          code: "revision-conflict",
          currentRevision: 3,
        },
        retryAfterSeconds: null,
      },
    });
  });

  it("returns invalid-response when a success body breaks the contract", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({ user: { id: "not-a-uuid" } }),
    );

    const result = await client.auth.me();

    expect(result).toStrictEqual({
      isOk: false,
      error: { kind: "invalid-response" },
    });
  });

  it("returns invalid-response when an error body breaks the contract", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(errorResponse({ oops: true }, 400));

    const result = await client.auth.me();

    expect(result).toStrictEqual({
      isOk: false,
      error: { kind: "invalid-response" },
    });
  });

  it("logs the route and status but not the body for an invalid response", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({ user: { id: "not-a-uuid" } }),
    );

    await client.auth.me();

    expect(warn).toHaveBeenCalledWith("api.invalid-response", {
      route: "/auth/me",
      status: 200,
    });
    warn.mockRestore();
  });

  it("returns network when fetch rejects", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockRejectedValueOnce(new Error("boom"));

    const result = await client.auth.me();

    expect(result).toStrictEqual({ isOk: false, error: { kind: "network" } });
  });

  it("returns timeout when the request times out", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockRejectedValueOnce(
      new DOMException("Timed out.", "TimeoutError"),
    );

    const result = await client.auth.me();

    expect(result).toStrictEqual({ isOk: false, error: { kind: "timeout" } });
  });

  it("rethrows AbortError when the caller aborts", async () => {
    const { client, fetchImpl } = createClient();
    const controller = new AbortController();
    const abortError = new DOMException("Aborted.", "AbortError");
    fetchImpl.mockImplementationOnce(() => {
      controller.abort(abortError);
      return Promise.reject(abortError);
    });

    await expect(
      client.auth.me({ signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("encodes the schema id in the path", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({
        id: SCHEMA_ID,
        name: "Shop",
        revision: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        document: {},
      }),
    );

    await client.schemas.get(SCHEMA_ID);

    const { url } = getFetchCall(fetchImpl);
    expect(url.pathname).toBe(`/schemas/${SCHEMA_ID}`);
  });

  it.each(["", ".", "..", "not-a-uuid", "../auth/logout"])(
    "rejects the schema id %j without calling fetch",
    async (id) => {
      const { client, fetchImpl } = createClient();

      await expect(client.schemas.get(id)).rejects.toThrow(/not a UUID/);
      await expect(
        client.schemas.update(id, { document: {}, expectedRevision: 1 }),
      ).rejects.toThrow(/not a UUID/);
      await expect(client.schemas.remove(id)).rejects.toThrow(/not a UUID/);
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("sends limit and cursor as query parameters", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({ items: [], nextCursor: null }),
    );

    await client.schemas.list({ limit: 5, cursor: "abc" });

    const { url } = getFetchCall(fetchImpl);
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("cursor")).toBe("abc");
  });

  it("uses the timeout constant when combining the abort signal", async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(jsonResponse(userBody()));

    await client.auth.me();

    const { init } = getFetchCall(fetchImpl);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(REQUEST_TIMEOUT_MS).toBe(15_000);
  });
});

describe("createApiClient auto refresh", () => {
  it("never refreshes for auth routes", async () => {
    const refresh = vi.fn<SessionRefresher["refresh"]>(() =>
      Promise.resolve({
        isOk: true as const,
        value: undefined,
      }),
    );
    const { client, fetchImpl } = createClient({
      sessionRefresher: createFakeSessionRefresher(refresh),
    });
    fetchImpl.mockResolvedValueOnce(
      errorResponse({ statusCode: 401, code: "invalid-credentials" }, 401),
    );

    const result = await client.auth.login({
      email: "user@example.com",
      password: "hunter22",
    });

    expect(refresh).not.toHaveBeenCalled();
    expect(result).toStrictEqual({
      isOk: false,
      error: {
        kind: "http",
        status: 401,
        body: { statusCode: 401, code: "invalid-credentials" },
        retryAfterSeconds: null,
      },
    });
  });
});

describe("createApiClient auto refresh for non-auth routes", () => {
  function createUnauthenticatedFailureThenRetry(): ReturnType<
    typeof vi.fn<typeof fetch>
  > {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(
      errorResponse({ statusCode: 401, code: "unauthenticated" }, 401),
    );
    return fetchImpl;
  }

  it("refreshes once and retries the request after a 401", async () => {
    const refresh = vi.fn<SessionRefresher["refresh"]>(() =>
      Promise.resolve({
        isOk: true as const,
        value: undefined,
      }),
    );
    const fetchImpl = createUnauthenticatedFailureThenRetry();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({
        id: SCHEMA_ID,
        name: "Shop",
        revision: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        document: {},
      }),
    );
    const { client } = createClient({
      fetchImpl,
      sessionRefresher: createFakeSessionRefresher(refresh),
    });

    const result = await client.schemas.get(SCHEMA_ID);

    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.isOk).toBe(true);
  });

  it("does not retry a second time when the retry also returns 401", async () => {
    const refresh = vi.fn<SessionRefresher["refresh"]>(() =>
      Promise.resolve({
        isOk: true as const,
        value: undefined,
      }),
    );
    const fetchImpl = createUnauthenticatedFailureThenRetry();
    fetchImpl.mockResolvedValueOnce(
      errorResponse({ statusCode: 401, code: "unauthenticated" }, 401),
    );
    const { client } = createClient({
      fetchImpl,
      sessionRefresher: createFakeSessionRefresher(refresh),
    });

    const result = await client.schemas.get(SCHEMA_ID);

    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual({
      isOk: false,
      error: {
        kind: "http",
        status: 401,
        body: { statusCode: 401, code: "unauthenticated" },
        retryAfterSeconds: null,
      },
    });
  });

  it("calls onSessionExpired when the refresh returns 401", async () => {
    const refresh = vi.fn<SessionRefresher["refresh"]>(() =>
      Promise.resolve({
        isOk: false as const,
        error: {
          kind: "http" as const,
          status: 401,
          body: { statusCode: 401 as const, code: "session-expired" as const },
          retryAfterSeconds: null,
        },
      }),
    );
    const fetchImpl = createUnauthenticatedFailureThenRetry();
    const { client, onSessionExpired } = createClient({
      fetchImpl,
      sessionRefresher: createFakeSessionRefresher(refresh),
    });

    const result = await client.schemas.get(SCHEMA_ID);

    expect(onSessionExpired).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual({
      isOk: false,
      error: {
        kind: "http",
        status: 401,
        body: { statusCode: 401, code: "unauthenticated" },
        retryAfterSeconds: null,
      },
    });
  });

  it("does not call onSessionExpired when the refresh fails with a network error", async () => {
    const refresh = vi.fn<SessionRefresher["refresh"]>(() =>
      Promise.resolve({
        isOk: false as const,
        error: { kind: "network" as const },
      }),
    );
    const fetchImpl = createUnauthenticatedFailureThenRetry();
    const { client, onSessionExpired } = createClient({
      fetchImpl,
      sessionRefresher: createFakeSessionRefresher(refresh),
    });

    const result = await client.schemas.get(SCHEMA_ID);

    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual({ isOk: false, error: { kind: "network" } });
  });

  it("returns a rate-limited refresh failure without calling onSessionExpired", async () => {
    const rateLimited = {
      kind: "http" as const,
      status: 429,
      body: { statusCode: 429 as const, code: "too-many-requests" as const },
      retryAfterSeconds: 30,
    };
    const refresh = vi.fn<SessionRefresher["refresh"]>(() =>
      Promise.resolve({
        isOk: false as const,
        error: rateLimited,
      }),
    );
    const fetchImpl = createUnauthenticatedFailureThenRetry();
    const { client, onSessionExpired } = createClient({
      fetchImpl,
      sessionRefresher: createFakeSessionRefresher(refresh),
    });

    const result = await client.schemas.list({});

    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual({ isOk: false, error: rateLimited });
  });
});

describe("createRawAuthCalls", () => {
  it("does not retry or refresh on its own", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(
      errorResponse({ statusCode: 401, code: "unauthenticated" }, 401),
    );
    const calls = createRawAuthCalls({ baseUrl: BASE_URL, fetchImpl });

    const result = await calls.me();

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.isOk).toBe(false);
  });

  it("reads retryAfterSeconds from a numeric Retry-After header on refresh", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(
      errorResponse({ statusCode: 429, code: "too-many-requests" }, 429, {
        "Retry-After": "12",
      }),
    );
    const calls = createRawAuthCalls({ baseUrl: BASE_URL, fetchImpl });

    const result = await calls.refresh();

    expect(result).toStrictEqual({
      isOk: false,
      error: {
        kind: "http",
        status: 429,
        body: { statusCode: 429, code: "too-many-requests" },
        retryAfterSeconds: 12,
      },
    });
  });
});
