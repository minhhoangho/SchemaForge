import { authUserResponseSchema } from "@schemaforge/api-contract";
import type { Response } from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestApp, type TestApp } from "./create-test-app.js";
import { registerUser, TEST_PASSWORD, testEmail } from "./factories.js";
import { createHttpClient, type HttpClient } from "./http-client.js";
import {
  clearedCookieFacts,
  cookieFacts,
  lastResponse,
  readBody,
  retryAfterSeconds,
} from "./response-facts.js";
import {
  isPublicRoute,
  listRoutes,
  probeRoutes,
  PUBLIC_ROUTES,
} from "./routes.js";

const ACCESS_COOKIE = "sf-access";
const REFRESH_COOKIE = "sf-refresh";
const ACCESS_MAX_AGE = "900";
const REFRESH_MAX_AGE = "2592000";
const REFRESH_PATH = "/auth";
const ROOT_PATH = "/";

const UNAUTHENTICATED = { statusCode: 401, code: "unauthenticated" };
const SESSION_EXPIRED = { statusCode: 401, code: "session-expired" };
const INVALID_CREDENTIALS = { statusCode: 401, code: "invalid-credentials" };

const LOGIN_ATTEMPTS_PER_WINDOW = 10;
const REGISTRATIONS_PER_WINDOW = 5;
const WRONG_PASSWORD = `${TEST_PASSWORD}-not-the-one`;

// Loops live in these helpers so the tests themselves stay flat (testing.md).
async function repeatLogin(
  client: HttpClient,
  email: string,
  count: number,
): Promise<readonly Response[]> {
  const responses: Response[] = [];
  for (let attempt = 0; attempt < count; attempt += 1) {
    responses.push(
      await client.request("POST", "/auth/login", {
        body: { email, password: WRONG_PASSWORD },
      }),
    );
  }
  return responses;
}

async function repeatRegister(
  client: HttpClient,
  count: number,
  options?: { readonly shouldOmitOrigin?: boolean },
): Promise<readonly Response[]> {
  const responses: Response[] = [];
  for (let attempt = 0; attempt < count; attempt += 1) {
    responses.push(
      await client.request("POST", "/auth/register", {
        body: {
          email: testEmail(`repeat-${String(attempt)}`),
          password: TEST_PASSWORD,
        },
        shouldOmitOrigin: options?.shouldOmitOrigin,
      }),
    );
  }
  return responses;
}

