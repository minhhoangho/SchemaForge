// Zod schemas are created when this module loads (VOID_RESPONSE_SCHEMA). In
// the browser it must load after frontend/src/lib/zod-config.ts (Zod
// jitless), like the core package and the api-contract schemas it also uses.
import type { Result } from "@schemaforge/core";
import type {
  AuthUserResponse,
  CreateSchemaRequest,
  ListSchemasQuery,
  LoginRequest,
  RegisterRequest,
  SchemaDetail,
  SchemaList,
  SchemaSummary,
  UpdateSchemaRequest,
  UserResponse,
} from "@schemaforge/api-contract";
import {
  authUserResponseSchema,
  schemaDetailSchema,
  schemaListSchema,
  schemaSummarySchema,
} from "@schemaforge/api-contract";
import { z } from "zod";

import { isApiErrorCode } from "./api-failure";
import type { ApiFailure } from "./api-failure";
import { sendRequest } from "./api-transport";
import type { SendSpec } from "./api-transport";
import type { SessionRefresher } from "./session-refresher";

export { REQUEST_TIMEOUT_MS } from "./api-transport";

export type RequestOptions = { readonly signal?: AbortSignal };

export type ApiClient = {
  readonly auth: {
    readonly register: (
      input: RegisterRequest,
      options?: RequestOptions,
    ) => Promise<Result<UserResponse, ApiFailure>>;
    readonly login: (
      input: LoginRequest,
      options?: RequestOptions,
    ) => Promise<Result<UserResponse, ApiFailure>>;
    readonly logout: (
      options?: RequestOptions,
    ) => Promise<Result<void, ApiFailure>>;
    readonly me: (
      options?: RequestOptions,
    ) => Promise<Result<UserResponse, ApiFailure>>;
  };
  readonly schemas: {
    readonly list: (
      query: ListSchemasQuery,
      options?: RequestOptions,
    ) => Promise<Result<SchemaList, ApiFailure>>;
    readonly get: (
      id: string,
      options?: RequestOptions,
    ) => Promise<Result<SchemaDetail, ApiFailure>>;
    readonly create: (
      input: CreateSchemaRequest,
      options?: RequestOptions,
    ) => Promise<Result<SchemaSummary, ApiFailure>>;
    readonly update: (
      id: string,
      input: UpdateSchemaRequest,
      options?: RequestOptions,
    ) => Promise<Result<SchemaSummary, ApiFailure>>;
    readonly remove: (
      id: string,
      options?: RequestOptions,
    ) => Promise<Result<void, ApiFailure>>;
  };
};

export type RawAuthCalls = {
  readonly me: () => Promise<Result<UserResponse, ApiFailure>>;
  readonly refresh: () => Promise<Result<void, ApiFailure>>;
};

// z.void() only accepts undefined, so it doubles as the "no body expected"
// schema for endpoints that answer 204 (see parseResponse in api-transport.ts).
const VOID_RESPONSE_SCHEMA = z.void();

// Derived from the contract so the id rule has one source of truth.
const SCHEMA_ID_SCHEMA = schemaSummarySchema.shape.id;

const AUTH_ROUTE_PREFIX = "/auth/";
const UNAUTHORIZED_STATUS = 401;

function unwrapUser(
  result: Result<AuthUserResponse, ApiFailure>,
): Result<UserResponse, ApiFailure> {
  return result.isOk ? { isOk: true, value: result.value.user } : result;
}

async function withAutoRefresh<T>(
  routeTemplate: string,
  sessionRefresher: SessionRefresher,
  onSessionExpired: () => void,
  perform: () => Promise<Result<T, ApiFailure>>,
): Promise<Result<T, ApiFailure>> {
  const first = await perform();
  if (routeTemplate.startsWith(AUTH_ROUTE_PREFIX)) {
    return first;
  }
  if (first.isOk || !isApiErrorCode(first.error, "unauthenticated")) {
    return first;
  }
  const refreshResult = await sessionRefresher.refresh();
  if (refreshResult.isOk) {
    return perform();
  }
  if (
    refreshResult.error.kind === "http" &&
    refreshResult.error.status === UNAUTHORIZED_STATUS
  ) {
    onSessionExpired();
    return first;
  }
  // A refresh that failed for any other reason (network, timeout, 5xx, 429,
  // invalid response) says nothing about the session, so the caller gets that
  // failure and the session is left alone (auth-cloud plan, Vấn đề 18).
  return refreshResult;
}

