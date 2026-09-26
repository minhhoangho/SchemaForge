import type { SchemaSummary } from "@schemaforge/api-contract";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/lib/api/api-client";
import type { ApiClient } from "@/lib/api/api-client";
import type { SessionRefresher } from "@/lib/api/session-refresher";

import { useCloudSchemaList } from "./use-cloud-schema-list";

const BASE_URL = "https://api.schemaforge.invalid";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";
const FIRST_ID = "00000000-0000-4000-8000-000000000001";
const SECOND_ID = "00000000-0000-4000-8000-000000000002";

type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;

function summary(id: string, name: string): SchemaSummary {
  return {
    id,
    name,
    revision: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function pageResponse(
  items: readonly SchemaSummary[],
  nextCursor: string | null,
): Response {
  return jsonResponse({ items, nextCursor });
}

const unusedRefresher: SessionRefresher = {
  refresh: () => Promise.reject(new Error("No refresh is expected.")),
};

function createClient(fetchImpl: FetchStub): ApiClient {
  return createApiClient({
    baseUrl: BASE_URL,
    fetchImpl,
    sessionRefresher: unusedRefresher,
    onSessionExpired: () => undefined,
  });
}

function requestUrl(fetchImpl: FetchStub, call: number): URL {
  const input = fetchImpl.mock.calls[call]?.[0];
  if (!(input instanceof URL)) {
    throw new Error("Expected the API client to call fetch with a URL.");
  }
  return input;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCloudSchemaList", () => {
  it("does not call the api while signed out", () => {
    const fetchImpl = vi.fn<typeof fetch>();

    const { result } = renderHook(() =>
      useCloudSchemaList({
        apiClient: createClient(fetchImpl),
        authStatus: "signed-out",
      }),
    );

    expect(result.current.state).toEqual({ kind: "idle" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not call the api while the session is expired", () => {
    const fetchImpl = vi.fn<typeof fetch>();

    const { result } = renderHook(() =>
      useCloudSchemaList({
        apiClient: createClient(fetchImpl),
        authStatus: "expired",
      }),
    );

    expect(result.current.state).toEqual({ kind: "idle" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("loads every page until the next cursor is null", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(pageResponse([summary(FIRST_ID, "shop")], "c1"))
      .mockResolvedValueOnce(pageResponse([summary(SECOND_ID, "blog")], null));
    const apiClient = createClient(fetchImpl);

    const { result } = renderHook(() =>
      useCloudSchemaList({ apiClient, authStatus: "signed-in" }),
    );

    await waitFor(() => {
      expect(result.current.state).toEqual({
        kind: "loaded",
        items: [summary(FIRST_ID, "shop"), summary(SECOND_ID, "blog")],
        isComplete: true,
      });
    });
    expect({
      first: requestUrl(fetchImpl, 0).search,
      second: requestUrl(fetchImpl, 1).search,
    }).toEqual({ first: "?limit=100", second: "?limit=100&cursor=c1" });
  });

  it("reports failed when a page fails", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(pageResponse([summary(FIRST_ID, "shop")], "c1"))
      .mockResolvedValueOnce(
        jsonResponse({ statusCode: 500, code: "internal-error" }, 500),
      );
    const apiClient = createClient(fetchImpl);

    const { result } = renderHook(() =>
      useCloudSchemaList({ apiClient, authStatus: "signed-in" }),
    );

    await waitFor(() => {
      expect(result.current.state).toMatchObject({
        kind: "failed",
        failure: { kind: "http", status: 500 },
      });
    });
  });

  it("reloads when the tab becomes visible", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(pageResponse([], null)));
    const apiClient = createClient(fetchImpl);
    const { result } = renderHook(() =>
      useCloudSchemaList({ apiClient, authStatus: "signed-in" }),
    );
    await waitFor(() => {
      expect(result.current.state.kind).toBe("loaded");
    });
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
  });

  it("reloads on the online event", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(pageResponse([], null)));
    const apiClient = createClient(fetchImpl);
    const { result } = renderHook(() =>
      useCloudSchemaList({ apiClient, authStatus: "signed-in" }),
    );
    await waitFor(() => {
      expect(result.current.state.kind).toBe("loaded");
    });

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
  });

  it("ignores the result of a superseded load", async () => {
    const firstResponse = Promise.withResolvers<Response>();
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(firstResponse.promise)
      .mockResolvedValueOnce(pageResponse([summary(SECOND_ID, "blog")], null));
    const apiClient = createClient(fetchImpl);
    const { result } = renderHook(() =>
      useCloudSchemaList({ apiClient, authStatus: "signed-in" }),
    );

    act(() => {
      result.current.reload();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe("loaded");
    });
    await act(async () => {
      firstResponse.resolve(pageResponse([summary(FIRST_ID, "shop")], null));
      await firstResponse.promise;
    });

    expect(result.current.state).toEqual({
      kind: "loaded",
      items: [summary(SECOND_ID, "blog")],
      isComplete: true,
    });
  });
});
