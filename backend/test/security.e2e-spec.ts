import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestApp, type TestApp } from "./create-test-app.js";
import { registerUser, TEST_PASSWORD, testEmail } from "./factories.js";
import {
  createHttpClient,
  type HttpClient,
  TEST_ORIGIN,
} from "./http-client.js";
import { lastResponse, readBody } from "./response-facts.js";
import { listRoutes, probeRoutes, type RouteEntry } from "./routes.js";

// Expected lists, written by hand on purpose: they pin spec section 5 instead of
// being derived from the controllers under test.
const EXPECTED_PUBLIC_ROUTES: readonly RouteEntry[] = [
  { method: "GET", path: "/health" },
  { method: "POST", path: "/auth/register" },
  { method: "POST", path: "/auth/login" },
  { method: "POST", path: "/auth/refresh" },
  { method: "POST", path: "/auth/logout" },
];
const PRIVATE_ROUTES: readonly RouteEntry[] = [
  { method: "GET", path: "/auth/me" },
  { method: "GET", path: "/schemas" },
  { method: "GET", path: "/schemas/:id" },
  { method: "POST", path: "/schemas" },
  { method: "PUT", path: "/schemas/:id" },
  { method: "DELETE", path: "/schemas/:id" },
];

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const UNKNOWN_ORIGIN = "https://evil.example.com";
const ORIGIN_NOT_ALLOWED = { statusCode: 403, code: "origin-not-allowed" };
const UNAUTHENTICATED = { statusCode: 401, code: "unauthenticated" };
// A stored document written by a newer core (spec section 5 "Validate tài liệu").
const FUTURE_DOCUMENT = { version: 999 };

function routeName(route: RouteEntry): string {
  return `${route.method} ${route.path}`;
}

function sortedRouteNames(routes: readonly RouteEntry[]): readonly string[] {
  return routes.map(routeName).sort();
}

/** Routes whose anonymous probe does not answer `unauthenticated`. */
async function listAnonymouslyReachableRoutes(
  client: HttpClient,
  routes: readonly RouteEntry[],
): Promise<readonly RouteEntry[]> {
  const responses = await probeRoutes(client, routes);
  const isRejected = responses.map((response) =>
    isDeepStrictEqual(readBody(response), UNAUTHENTICATED),
  );
  return routes.filter((_route, index) => isRejected[index] === false);
}

