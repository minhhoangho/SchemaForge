import {
  API_ERROR_STATUS,
  MAX_SCHEMAS_PER_USER,
  SCHEMA_LIST_DEFAULT_LIMIT,
  SCHEMA_LIST_MAX_LIMIT,
} from "@schemaforge/api-contract";
import type {
  ApiErrorBody,
  SimpleApiErrorCode,
} from "@schemaforge/api-contract";
import { parseSchemaDocument } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";

import { isSchemaId } from "@/lib/storage/schema-id";

export type RecordedRequest = {
  readonly method: string;
  /** Pathname with its query string, without the origin. */
  readonly path: string;
  /** The parsed JSON body, or null for a request without one. */
  readonly body: unknown;
};

export type StoredCloudSchema = {
  readonly revision: number;
  readonly document: SchemaDocument;
};

export type FakeApiBackend = {
  /** Passed to createApiClient as its fetchImpl. */
  readonly fetch: typeof fetch;
  readonly requests: readonly RecordedRequest[];
  readonly seedUser: (input: {
    readonly email: string;
    readonly password: string;
  }) => string;
  readonly seedSchema: (input: {
    readonly ownerId: string;
    readonly id: string;
    readonly document: SchemaDocument;
  }) => void;
  /** As if this browser already held a valid session cookie. */
  readonly signInAs: (userId: string) => void;
  /** The next request answers 401; a refresh still succeeds. */
  readonly expireAccessToken: () => void;
  /** While offline, fetch rejects with a TypeError, as the browser does. */
  readonly setOffline: (isOffline: boolean) => void;
  readonly writeFromOtherDevice: (id: string, document: SchemaDocument) => void;
  readonly deleteFromOtherDevice: (id: string) => void;
  readonly getStoredSchema: (id: string) => StoredCloudSchema | null;
};

type StoredUser = {
  readonly id: string;
  readonly email: string;
  readonly password: string;
  readonly createdAt: number;
};

type StoredSchema = StoredCloudSchema & {
  readonly id: string;
  readonly ownerId: string;
  readonly createdAt: number;
  readonly updatedAt: number;
};

type BackendState = {
  readonly clock: () => number;
  readonly users: Map<string, StoredUser>;
  readonly schemas: Map<string, StoredSchema>;
  signedInUserId: string | null;
  isAccessTokenExpired: boolean;
  isOffline: boolean;
  userCount: number;
};

type Cursor = { readonly updatedAt: number; readonly id: string };

const JSON_HEADERS = { "Content-Type": "application/json" };
const OK_STATUS = 200;
const CREATED_STATUS = 201;
const NO_CONTENT_STATUS = 204;
const MAX_DOCUMENT_ERRORS = 100;
const USER_ID_PREFIX = "90000000-0000-4000-8000-";
const ID_SUFFIX_LENGTH = 12;
const SCHEMA_PATH_PATTERN = /^\/schemas\/([^/]+)$/;

// The five routes spec section 5 marks @Public(); every other route needs a
// session.
const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  "POST /auth/register",
  "POST /auth/login",
  "POST /auth/refresh",
  "POST /auth/logout",
  "GET /health",
]);

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function errorResponse(code: SimpleApiErrorCode): Response {
  const body: ApiErrorBody = { statusCode: API_ERROR_STATUS[code], code };
  return jsonResponse(body, body.statusCode);
}

function validationFailed(path: string): Response {
  const body: ApiErrorBody = {
    statusCode: API_ERROR_STATUS["validation-failed"],
    code: "validation-failed",
    fields: [{ path, constraint: "isValid" }],
  };
  return jsonResponse(body, body.statusCode);
}

function revisionConflict(currentRevision: number): Response {
  const body: ApiErrorBody = {
    statusCode: API_ERROR_STATUS["revision-conflict"],
    code: "revision-conflict",
    currentRevision,
  };
  return jsonResponse(body, body.statusCode);
}

