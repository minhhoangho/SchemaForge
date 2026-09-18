import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import {
  API_ERROR_STATUS,
  type ApiErrorBody,
  type SimpleApiErrorCode,
} from "@schemaforge/api-contract";
import type { Request, Response } from "express";

import { Prisma } from "../generated/prisma/client.js";
import { ApiException } from "./api.exception.js";
import { readRequestUser } from "./current-user.decorator.js";
import { toPrismaErrorBody } from "./prisma-errors.js";

export type ResolvedApiError = {
  readonly body: ApiErrorBody;
  readonly isUnexpected: boolean;
};

const VALIDATION_FAILED: ApiErrorBody = {
  statusCode: API_ERROR_STATUS["validation-failed"],
  code: "validation-failed",
  fields: [],
};

const HTTP_STATUS_ERRORS: ReadonlyMap<number, ApiErrorBody> = new Map([
  [HttpStatus.BAD_REQUEST, VALIDATION_FAILED],
  [HttpStatus.UNAUTHORIZED, simpleBody("unauthenticated")],
  [HttpStatus.NOT_FOUND, simpleBody("not-found")],
  [HttpStatus.PAYLOAD_TOO_LARGE, simpleBody("payload-too-large")],
  [HttpStatus.TOO_MANY_REQUESTS, simpleBody("too-many-requests")],
]);

// `type` values set by the body parser (http-errors) that Express passes on.
const BODY_PARSER_ERRORS: ReadonlyMap<string, ApiErrorBody> = new Map([
  ["entity.too.large", simpleBody("payload-too-large")],
  ["entity.parse.failed", VALIDATION_FAILED],
]);

const UNEXPECTED: ResolvedApiError = {
  body: simpleBody("internal-error"),
  isUnexpected: true,
};

function simpleBody(code: SimpleApiErrorCode): ApiErrorBody {
  return { statusCode: API_ERROR_STATUS[code], code };
}

function expected(body: ApiErrorBody): ResolvedApiError {
  return { body, isUnexpected: false };
}

function readBodyParserErrorType(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return null;
  }
  return typeof value.type === "string" ? value.type : null;
}

export function resolveApiError(exception: unknown): ResolvedApiError {
  if (exception instanceof ApiException) {
    return expected(exception.body);
  }
  const bodyParserError = BODY_PARSER_ERRORS.get(
    readBodyParserErrorType(exception) ?? "",
  );
  if (bodyParserError !== undefined) {
    return expected(bodyParserError);
  }
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    const body = toPrismaErrorBody(exception);
    return body === null ? UNEXPECTED : expected(body);
  }
  if (exception instanceof HttpException) {
    const body = HTTP_STATUS_ERRORS.get(exception.getStatus());
    return body === undefined ? UNEXPECTED : expected(body);
  }
  return UNEXPECTED;
}

function readRoutePath(request: Request): string {
  const route: unknown = request.route;
  if (
    typeof route === "object" &&
    route !== null &&
    "path" in route &&
    typeof route.path === "string"
  ) {
    return route.path;
  }
  return request.path;
}

// Only the stack frames: an error message can carry request data or SQL
// (JSON parse errors, Prisma and driver adapter errors).
function readStackFrames(exception: unknown): string | undefined {
  if (!(exception instanceof Error) || exception.stack === undefined) {
    return undefined;
  }
  return exception.stack
    .split("\n")
    .filter((line) => line.trimStart().startsWith("at "))
    .join("\n");
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const { body, isUnexpected } = resolveApiError(exception);
    if (isUnexpected) {
      this.logUnexpected(exception, http.getRequest<Request>());
    }
    http.getResponse<Response>().status(body.statusCode).json(body);
  }

  private logUnexpected(exception: unknown, request: Request): void {
    const name = exception instanceof Error ? exception.name : typeof exception;
    const user = readRequestUser(request);
    const userPart = user === null ? "" : ` for user ${user.userId}`;
    this.logger.error(
      `Unexpected ${name} on ${request.method} ${readRoutePath(request)}${userPart}`,
      readStackFrames(exception),
    );
  }
}
