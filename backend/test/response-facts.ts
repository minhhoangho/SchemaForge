import type { Response } from "supertest";

import {
  findSetCookie,
  isClearedSetCookie,
  parseSetCookieHeaders,
  type SetCookie,
} from "./set-cookie.js";

/** Everything a test asserts about a cookie the server just set, in one object. */
export type CookieFacts = {
  readonly isHttpOnly: boolean;
  readonly isSecure: boolean;
  readonly sameSite: string | true | undefined;
  readonly path: string | true | undefined;
  readonly maxAge: string | true | undefined;
  readonly hasDomain: boolean;
};

export type ClearedCookieFacts = {
  readonly isCleared: boolean;
  readonly path: string | true | undefined;
};

export function responseCookies(response: Response): readonly SetCookie[] {
  return parseSetCookieHeaders(response.headers["set-cookie"]);
}

export function cookieFacts(
  response: Response,
  name: string,
): CookieFacts | null {
  const cookie = findSetCookie(responseCookies(response), name);
  if (cookie === null) {
    return null;
  }
  return {
    isHttpOnly: cookie.attributes.get("httponly") === true,
    isSecure: cookie.attributes.get("secure") === true,
    sameSite: cookie.attributes.get("samesite"),
    path: cookie.attributes.get("path"),
    maxAge: cookie.attributes.get("max-age"),
    hasDomain: cookie.attributes.has("domain"),
  };
}

export function clearedCookieFacts(
  response: Response,
  name: string,
): ClearedCookieFacts {
  const cookie = findSetCookie(responseCookies(response), name);
  return {
    isCleared: cookie !== null && isClearedSetCookie(cookie),
    path: cookie?.attributes.get("path"),
  };
}

/** `supertest` types the parsed body as `any`; tests narrow it themselves. */
export function readBody(response: Response): unknown {
  return response.body;
}

export function lastResponse(responses: readonly Response[]): Response {
  const last = responses.at(-1);
  if (last === undefined) {
    throw new Error("Expected at least one response");
  }
  return last;
}

export function retryAfterSeconds(response: Response): number {
  const header: unknown = response.headers["retry-after"];
  return typeof header === "string" ? Number(header) : Number.NaN;
}
