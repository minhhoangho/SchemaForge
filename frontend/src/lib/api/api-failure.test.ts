import { describe, expect, it } from "vitest";

import {
  isApiErrorCode,
  parseRetryAfterSeconds,
  toApiErrorMessageKey,
} from "./api-failure";
import type { ApiFailure } from "./api-failure";

describe("parseRetryAfterSeconds", () => {
  it("parses a numeric Retry-After header as seconds", () => {
    expect(parseRetryAfterSeconds("30")).toBe(30);
  });

  it("returns null retryAfterSeconds for a missing or non-numeric header", () => {
    expect(parseRetryAfterSeconds(null)).toBeNull();
    expect(parseRetryAfterSeconds("soon")).toBeNull();
    expect(parseRetryAfterSeconds("0")).toBeNull();
    expect(parseRetryAfterSeconds("-5")).toBeNull();
    expect(parseRetryAfterSeconds("1.5")).toBeNull();
  });
});

describe("isApiErrorCode", () => {
  it("matches an http failure carrying the same error code", () => {
    const failure: ApiFailure = {
      kind: "http",
      status: 401,
      body: { statusCode: 401, code: "unauthenticated" },
      retryAfterSeconds: null,
    };

    expect(isApiErrorCode(failure, "unauthenticated")).toBe(true);
  });

  it("does not match a non-http failure", () => {
    expect(isApiErrorCode({ kind: "network" }, "unauthenticated")).toBe(false);
  });
});

describe("toApiErrorMessageKey", () => {
  it.each([
    [
      "an http failure",
      {
        kind: "http",
        status: 404,
        body: { statusCode: 404, code: "not-found" },
        retryAfterSeconds: null,
      },
      "not-found",
    ],
    ["a network failure", { kind: "network" }, "network"],
    ["a timeout failure", { kind: "timeout" }, "timeout"],
    [
      "an invalid-response failure",
      { kind: "invalid-response" },
      "invalid-response",
    ],
  ] as const)(
    "maps each failure kind to its apiErrors key (%s)",
    (_label, failure, expected) => {
      expect(toApiErrorMessageKey(failure)).toBe(expected);
    },
  );
});