describe("auth e2e", () => {
  let testApp: TestApp;
  let client: HttpClient;

  beforeEach(async () => {
    testApp = await createTestApp();
    client = createHttpClient(testApp.app);
  });

  afterEach(async () => {
    await testApp.close();
  });

  describe("journey 1: register, me, sign out", () => {
    it("registers a user and sets sf-access and sf-refresh with HttpOnly, Secure, SameSite Strict and their paths", async () => {
      const response = await client.request("POST", "/auth/register", {
        body: { email: " Alice@Example.COM ", password: TEST_PASSWORD },
      });

      expect(response.status).toBe(201);
      expect(authUserResponseSchema.parse(readBody(response)).user.email).toBe(
        "alice@example.com",
      );
      expect(cookieFacts(response, ACCESS_COOKIE)).toEqual({
        isHttpOnly: true,
        isSecure: true,
        sameSite: "Strict",
        path: ROOT_PATH,
        maxAge: ACCESS_MAX_AGE,
        hasDomain: false,
      });
      expect(cookieFacts(response, REFRESH_COOKIE)).toEqual({
        isHttpOnly: true,
        isSecure: true,
        sameSite: "Strict",
        path: REFRESH_PATH,
        maxAge: REFRESH_MAX_AGE,
        hasDomain: false,
      });
    });

    it("returns the registered user from me", async () => {
      const registered = await registerUser(client, "me-journey");

      const response = await client.request("GET", "/auth/me");

      // The schema already pins createdAt to an ISO datetime.
      const { user } = authUserResponseSchema.parse(readBody(response));

      expect(response.status).toBe(200);
      expect({ id: user.id, email: user.email }).toEqual({
        id: registered.userId,
        email: registered.email,
      });
    });

    it("signs out, clears both cookies and me answers unauthenticated", async () => {
      await registerUser(client, "sign-out");

      const logout = await client.request("POST", "/auth/logout");
      const me = await client.request("GET", "/auth/me");

      expect(logout.status).toBe(204);
      expect(clearedCookieFacts(logout, ACCESS_COOKIE)).toEqual({
        isCleared: true,
        path: ROOT_PATH,
      });
      expect(clearedCookieFacts(logout, REFRESH_COOKIE)).toEqual({
        isCleared: true,
        path: REFRESH_PATH,
      });
      expect(me.status).toBe(401);
      expect(readBody(me)).toEqual(UNAUTHENTICATED);
    });

    it("rejects the refresh token of a signed-out session with session-expired", async () => {
      await registerUser(client, "revoked-refresh");
      const refreshToken = client.getCookie(REFRESH_COOKIE) ?? "";
      await client.request("POST", "/auth/logout");
      client.setCookie(REFRESH_COOKIE, refreshToken, REFRESH_PATH);

      const response = await client.request("POST", "/auth/refresh");

      expect(response.status).toBe(401);
      expect(readBody(response)).toEqual(SESSION_EXPIRED);
    });

    it("signs in again with the registered credentials", async () => {
      const registered = await registerUser(client, "sign-in-again");
      await client.request("POST", "/auth/logout");

      const response = await client.request("POST", "/auth/login", {
        body: { email: registered.email, password: TEST_PASSWORD },
      });

      expect(response.status).toBe(200);
      expect(authUserResponseSchema.parse(readBody(response)).user.id).toBe(
        registered.userId,
      );
      expect(cookieFacts(response, ACCESS_COOKIE)?.maxAge).toBe(ACCESS_MAX_AGE);
    });

    it("rejects registering an existing email in another case with email-already-registered", async () => {
      await registerUser(client, "duplicate");

      const response = await client.request("POST", "/auth/register", {
        body: { email: "DUPLICATE@Example.com", password: TEST_PASSWORD },
      });

      expect(response.status).toBe(409);
      expect(readBody(response)).toEqual({
        statusCode: 409,
        code: "email-already-registered",
      });
    });

    it("rejects a common password with password-too-common", async () => {
      const response = await client.request("POST", "/auth/register", {
        body: { email: testEmail("common-password"), password: "password123" },
      });

      expect(response.status).toBe(400);
      expect(readBody(response)).toEqual({
        statusCode: 400,
        code: "password-too-common",
      });
    });

    it("rejects a password shorter than 8 characters with validation-failed", async () => {
      const response = await client.request("POST", "/auth/register", {
        body: { email: testEmail("short-password"), password: "ab3De!" },
      });

      expect(response.status).toBe(400);
      expect(readBody(response)).toMatchObject({
        statusCode: 400,
        code: "validation-failed",
      });
    });
  });

  describe("journey 2: indistinguishable sign-in failures", () => {
    it("answers a wrong password and an unknown email with the same status and body", async () => {
      const registered = await registerUser(client, "known-user");

      const wrongPassword = await client.request("POST", "/auth/login", {
        body: { email: registered.email, password: WRONG_PASSWORD },
      });
      const unknownEmail = await client.request("POST", "/auth/login", {
        body: { email: testEmail("never-registered"), password: TEST_PASSWORD },
      });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(readBody(wrongPassword)).toEqual(INVALID_CREDENTIALS);
      expect(readBody(unknownEmail)).toEqual(INVALID_CREDENTIALS);
    });
  });

  describe("journey 3: refresh rotation", () => {
    it("rotates the refresh token and sets new cookies", async () => {
      await registerUser(client, "rotation");
      const firstToken = client.getCookie(REFRESH_COOKIE);

      const refresh = await client.request("POST", "/auth/refresh");
      const me = await client.request("GET", "/auth/me");

      expect(refresh.status).toBe(204);
      expect(client.getCookie(REFRESH_COOKIE)).not.toBe(firstToken);
      expect(cookieFacts(refresh, REFRESH_COOKIE)).toEqual({
        isHttpOnly: true,
        isSecure: true,
        sameSite: "Strict",
        path: REFRESH_PATH,
        maxAge: REFRESH_MAX_AGE,
        hasDomain: false,
      });
      expect(me.status).toBe(200);
    });

    it("rejects a reused refresh token and revokes the newer token of the same family", async () => {
      await registerUser(client, "reuse");
      const firstToken = client.getCookie(REFRESH_COOKIE) ?? "";
      await client.request("POST", "/auth/refresh");
      const secondToken = client.getCookie(REFRESH_COOKIE) ?? "";

      client.setCookie(REFRESH_COOKIE, firstToken, REFRESH_PATH);
      const reused = await client.request("POST", "/auth/refresh");
      client.setCookie(REFRESH_COOKIE, secondToken, REFRESH_PATH);
      const revoked = await client.request("POST", "/auth/refresh");

      expect(readBody(reused)).toEqual(SESSION_EXPIRED);
      expect(revoked.status).toBe(401);
      expect(readBody(revoked)).toEqual(SESSION_EXPIRED);
    });

    it("rejects refresh without a cookie with session-expired and clears the cookies", async () => {
      const response = await client.request("POST", "/auth/refresh");

      expect(response.status).toBe(401);
      expect(readBody(response)).toEqual(SESSION_EXPIRED);
      expect(clearedCookieFacts(response, ACCESS_COOKIE)).toEqual({
        isCleared: true,
        path: ROOT_PATH,
      });
      expect(clearedCookieFacts(response, REFRESH_COOKIE)).toEqual({
        isCleared: true,
        path: REFRESH_PATH,
      });
    });
  });

  describe("journey 11: rate limits", () => {
    it("answers the first 10 sign-ins for an email with invalid-credentials and the 11th with too-many-requests and Retry-After", async () => {
      const registered = await registerUser(client, "rate-limited-login");

      const responses = await repeatLogin(
        client,
        registered.email,
        LOGIN_ATTEMPTS_PER_WINDOW + 1,
      );

      expect(responses.map((response) => response.status)).toEqual([
        ...Array.from({ length: LOGIN_ATTEMPTS_PER_WINDOW }, () => 401),
        429,
      ]);
      expect(readBody(lastResponse(responses))).toEqual({
        statusCode: 429,
        code: "too-many-requests",
      });
      expect(retryAfterSeconds(lastResponse(responses))).toBeGreaterThan(0);
    });

    it("rejects the 6th registration from the same ip within an hour with too-many-requests and Retry-After", async () => {
      const responses = await repeatRegister(
        client,
        REGISTRATIONS_PER_WINDOW + 1,
      );

      expect(responses.map((response) => response.status)).toEqual([
        ...Array.from({ length: REGISTRATIONS_PER_WINDOW }, () => 201),
        429,
      ]);
      expect(retryAfterSeconds(lastResponse(responses))).toBeGreaterThan(0);
    });
  });

  describe("guards", () => {
    it("rejects a state-changing request without an Origin header before it spends rate limit quota", async () => {
      const blocked = await repeatRegister(
        client,
        REGISTRATIONS_PER_WINDOW + 1,
        { shouldOmitOrigin: true },
      );

      const allowed = await client.request("POST", "/auth/register", {
        body: {
          email: testEmail("after-blocked-origin"),
          password: TEST_PASSWORD,
        },
      });

      expect(blocked.map((response) => response.status)).toEqual(
        Array.from({ length: REGISTRATIONS_PER_WINDOW + 1 }, () => 403),
      );
      expect(readBody(lastResponse(blocked))).toEqual({
        statusCode: 403,
        code: "origin-not-allowed",
      });
      expect(allowed.status).toBe(201);
    });

    it("answers unauthenticated on every route that is not one of the five public routes", async () => {
      const privateRoutes = listRoutes(testApp.app).filter(
        (route) => !isPublicRoute(route),
      );

      const responses = await probeRoutes(client, privateRoutes);

      expect(privateRoutes.length).toBeGreaterThan(0);
      expect(responses.map((response) => readBody(response))).toEqual(
        privateRoutes.map(() => UNAUTHENTICATED),
      );
    });

    it("serves the five documented public routes without a session", async () => {
      const responses = await probeRoutes(client, PUBLIC_ROUTES);

      expect(
        responses.map((response) => readBody(response)),
      ).not.toContainEqual(UNAUTHENTICATED);
      expect(listRoutes(testApp.app).filter(isPublicRoute)).toHaveLength(
        PUBLIC_ROUTES.length,
      );
    });
  });
});