export function createRawAuthCalls(input: {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;
}): RawAuthCalls {
  return {
    me: async () =>
      unwrapUser(
        await sendRequest(input.fetchImpl, input.baseUrl, {
          method: "GET",
          routeTemplate: "/auth/me",
          path: "/auth/me",
          schema: authUserResponseSchema,
        }),
      ),
    refresh: () =>
      sendRequest(input.fetchImpl, input.baseUrl, {
        method: "POST",
        routeTemplate: "/auth/refresh",
        path: "/auth/refresh",
        schema: VOID_RESPONSE_SCHEMA,
      }),
  };
}

function buildSchemaListQuery(query: ListSchemasQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.cursor !== undefined) {
    params.set("cursor", query.cursor);
  }
  return params;
}

export function createApiClient(input: {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;
  readonly sessionRefresher: SessionRefresher;
  readonly onSessionExpired: () => void;
}): ApiClient {
  function sendWithRefresh<T>(
    spec: SendSpec<T>,
  ): Promise<Result<T, ApiFailure>> {
    return withAutoRefresh(
      spec.routeTemplate,
      input.sessionRefresher,
      input.onSessionExpired,
      () => sendRequest(input.fetchImpl, input.baseUrl, spec),
    );
  }

  // Schema ids are UUIDs. Checking before the URL is built stops ids such as
  // "." or ".." from being normalized into a different endpoint. A bad id is
  // a programmer error, so it rejects instead of returning an ApiFailure, and
  // the message leaves the id out because errors can reach the logs.
  function sendForSchema<T>(
    id: string,
    spec: Omit<SendSpec<T>, "path" | "routeTemplate">,
  ): Promise<Result<T, ApiFailure>> {
    if (!SCHEMA_ID_SCHEMA.safeParse(id).success) {
      return Promise.reject(new Error("The schema id is not a UUID."));
    }
    return sendWithRefresh({
      ...spec,
      routeTemplate: "/schemas/:id",
      path: `/schemas/${encodeURIComponent(id)}`,
    });
  }

  async function sendAuthUser(
    spec: Omit<SendSpec<AuthUserResponse>, "schema">,
  ): Promise<Result<UserResponse, ApiFailure>> {
    return unwrapUser(
      await sendWithRefresh({ ...spec, schema: authUserResponseSchema }),
    );
  }

  return {
    auth: {
      register: (body, options) =>
        sendAuthUser({
          method: "POST",
          routeTemplate: "/auth/register",
          path: "/auth/register",
          body,
          signal: options?.signal,
        }),
      login: (body, options) =>
        sendAuthUser({
          method: "POST",
          routeTemplate: "/auth/login",
          path: "/auth/login",
          body,
          signal: options?.signal,
        }),
      logout: (options) =>
        sendWithRefresh({
          method: "POST",
          routeTemplate: "/auth/logout",
          path: "/auth/logout",
          schema: VOID_RESPONSE_SCHEMA,
          signal: options?.signal,
        }),
      me: (options) =>
        sendAuthUser({
          method: "GET",
          routeTemplate: "/auth/me",
          path: "/auth/me",
          signal: options?.signal,
        }),
    },
    schemas: {
      list: (query, options) =>
        sendWithRefresh({
          method: "GET",
          routeTemplate: "/schemas",
          path: "/schemas",
          schema: schemaListSchema,
          query: buildSchemaListQuery(query),
          signal: options?.signal,
        }),
      get: (id, options) =>
        sendForSchema(id, {
          method: "GET",
          schema: schemaDetailSchema,
          signal: options?.signal,
        }),
      create: (body, options) =>
        sendWithRefresh({
          method: "POST",
          routeTemplate: "/schemas",
          path: "/schemas",
          schema: schemaSummarySchema,
          body,
          signal: options?.signal,
        }),
      update: (id, body, options) =>
        sendForSchema(id, {
          method: "PUT",
          schema: schemaSummarySchema,
          body,
          signal: options?.signal,
        }),
      remove: (id, options) =>
        sendForSchema(id, {
          method: "DELETE",
          schema: VOID_RESPONSE_SCHEMA,
          signal: options?.signal,
        }),
    },
  };
}
