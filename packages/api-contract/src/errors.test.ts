import { describe, expect, it } from "vitest";

import type { ApiErrorBody, ParsedApiErrorBody } from "./errors.js";
import {
  API_ERROR_CODES,
  API_ERROR_STATUS,
  parseApiErrorBody,
  SIMPLE_API_ERROR_CODES,
} from "./errors.js";

// Compile-time guarantee: every body the backend can build is one the frontend
// can parse.
const BACKEND_BODY: ApiErrorBody = {
  statusCode: 422,
  code: "document-invalid",
  documentErrors: [{ code: "version-unsupported", path: ["version"] }],
};
const PARSED_BODY: ParsedApiErrorBody = BACKEND_BODY;

describe("API_ERROR_CODES", () => {
  it("lists the fifteen api error codes in spec order without duplicates", () => {
    expect(API_ERROR_CODES).toStrictEqual([
      "validation-failed",
      "password-too-common",
      "unauthenticated",
      "invalid-credentials",
      "session-expired",
      "origin-not-allowed",
      "schema-limit-reached",
      "not-found",
      "email-already-registered",
      "schema-id-unavailable",
      "revision-conflict",
      "payload-too-large",
      "document-invalid",
      "too-many-requests",
      "internal-error",
    ]);
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
  });

  it("lists every code except the three with extra data as simple codes", () => {
    expect(SIMPLE_API_ERROR_CODES).toStrictEqual(
      API_ERROR_CODES.filter(
        (code) =>
          code !== "validation-failed" &&
          code !== "revision-conflict" &&
          code !== "document-invalid",
      ),
    );
  });
});

describe("API_ERROR_STATUS", () => {
  it.each([
    ["validation-failed", 400],
    ["password-too-common", 400],
    ["unauthenticated", 401],
    ["invalid-credentials", 401],
    ["session-expired", 401],
    ["origin-not-allowed", 403],
    ["schema-limit-reached", 403],
    ["not-found", 404],
    ["email-already-registered", 409],
    ["schema-id-unavailable", 409],
    ["revision-conflict", 409],
    ["payload-too-large", 413],
    ["document-invalid", 422],
    ["too-many-requests", 429],
    ["internal-error", 500],
  ] as const)(
    "maps each error code to the status in the spec: %s",
    (code, status) => {
      expect(API_ERROR_STATUS[code]).toBe(status);
    },
  );

  it("has a status for exactly the api error codes", () => {
    expect(Object.keys(API_ERROR_STATUS)).toStrictEqual([...API_ERROR_CODES]);
  });
});

describe("parseApiErrorBody", () => {
  it("parses a validation-failed body with field errors", () => {
    const body = {
      statusCode: 400,
      code: "validation-failed",
      fields: [{ path: "email", constraint: "isEmail" }],
    };

    expect(parseApiErrorBody(body)).toStrictEqual(body);
  });

  it("parses a revision-conflict body with the current revision", () => {
    const body = {
      statusCode: 409,
      code: "revision-conflict",
      currentRevision: 7,
    };

    expect(parseApiErrorBody(body)).toStrictEqual(body);
  });

  it("parses a document-invalid body with structural errors", () => {
    expect(parseApiErrorBody(PARSED_BODY)).toStrictEqual({
      statusCode: 422,
      code: "document-invalid",
      documentErrors: [{ code: "version-unsupported", path: ["version"] }],
    });
  });

  it("parses a simple error body", () => {
    const body = { statusCode: 401, code: "unauthenticated" };

    expect(parseApiErrorBody(body)).toStrictEqual(body);
  });

  it("returns null for an unknown code", () => {
    expect(parseApiErrorBody({ statusCode: 418, code: "teapot" })).toBeNull();
  });

  it("returns null for a revision-conflict body without currentRevision", () => {
    expect(
      parseApiErrorBody({ statusCode: 409, code: "revision-conflict" }),
    ).toBeNull();
  });

  it.each([
    ["a status below 400", { statusCode: 399, code: "not-found" }],
    ["a status above 599", { statusCode: 600, code: "not-found" }],
    ["a non-integer status", { statusCode: 404.5, code: "not-found" }],
    ["a string", "not-found"],
    ["null", null],
  ])("returns null for %s", (_label, value) => {
    expect(parseApiErrorBody(value)).toBeNull();
  });

  it("returns null for a revision-conflict body with a zero currentRevision", () => {
    expect(
      parseApiErrorBody({
        statusCode: 409,
        code: "revision-conflict",
        currentRevision: 0,
      }),
    ).toBeNull();
  });

  it("drops unknown fields from an error body", () => {
    expect(
      parseApiErrorBody({
        statusCode: 400,
        code: "validation-failed",
        fields: [{ path: "email", constraint: "isEmail", extra: true }],
        message: "Bad Request",
      }),
    ).toStrictEqual({
      statusCode: 400,
      code: "validation-failed",
      fields: [{ path: "email", constraint: "isEmail" }],
    });
  });
});
