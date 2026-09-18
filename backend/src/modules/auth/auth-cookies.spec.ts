import { Controller, Get, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import type { Request, Response } from "express";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import type { Env } from "../../config/env.js";
import {
  ACCESS_TOKEN_COOKIE,
  AuthCookies,
  readCookie,
} from "./auth-cookies.js";

// Stand-ins for token values, obviously not real ones.
const ACCESS_VALUE = "access-value";
const REFRESH_VALUE = "refresh-value";

@Controller("probe")
class CookieProbeController {
  constructor(private readonly authCookies: AuthCookies) {}

  @Get("set")
  set(@Res({ passthrough: true }) response: Response): void {
    this.authCookies.set(response, {
      accessToken: ACCESS_VALUE,
      refreshToken: REFRESH_VALUE,
    });
  }

  @Get("clear")
  clear(@Res({ passthrough: true }) response: Response): void {
    this.authCookies.clear(response);
  }

  @Get("read")
  read(@Req() incoming: Request): { readonly value: string | null } {
    return { value: readCookie(incoming, ACCESS_TOKEN_COOKIE) };
  }
}

async function createProbeApp(
  isSecure: boolean,
): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [CookieProbeController],
    providers: [
      AuthCookies,
      {
        provide: ConfigService,
        useValue: new ConfigService<Pick<Env, "AUTH_COOKIE_SECURE">, true>({
          AUTH_COOKIE_SECURE: isSecure,
        }),
      },
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.use(cookieParser());
  await app.init();
  return app;
}

function readSetCookies(headers: Record<string, unknown>): readonly string[] {
  const value: unknown = headers["set-cookie"];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function cookieAttributes(
  setCookies: readonly string[],
  name: string,
): readonly string[] {
  return (
    setCookies
      .find((cookie) => cookie.startsWith(`${name}=`))
      ?.split(";")
      .map((part) => part.trim()) ?? []
  );
}

describe("AuthCookies", () => {
  let app: NestExpressApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("sets the access cookie with HttpOnly, Secure, SameSite Strict, Path / and Max-Age 900", async () => {
    app = await createProbeApp(true);

    const response = await request(app.getHttpServer()).get("/probe/set");

    expect(
      cookieAttributes(readSetCookies(response.headers), "sf-access"),
    ).toEqual(
      expect.arrayContaining([
        `sf-access=${ACCESS_VALUE}`,
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        "Path=/",
        "Max-Age=900",
      ]),
    );
  });

  it("sets the refresh cookie with Path /auth and Max-Age 2592000", async () => {
    app = await createProbeApp(true);

    const response = await request(app.getHttpServer()).get("/probe/set");

    expect(
      cookieAttributes(readSetCookies(response.headers), "sf-refresh"),
    ).toEqual(
      expect.arrayContaining([
        `sf-refresh=${REFRESH_VALUE}`,
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
        "Path=/auth",
        "Max-Age=2592000",
      ]),
    );
  });

  it("omits Secure when AUTH_COOKIE_SECURE is false", async () => {
    app = await createProbeApp(false);

    const response = await request(app.getHttpServer()).get("/probe/set");

    const setCookies = readSetCookies(response.headers);
    expect(setCookies).toHaveLength(2);
    expect(cookieAttributes(setCookies, "sf-access")).not.toContain("Secure");
    expect(cookieAttributes(setCookies, "sf-refresh")).not.toContain("Secure");
  });

  it("never sets a Domain attribute", async () => {
    app = await createProbeApp(true);

    const response = await request(app.getHttpServer()).get("/probe/set");

    const setCookies = readSetCookies(response.headers);
    expect(setCookies).toHaveLength(2);
    expect(setCookies.join(";").toLowerCase()).not.toContain("domain=");
  });

  it("clears both cookies on their own paths", async () => {
    app = await createProbeApp(true);

    const response = await request(app.getHttpServer()).get("/probe/clear");

    const setCookies = readSetCookies(response.headers);
    const expired = "Expires=Thu, 01 Jan 1970 00:00:00 GMT";
    expect(cookieAttributes(setCookies, "sf-access")).toEqual(
      expect.arrayContaining([
        "sf-access=",
        "Path=/",
        expired,
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
      ]),
    );
    expect(cookieAttributes(setCookies, "sf-refresh")).toEqual(
      expect.arrayContaining([
        "sf-refresh=",
        "Path=/auth",
        expired,
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
      ]),
    );
  });

  it("reads a cookie value", async () => {
    app = await createProbeApp(true);

    const response = await request(app.getHttpServer())
      .get("/probe/read")
      .set("Cookie", `sf-access=${ACCESS_VALUE}`);

    expect(response.body).toEqual({ value: ACCESS_VALUE });
  });

  it.each([
    { label: "missing", cookieHeader: "other=1" },
    { label: "empty", cookieHeader: "sf-access=" },
  ])(
    "returns null for a missing or empty cookie ($label)",
    async ({ cookieHeader }) => {
      app = await createProbeApp(true);

      const response = await request(app.getHttpServer())
        .get("/probe/read")
        .set("Cookie", cookieHeader);

      expect(response.body).toEqual({ value: null });
    },
  );
});
