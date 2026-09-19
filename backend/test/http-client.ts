import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";
import type { Response, Test } from "supertest";

import {
  isClearedSetCookie,
  parseSetCookieHeaders,
  type SetCookie,
} from "./set-cookie.js";

/** Matches `CORS_ORIGINS` of `.env.test.example` and of the CI job. */
export const TEST_ORIGIN = "http://localhost:3000";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type RequestOptions = {
  /** Sent as JSON. */
  readonly body?: unknown;
  /** Sent verbatim with `Content-Type: application/json`. */
  readonly rawBody?: string;
  readonly origin?: string;
  readonly shouldOmitOrigin?: boolean;
};

export type HttpClient = {
  readonly request: (
    method: HttpMethod,
    path: string,
    options?: RequestOptions,
  ) => Promise<Response>;
  readonly getCookie: (name: string) => string | null;
  readonly setCookie: (name: string, value: string, path: string) => void;
};

type JarEntry = { readonly value: string; readonly path: string };

const JSON_CONTENT_TYPE = "application/json";
const ROOT_PATH = "/";

function startRequest(
  agent: TestAgent,
  method: HttpMethod,
  path: string,
): Test {
  switch (method) {
    case "GET":
      return agent.get(path);
    case "POST":
      return agent.post(path);
    case "PUT":
      return agent.put(path);
    case "DELETE":
      return agent.delete(path);
    default: {
      const unhandled: never = method;
      throw new Error(`Unhandled HTTP method: ${String(unhandled)}`);
    }
  }
}

function isPathMatch(cookiePath: string, requestPath: string): boolean {
  if (cookiePath === ROOT_PATH) {
    return true;
  }
  return (
    requestPath === cookiePath ||
    requestPath.startsWith(`${cookiePath}${ROOT_PATH}`)
  );
}

function readPath(cookie: SetCookie): string {
  const path = cookie.attributes.get("path");
  return typeof path === "string" && path !== "" ? path : ROOT_PATH;
}

/**
 * Drives the app over HTTP and keeps cookies in its own jar. `superagent`'s
 * agent only replays a `Secure` cookie over `https:`, and the auth cookies are
 * always `Secure` while the test server speaks `http:` (plan issue 12).
 */
export function createHttpClient(app: NestExpressApplication): HttpClient {
  const jar = new Map<string, JarEntry>();

  function buildCookieHeader(path: string): string | null {
    const sent = [...jar.entries()]
      .filter(([, entry]) => isPathMatch(entry.path, path))
      .map(([name, entry]) => `${name}=${entry.value}`);
    return sent.length === 0 ? null : sent.join("; ");
  }

  function applySetCookies(response: Response): void {
    for (const cookie of parseSetCookieHeaders(
      response.headers["set-cookie"],
    )) {
      if (isClearedSetCookie(cookie)) {
        jar.delete(cookie.name);
        continue;
      }
      jar.set(cookie.name, { value: cookie.value, path: readPath(cookie) });
    }
  }

  return {
    request: async (method, path, options = {}): Promise<Response> => {
      let pending = startRequest(request(app.getHttpServer()), method, path);
      if (options.shouldOmitOrigin !== true) {
        pending = pending.set("Origin", options.origin ?? TEST_ORIGIN);
      }
      const cookieHeader = buildCookieHeader(path);
      if (cookieHeader !== null) {
        pending = pending.set("Cookie", cookieHeader);
      }
      const payload =
        options.rawBody ??
        (options.body === undefined ? null : JSON.stringify(options.body));
      if (payload !== null) {
        pending = pending.set("Content-Type", JSON_CONTENT_TYPE).send(payload);
      }
      const response = await pending;
      applySetCookies(response);
      return response;
    },
    getCookie: (name): string | null => jar.get(name)?.value ?? null,
    setCookie: (name, value, path): void => {
      jar.set(name, { value, path });
    },
  };
}