describe("security e2e", () => {
  let testApp: TestApp;
  let client: HttpClient;

  beforeEach(async () => {
    testApp = await createTestApp();
    client = createHttpClient(testApp.app);
  });

  afterEach(async () => {
    await testApp.close();
  });

  describe("journey 10: origin and CORS", () => {
    it.each([
      { method: "POST", path: "/auth/register" },
      { method: "POST", path: "/auth/login" },
      { method: "POST", path: "/auth/logout" },
      { method: "POST", path: "/schemas" },
      { method: "PUT", path: `/schemas/${SCHEMA_ID}` },
      { method: "DELETE", path: `/schemas/${SCHEMA_ID}` },
    ] as const)(
      "rejects a state-changing request without an Origin header with origin-not-allowed ($method $path)",
      async ({ method, path }) => {
        const response = await client.request(method, path, {
          body: {},
          shouldOmitOrigin: true,
        });

        expect(response.status).toBe(403);
        expect(readBody(response)).toEqual(ORIGIN_NOT_ALLOWED);
      },
    );

    it.each([
      { name: "Origin null", origin: "null" },
      { name: "an unknown origin", origin: UNKNOWN_ORIGIN },
    ])("rejects $name with origin-not-allowed", async ({ origin }) => {
      const response = await client.request("POST", "/auth/register", {
        body: { email: testEmail("foreign-origin"), password: TEST_PASSWORD },
        origin,
      });

      expect(response.status).toBe(403);
      expect(readBody(response)).toEqual(ORIGIN_NOT_ALLOWED);
    });

    it("answers a preflight from the configured origin with Access-Control-Allow-Origin and Access-Control-Allow-Credentials true", async () => {
      const response = await request(testApp.app.getHttpServer())
        .options("/schemas")
        .set("Origin", TEST_ORIGIN)
        .set("Access-Control-Request-Method", "PUT");

      expect(response.headers["access-control-allow-origin"]).toBe(TEST_ORIGIN);
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("omits Access-Control-Allow-Origin on a preflight from an unknown origin", async () => {
      const response = await request(testApp.app.getHttpServer())
        .options("/schemas")
        .set("Origin", UNKNOWN_ORIGIN)
        .set("Access-Control-Request-Method", "PUT");

      expect(response.headers).not.toHaveProperty(
        "access-control-allow-origin",
      );
    });

    it("omits Access-Control-Allow-Origin on a GET from an unknown origin", async () => {
      const response = await client.request("GET", "/health", {
        origin: UNKNOWN_ORIGIN,
      });

      expect(response.status).toBe(200);
      expect(response.headers).not.toHaveProperty(
        "access-control-allow-origin",
      );
    });

    it("sends Cross-Origin-Resource-Policy same-site together with the CORS headers on a GET from the configured origin", async () => {
      const response = await client.request("GET", "/health");

      expect(response.headers).toMatchObject({
        "cross-origin-resource-policy": "same-site",
        "access-control-allow-origin": TEST_ORIGIN,
        "access-control-allow-credentials": "true",
      });
    });
  });

  describe("journey 12: public and private routes", () => {
    it("discovers exactly the expected routes", () => {
      expect(sortedRouteNames(listRoutes(testApp.app))).toEqual(
        sortedRouteNames([...EXPECTED_PUBLIC_ROUTES, ...PRIVATE_ROUTES]),
      );
    });

    it("marks exactly the five public routes of spec section 5 as public", async () => {
      const reachable = await listAnonymouslyReachableRoutes(
        client,
        listRoutes(testApp.app),
      );

      expect(sortedRouteNames(reachable)).toEqual(
        sortedRouteNames(EXPECTED_PUBLIC_ROUTES),
      );
    });

    it.each(PRIVATE_ROUTES)(
      "answers $method $path without a cookie with unauthenticated",
      async (route) => {
        const response = lastResponse(await probeRoutes(client, [route]));

        expect(response.status).toBe(401);
        expect(readBody(response)).toEqual(UNAUTHENTICATED);
      },
    );
  });

  describe("journey 13: headers and error responses", () => {
    it("sends the Helmet headers on an API response", async () => {
      const response = await client.request("GET", "/health");
      const policy = String(response.headers["content-security-policy"]);

      expect(policy).toContain("default-src 'none'");
      expect(policy).toContain("frame-ancestors 'none'");
      expect(policy).toContain("base-uri 'none'");
      expect(policy).toContain("form-action 'none'");
      expect(response.headers).toHaveProperty("strict-transport-security");
      expect(response.headers).toHaveProperty("x-frame-options");
      expect(response.headers).toMatchObject({
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
      });
      expect(response.headers).not.toHaveProperty("x-powered-by");
    });

    it("answers an unparseable stored document with internal-error and no stack, SQL or Prisma details", async () => {
      const { userId } = await registerUser(client, "future-document");
      const id = randomUUID();
      await testApp.prisma.schema.create({
        data: {
          id,
          ownerId: userId,
          name: "future",
          document: FUTURE_DOCUMENT,
        },
      });

      const response = await client.request("GET", `/schemas/${id}`);

      expect(response.status).toBe(500);
      expect(readBody(response)).toEqual({
        statusCode: 500,
        code: "internal-error",
      });
      expect(response.text.toLowerCase()).not.toContain("prisma");
      expect(response.text).not.toContain("stack");
      expect(response.text).not.toContain("SELECT");
      expect(response.text).not.toContain("at ");
    });

    it("answers an unknown route with not-found in the error shape", async () => {
      const response = await client.request("GET", "/no-such-route");

      expect(response.status).toBe(404);
      expect(readBody(response)).toEqual({
        statusCode: 404,
        code: "not-found",
      });
    });

    it("answers a unique violation without Prisma details", async () => {
      await registerUser(client, "unique-violation");

      const response = await client.request("POST", "/auth/register", {
        body: { email: testEmail("unique-violation"), password: TEST_PASSWORD },
      });

      expect(response.status).toBe(409);
      expect(readBody(response)).toEqual({
        statusCode: 409,
        code: "email-already-registered",
      });
    });
  });
});
