import type { Result } from "@schemaforge/core";
import { parseApiErrorBody } from "@schemaforge/api-contract";
import type { ZodType } from "zod";

import { logger } from "@/lib/logger";

import { parseRetryAfterSeconds } from "./api-failure";
import type { ApiFailure } from "./api-failure";

export const REQUEST_TIMEOUT_MS = 15_000;

export type SendSpec<T> = {
  readonly method: string;
  readonly routeTemplate: string;
  readonly path: string;
  readonly schema: ZodType<T>;
  readonly body?: unknown;
  readonly query?: URLSearchParams;
  readonly signal?: AbortSignal;
};

type TransportFailure =
  { readonly kind: "network" } | { readonly kind: "timeout" };

type RequestSignals = {
  readonly caller: AbortSignal | undefined;
  readonly combined: AbortSignal;
};

const NO_CONTENT_STATUS = 204;
const SUCCESS_STATUS_MIN = 200;
const SUCCESS_STATUS_MAX = 299;

function isDomException(value: unknown, name: string): value is DOMException {
  return value instanceof DOMException && value.name === name;
}

/**
 * Classifies an error thrown while fetching or reading a response body. A
 * cancellation by the caller is not an expected failure the caller branches
 * on, so it is rethrown as is, whatever abort reason the caller passed.
 */
function classifyTransportError(
  cause: unknown,
  signals: RequestSignals,
): TransportFailure {
  if (signals.caller?.aborted === true) {
    throw cause;
  }
  if (signals.combined.aborted || isDomException(cause, "TimeoutError")) {
    return { kind: "timeout" };
  }
  return { kind: "network" };
}

function combineSignal(callerSignal: AbortSignal | undefined): AbortSignal {
  const signals = [
    callerSignal,
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  ].filter((signal): signal is AbortSignal => signal !== undefined);
  return AbortSignal.any(signals);
}

function buildRequestInit(
  method: string,
  body: unknown,
  signal: AbortSignal,
): RequestInit {
  const headers: Record<string, string> = { Accept: "application/json" };
  const init: RequestInit = {
    method,
    credentials: "include",
    cache: "no-store",
    signal,
    headers,
  };
  if (body === undefined) {
    return init;
  }
  headers["Content-Type"] = "application/json";
  return { ...init, body: JSON.stringify(body) };
}

function buildUrl(baseUrl: string, path: string, query?: URLSearchParams): URL {
  const url = new URL(path, baseUrl);
  query?.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  return url;
}

function isSuccessStatus(status: number): boolean {
  return status >= SUCCESS_STATUS_MIN && status <= SUCCESS_STATUS_MAX;
}

type BodyOutcome =
  | { readonly kind: "parsed"; readonly value: unknown }
  | { readonly kind: "unparsable" }
  | TransportFailure;

async function readJsonBody(
  response: Response,
  signals: RequestSignals,
): Promise<BodyOutcome> {
  try {
    return { kind: "parsed", value: await response.json() };
  } catch (cause) {
    // Only a malformed body is a contract problem; an abort, a timeout or a
    // dropped connection while the body streams in is a transport failure.
    if (cause instanceof SyntaxError) {
      return { kind: "unparsable" };
    }
    return classifyTransportError(cause, signals);
  }
}

function invalidResponse(
  routeTemplate: string,
  status: number,
): { readonly isOk: false; readonly error: ApiFailure } {
  logger.warn("api.invalid-response", { route: routeTemplate, status });
  return { isOk: false, error: { kind: "invalid-response" } };
}

function parseErrorBody(
  response: Response,
  routeTemplate: string,
  value: unknown,
): Result<never, ApiFailure> {
  const body = parseApiErrorBody(value);
  if (body === null) {
    return invalidResponse(routeTemplate, response.status);
  }
  return {
    isOk: false,
    error: {
      kind: "http",
      status: response.status,
      body,
      retryAfterSeconds: parseRetryAfterSeconds(
        response.headers.get("Retry-After"),
      ),
    },
  };
}

async function parseResponse<T>(
  response: Response,
  spec: SendSpec<T>,
  signals: RequestSignals,
): Promise<Result<T, ApiFailure>> {
  const isSuccess = isSuccessStatus(response.status);
  const body: BodyOutcome =
    isSuccess && response.status === NO_CONTENT_STATUS
      ? { kind: "parsed", value: undefined }
      : await readJsonBody(response, signals);
  if (body.kind === "network" || body.kind === "timeout") {
    return { isOk: false, error: body };
  }
  if (body.kind === "unparsable") {
    return invalidResponse(spec.routeTemplate, response.status);
  }
  if (!isSuccess) {
    return parseErrorBody(response, spec.routeTemplate, body.value);
  }
  const parsed = spec.schema.safeParse(body.value);
  if (!parsed.success) {
    return invalidResponse(spec.routeTemplate, response.status);
  }
  return { isOk: true, value: parsed.data };
}

/**
 * Sends one request and maps the outcome to a Result. Throws only when the
 * caller's own signal aborted the request.
 */
export async function sendRequest<T>(
  fetchImpl: typeof fetch,
  baseUrl: string,
  spec: SendSpec<T>,
): Promise<Result<T, ApiFailure>> {
  const signals: RequestSignals = {
    caller: spec.signal,
    combined: combineSignal(spec.signal),
  };
  let response: Response;
  try {
    response = await fetchImpl(
      buildUrl(baseUrl, spec.path, spec.query),
      buildRequestInit(spec.method, spec.body, signals.combined),
    );
  } catch (cause) {
    return { isOk: false, error: classifyTransportError(cause, signals) };
  }
  return parseResponse(response, spec, signals);
}
