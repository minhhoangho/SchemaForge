import {
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from "@nestjs/common";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import type { ApiErrorBody } from "@schemaforge/api-contract";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";

import { Prisma } from "../generated/prisma/client.js";
import { ApiException } from "./api.exception.js";
import { ApiExceptionFilter, resolveApiError } from "./api-exception.filter.js";

// Marker values that must never show up in a log line.
const BODY_MARKER = "request-body-marker";
const COOKIE_MARKER = "refresh-cookie-marker";

type FakeResponse = {
  readonly status: Mock<(statusCode: number) => FakeResponse>;
  readonly json: Mock<(body: unknown) => void>;
};

function createResponse(): FakeResponse {
  const response: FakeResponse = {
    status: vi.fn<(statusCode: number) => FakeResponse>(),
    json: vi.fn<(body: unknown) => void>(),
  };
  response.status.mockReturnValue(response);
  return response;
}

function spyOnLoggerError() {
  return vi
    .spyOn(Logger.prototype, "error")
    .mockImplementation(() => undefined);
}

function createRequest(): Record<string, unknown> {
  return {
    method: "PUT",
    path: "/schemas/0190a1b2-0000-7000-8000-000000000001",
    route: { path: "/schemas/:id" },
    user: { userId: "user-1" },
    body: { password: BODY_MARKER },
    cookies: { "sf-refresh": COOKIE_MARKER },
    headers: { cookie: `sf-refresh=${COOKIE_MARKER}` },
  };
}

function catchWithFilter(exception: unknown): {
  readonly response: FakeResponse;
  readonly logError: ReturnType<typeof spyOnLoggerError>;
} {
  const logError = spyOnLoggerError();
  const response = createResponse();
  const host = new ExecutionContextHost([createRequest(), response]);
  new ApiExceptionFilter().catch(exception, host);
  return { response, logError };
}

function bodyParserError(type: string, status: number): Error {
  return Object.assign(new Error("body parser failed"), {
    type,
    status,
    statusCode: status,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveApiError", () => {
  it("returns the body of an ApiException unchanged", () => {
    const body: ApiErrorBody = {
      statusCode: 409,
      code: "revision-conflict",
      currentRevision: 7,
    };

    expect(resolveApiError(new ApiException(body))).toEqual({
      body,
      isUnexpected: false,
    });
  });

  it.each([
    [
      "BadRequestException",
      new BadRequestException("bad"),
      { statusCode: 400, code: "validation-failed", fields: [] },
    ],
    [
      "UnauthorizedException",
      new UnauthorizedException(),
      { statusCode: 401, code: "unauthenticated" },
    ],
    [
      "NotFoundException",
      new NotFoundException("Cannot GET /missing"),
      { statusCode: 404, code: "not-found" },
    ],
    [
      "PayloadTooLargeException",
      new PayloadTooLargeException(),
      { statusCode: 413, code: "payload-too-large" },
    ],
    [
      "HttpException 429",
      new HttpException("slow down", 429),
      { statusCode: 429, code: "too-many-requests" },
    ],
  ])(
    "maps built-in http exceptions by status (%s)",
    (_name, exception, body) => {
      expect(resolveApiError(exception)).toEqual({ body, isUnexpected: false });
    },
  );

  it("maps a built-in http exception with another status to an unexpected internal-error", () => {
    expect(resolveApiError(new HttpException("teapot", 418))).toEqual({
      body: { statusCode: 500, code: "internal-error" },
      isUnexpected: true,
    });
  });

  it("maps an entity.too.large body parser error to payload-too-large", () => {
    const error = bodyParserError("entity.too.large", 413);

    expect(resolveApiError(error)).toEqual({
      body: { statusCode: 413, code: "payload-too-large" },
      isUnexpected: false,
    });
  });

  it("maps an entity.parse.failed body parser error to validation-failed with no fields", () => {
    const error = bodyParserError("entity.parse.failed", 400);

    expect(resolveApiError(error)).toEqual({
      body: { statusCode: 400, code: "validation-failed", fields: [] },
      isUnexpected: false,
    });
  });

  it("maps a translated Prisma error to its api error", () => {
    const error = new Prisma.PrismaClientKnownRequestError("not found", {
      code: "P2025",
      clientVersion: "7.10.0",
    });

    expect(resolveApiError(error)).toEqual({
      body: { statusCode: 404, code: "not-found" },
      isUnexpected: false,
    });
  });

  it("maps an untranslated Prisma error to an unexpected internal-error", () => {
    const error = new Prisma.PrismaClientKnownRequestError("fk failed", {
      code: "P2003",
      clientVersion: "7.10.0",
    });

    expect(resolveApiError(error)).toEqual({
      body: { statusCode: 500, code: "internal-error" },
      isUnexpected: true,
    });
  });

  it("maps a thrown non-error value to an unexpected internal-error", () => {
    expect(resolveApiError("boom")).toEqual({
      body: { statusCode: 500, code: "internal-error" },
      isUnexpected: true,
    });
  });
});

describe("ApiExceptionFilter", () => {
  it("writes the status and body of an expected error", () => {
    const { response, logError } = catchWithFilter(
      new ApiException({ statusCode: 403, code: "origin-not-allowed" }),
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 403,
      code: "origin-not-allowed",
    });
    expect(logError).not.toHaveBeenCalled();
  });

  it("maps an unexpected error to internal-error without message or stack", () => {
    const { response } = catchWithFilter(
      new Error('select * from "users" failed'),
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      code: "internal-error",
    });
  });

  it("logs the error name, method, route and user id of an unexpected error", () => {
    const { logError } = catchWithFilter(new TypeError("broken"));

    expect(logError).toHaveBeenCalledOnce();
    const call: readonly unknown[] = logError.mock.calls[0] ?? [];
    const [message, stack] = call;
    expect(message).toBe(
      "Unexpected TypeError on PUT /schemas/:id for user user-1",
    );
    expect(String(stack)).toContain("api-exception.filter.spec.ts");
  });

  it("does not log the request body or cookies", () => {
    const { logError } = catchWithFilter(new Error("boom"));

    const calls: readonly unknown[] = logError.mock.calls;
    const logged = JSON.stringify(calls);
    expect(logged).not.toContain(BODY_MARKER);
    expect(logged).not.toContain(COOKIE_MARKER);
  });

  it("does not log the message of a Prisma error", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Key (email)=(someone@example.com) already exists in "users"',
      { code: "P2010", clientVersion: "7.10.0" },
    );

    const { logError } = catchWithFilter(error);

    const calls: readonly unknown[] = logError.mock.calls;
    expect(JSON.stringify(calls)).not.toContain("someone@example.com");
  });
});
