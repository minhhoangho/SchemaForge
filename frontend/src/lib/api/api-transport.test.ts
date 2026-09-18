import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { logger } from "@/lib/logger";

import { sendRequest } from "./api-transport";
import type { SendSpec } from "./api-transport";

const BASE_URL = "https://api.schemaforge.invalid";

const SPEC: SendSpec<{ readonly name: string }> = {
  method: "GET",
  routeTemplate: "/schemas/:id",
  path: "/schemas/abc",
  schema: z.object({ name: z.string() }),
};

// A response whose headers arrived but whose body read fails with `cause`.
function responseWithFailingBody(cause: unknown): Response {
  const response = new Response("{}", { status: 200 });
  vi.spyOn(response, "json").mockRejectedValue(cause);
  return response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendRequest when fetch rejects", () => {
  it("rethrows a caller abort even when the caller passed a custom reason", async () => {
    const controller = new AbortController();
    const reason = new Error("Navigated away.");
    const fetchImpl = vi.fn<typeof fetch>(() => {
      controller.abort(reason);
      return Promise.reject(reason);
    });

    await expect(
      sendRequest(fetchImpl, BASE_URL, { ...SPEC, signal: controller.signal }),
    ).rejects.toBe(reason);
  });

  it("returns network for an AbortError the caller did not cause", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.reject(new DOMException("Aborted.", "AbortError")),
    );

    const result = await sendRequest(fetchImpl, BASE_URL, SPEC);

    expect(result).toStrictEqual({ isOk: false, error: { kind: "network" } });
  });
});

describe("sendRequest when the body read fails", () => {
  it("rethrows AbortError when the caller aborts after the headers arrived", async () => {
    const controller = new AbortController();
    const abortError = new DOMException("Aborted.", "AbortError");
    const fetchImpl = vi.fn<typeof fetch>(() => {
      controller.abort();
      return Promise.resolve(responseWithFailingBody(abortError));
    });

    await expect(
      sendRequest(fetchImpl, BASE_URL, { ...SPEC, signal: controller.signal }),
    ).rejects.toBe(abortError);
  });

  it("returns timeout without an invalid-response warning when the body read times out", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        responseWithFailingBody(new DOMException("Timed out.", "TimeoutError")),
      ),
    );

    const result = await sendRequest(fetchImpl, BASE_URL, SPEC);

    expect(result).toStrictEqual({ isOk: false, error: { kind: "timeout" } });
    expect(warn).not.toHaveBeenCalled();
  });

  it("returns network when the connection drops while the body streams in", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(responseWithFailingBody(new TypeError("terminated"))),
    );

    const result = await sendRequest(fetchImpl, BASE_URL, SPEC);

    expect(result).toStrictEqual({ isOk: false, error: { kind: "network" } });
  });

  it("returns invalid-response for a body that is not JSON", async () => {
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response("<html>", { status: 200 })),
    );

    const result = await sendRequest(fetchImpl, BASE_URL, SPEC);

    expect(result).toStrictEqual({
      isOk: false,
      error: { kind: "invalid-response" },
    });
  });
});