function documentInvalid(value: unknown): Response | SchemaDocument {
  const parsed = parseSchemaDocument(value);
  if (parsed.isOk) {
    return parsed.value;
  }
  const body: ApiErrorBody = {
    statusCode: API_ERROR_STATUS["document-invalid"],
    code: "document-invalid",
    documentErrors: parsed.error.slice(0, MAX_DOCUMENT_ERRORS),
  };
  return jsonResponse(body, body.statusCode);
}

function isResponse(value: Response | SchemaDocument): value is Response {
  return value instanceof Response;
}

function toIso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

type SchemaSummaryBody = {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function toSummary(entry: StoredSchema): SchemaSummaryBody {
  return {
    id: entry.id,
    name: entry.document.name,
    revision: entry.revision,
    createdAt: toIso(entry.createdAt),
    updatedAt: toIso(entry.updatedAt),
  };
}

function encodeCursor(entry: StoredSchema): string {
  const json = JSON.stringify({ updatedAt: entry.updatedAt, id: entry.id });
  return btoa(json)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeCursor(value: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(
      atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "updatedAt" in parsed &&
      "id" in parsed &&
      typeof parsed.updatedAt === "number" &&
      typeof parsed.id === "string"
    ) {
      return { updatedAt: parsed.updatedAt, id: parsed.id };
    }
    return null;
  } catch {
    return null;
  }
}

// Newest first, then by id descending, like the local list of part 3.
function byNewestFirst(first: StoredSchema, second: StoredSchema): number {
  return second.updatedAt === first.updatedAt
    ? Number(first.id < second.id) - Number(second.id < first.id)
    : second.updatedAt - first.updatedAt;
}

function isAfterCursor(entry: StoredSchema, cursor: Cursor): boolean {
  return (
    entry.updatedAt < cursor.updatedAt ||
    (entry.updatedAt === cursor.updatedAt && entry.id < cursor.id)
  );
}

function readLimit(raw: string | null): number | null {
  if (raw === null) {
    return SCHEMA_LIST_DEFAULT_LIMIT;
  }
  const limit = Number(raw);
  return Number.isInteger(limit) && limit >= 1 && limit <= SCHEMA_LIST_MAX_LIMIT
    ? limit
    : null;
}

function ownedSchemas(
  state: BackendState,
  ownerId: string,
): readonly StoredSchema[] {
  return [...state.schemas.values()]
    .filter((entry) => entry.ownerId === ownerId)
    .toSorted(byNewestFirst);
}

function listSchemas(state: BackendState, url: URL, ownerId: string): Response {
  const limit = readLimit(url.searchParams.get("limit"));
  if (limit === null) {
    return validationFailed("limit");
  }
  const rawCursor = url.searchParams.get("cursor");
  const cursor = rawCursor === null ? null : decodeCursor(rawCursor);
  if (rawCursor !== null && cursor === null) {
    return validationFailed("cursor");
  }
  const matching = ownedSchemas(state, ownerId).filter(
    (entry) => cursor === null || isAfterCursor(entry, cursor),
  );
  const page = matching.slice(0, limit);
  const last = page.at(-1);
  const hasMore = matching.length > page.length && last !== undefined;
  return jsonResponse(
    {
      items: page.map(toSummary),
      nextCursor: hasMore ? encodeCursor(last) : null,
    },
    OK_STATUS,
  );
}

function readField(body: unknown, key: string): unknown {
  return typeof body === "object" && body !== null && key in body
    ? Reflect.get(body, key)
    : undefined;
}

function createSchema(
  state: BackendState,
  body: unknown,
  ownerId: string,
): Response {
  const id = readField(body, "id");
  if (typeof id !== "string" || !isSchemaId(id)) {
    return validationFailed("id");
  }
  if (state.schemas.has(id)) {
    return errorResponse("schema-id-unavailable");
  }
  if (ownedSchemas(state, ownerId).length >= MAX_SCHEMAS_PER_USER) {
    return errorResponse("schema-limit-reached");
  }
  const document = documentInvalid(readField(body, "document"));
  if (isResponse(document)) {
    return document;
  }
  const now = state.clock();
  const entry: StoredSchema = {
    id,
    ownerId,
    document,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
  state.schemas.set(id, entry);
  return jsonResponse(toSummary(entry), CREATED_STATUS);
}

function updateSchema(
  state: BackendState,
  entry: StoredSchema,
  body: unknown,
): Response {
  const document = documentInvalid(readField(body, "document"));
  if (isResponse(document)) {
    return document;
  }
  const expectedRevision = readField(body, "expectedRevision");
  if (typeof expectedRevision !== "number") {
    return validationFailed("expectedRevision");
  }
  if (expectedRevision !== entry.revision) {
    return revisionConflict(entry.revision);
  }
  const updated: StoredSchema = {
    ...entry,
    document,
    revision: entry.revision + 1,
    updatedAt: state.clock(),
  };
  state.schemas.set(entry.id, updated);
  return jsonResponse(toSummary(updated), OK_STATUS);
}

function handleOneSchema(
  state: BackendState,
  method: string,
  schemaId: string,
  body: unknown,
  ownerId: string,
): Response {
  const entry = state.schemas.get(schemaId);
  if (entry === undefined) {
    return errorResponse("not-found");
  }
  // Another account's schema is as invisible as a missing one, spec section 5.
  if (entry.ownerId !== ownerId) {
    return errorResponse("not-found");
  }
  switch (method) {
    case "GET":
      return jsonResponse(
        { ...toSummary(entry), document: entry.document },
        OK_STATUS,
      );
    case "PUT":
      return updateSchema(state, entry, body);
    case "DELETE":
      state.schemas.delete(schemaId);
      return new Response(null, { status: NO_CONTENT_STATUS });
    default:
      return errorResponse("not-found");
  }
}

function userResponse(
  user: StoredUser | undefined,
  status = OK_STATUS,
): Response {
  if (user === undefined) {
    return errorResponse("unauthenticated");
  }
  return jsonResponse(
    {
      user: {
        id: user.id,
        email: user.email,
        createdAt: toIso(user.createdAt),
      },
    },
    status,
  );
}

function handlePrivate(
  state: BackendState,
  method: string,
  url: URL,
  body: unknown,
  userId: string,
): Response {
  if (method === "GET" && url.pathname === "/auth/me") {
    return userResponse(state.users.get(userId));
  }
  if (url.pathname === "/schemas") {
    if (method === "GET") {
      return listSchemas(state, url, userId);
    }
    return method === "POST"
      ? createSchema(state, body, userId)
      : errorResponse("not-found");
  }
  const schemaId = SCHEMA_PATH_PATTERN.exec(url.pathname)?.[1];
  return schemaId === undefined
    ? errorResponse("not-found")
    : handleOneSchema(
        state,
        method,
        decodeURIComponent(schemaId),
        body,
        userId,
      );
}

function readCredentials(
  body: unknown,
): { readonly email: string; readonly password: string } | null {
  const email = readField(body, "email");
  const password = readField(body, "password");
  return typeof email === "string" && typeof password === "string"
    ? { email, password }
    : null;
}

function findByEmail(state: BackendState, email: string): StoredUser | null {
  return [...state.users.values()].find((user) => user.email === email) ?? null;
}

function addUser(
  state: BackendState,
  email: string,
  password: string,
): StoredUser {
  state.userCount += 1;
  const user: StoredUser = {
    id: `${USER_ID_PREFIX}${String(state.userCount).padStart(ID_SUFFIX_LENGTH, "0")}`,
    email,
    password,
    createdAt: state.clock(),
  };
  state.users.set(user.id, user);
  return user;
}

function signIn(state: BackendState, user: StoredUser): void {
  state.signedInUserId = user.id;
  state.isAccessTokenExpired = false;
}

function handleRegister(state: BackendState, body: unknown): Response {
  const credentials = readCredentials(body);
  if (credentials === null) {
    return validationFailed("email");
  }
  if (findByEmail(state, credentials.email) !== null) {
    return errorResponse("email-already-registered");
  }
  const user = addUser(state, credentials.email, credentials.password);
  signIn(state, user);
  return userResponse(user, CREATED_STATUS);
}

function handleLogin(state: BackendState, body: unknown): Response {
  const credentials = readCredentials(body);
  if (credentials === null) {
    return validationFailed("email");
  }
  const user = findByEmail(state, credentials.email);
  // An unknown email and a wrong password answer the same, spec section 2.
  if (user === null) {
    return errorResponse("invalid-credentials");
  }
  if (user.password !== credentials.password) {
    return errorResponse("invalid-credentials");
  }
  signIn(state, user);
  return userResponse(user);
}

function handlePublic(
  state: BackendState,
  route: string,
  body: unknown,
): Response {
  switch (route) {
    case "POST /auth/register":
      return handleRegister(state, body);
    case "POST /auth/login":
      return handleLogin(state, body);
    case "POST /auth/refresh":
      if (state.signedInUserId === null) {
        return errorResponse("session-expired");
      }
      state.isAccessTokenExpired = false;
      return new Response(null, { status: NO_CONTENT_STATUS });
    case "POST /auth/logout":
      state.signedInUserId = null;
      return new Response(null, { status: NO_CONTENT_STATUS });
    default:
      return jsonResponse({ status: "ok" }, OK_STATUS);
  }
}

function respond(
  state: BackendState,
  method: string,
  url: URL,
  body: unknown,
): Response {
  const route = `${method} ${url.pathname}`;
  if (PUBLIC_ROUTES.has(route)) {
    return handlePublic(state, route, body);
  }
  const userId = state.signedInUserId;
  if (userId === null || state.isAccessTokenExpired) {
    return errorResponse("unauthenticated");
  }
  return handlePrivate(state, method, url, body, userId);
}

function toUrl(input: RequestInfo | URL): URL {
  if (input instanceof URL) {
    return input;
  }
  return new URL(typeof input === "string" ? input : input.url);
}

function readBody(init: RequestInit | undefined): unknown {
  const raw = init?.body;
  return typeof raw === "string" ? JSON.parse(raw) : null;
}

/**
 * The part 4 API as an in-memory double behind `fetchImpl`: the routes and
 * error bodies of spec section 5, with the types of `@schemaforge/api-contract`.
 * Every timestamp comes from `clock`, so nothing depends on the real clock, and
 * every request is recorded before it is handled, including one rejected while
 * offline. Documents sent to POST and PUT go through `parseSchemaDocument`, so
 * what is stored and returned is always the parsed form.
 */
export function createFakeApiBackend(input: {
  readonly clock: () => number;
}): FakeApiBackend {
  const state: BackendState = {
    clock: input.clock,
    users: new Map(),
    schemas: new Map(),
    signedInUserId: null,
    isAccessTokenExpired: false,
    isOffline: false,
    userCount: 0,
  };
  const requests: RecordedRequest[] = [];

  function requireSchema(id: string): StoredSchema {
    const entry = state.schemas.get(id);
    if (entry === undefined) {
      throw new Error("The fake backend has no schema with that id.");
    }
    return entry;
  }

  return {
    fetch: (rawInput, init) => {
      const url = toUrl(rawInput);
      requests.push({
        method: init?.method ?? "GET",
        path: `${url.pathname}${url.search}`,
        body: readBody(init),
      });
      if (state.isOffline) {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve(
        respond(state, init?.method ?? "GET", url, readBody(init)),
      );
    },
    requests,
    seedUser: ({ email, password }) => addUser(state, email, password).id,
    seedSchema: ({ ownerId, id, document }) => {
      const now = state.clock();
      state.schemas.set(id, {
        id,
        ownerId,
        document,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      });
    },
    signInAs: (userId) => {
      state.signedInUserId = userId;
      state.isAccessTokenExpired = false;
    },
    expireAccessToken: () => {
      state.isAccessTokenExpired = true;
    },
    setOffline: (isOffline) => {
      state.isOffline = isOffline;
    },
    writeFromOtherDevice: (id, document) => {
      const entry = requireSchema(id);
      state.schemas.set(id, {
        ...entry,
        document,
        revision: entry.revision + 1,
        updatedAt: state.clock(),
      });
    },
    deleteFromOtherDevice: (id) => {
      state.schemas.delete(id);
    },
    getStoredSchema: (id) => {
      const entry = state.schemas.get(id);
      return entry === undefined
        ? null
        : { revision: entry.revision, document: entry.document };
    },
  };
}
