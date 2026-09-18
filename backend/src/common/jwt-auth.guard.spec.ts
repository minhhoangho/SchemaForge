import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { Env } from "../config/env.js";
import { AccessTokenService } from "../modules/auth/access-token.service.js";
import { JwtStrategy } from "../modules/auth/jwt.strategy.js";
import { ApiExceptionFilter } from "./api-exception.filter.js";
import { Clock } from "./clock.js";
import {
  type AuthenticatedUser,
  CurrentUser,
} from "./current-user.decorator.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { Public } from "./public.decorator.js";

// Obviously fake signing keys, 32 characters long like the env schema requires.
const SIGNING_KEY = "k".repeat(32);
const OTHER_SIGNING_KEY = "o".repeat(32);
const USER_ID = "0190f3a0-0000-7000-8000-000000000001";
const ISSUED_AT = new Date("2026-09-18T10:00:00.000Z");
const ACCESS_TTL_MS = 15 * 60 * 1000;
const UNAUTHENTICATED = { statusCode: 401, code: "unauthenticated" };

class FixedClock extends Clock {
  override now(): Date {
    return ISSUED_AT;
  }
}

@Controller("probe")
class AuthProbeController {
  @Public()
  @Get("public")
  open(): { readonly isOpen: boolean } {
    return { isOpen: true };
  }

  @Get("private")
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}

describe("JwtAuthGuard", () => {
  let app: NestExpressApplication;
  let accessTokens: AccessTokenService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: SIGNING_KEY })],
      controllers: [AuthProbeController],
      providers: [
        JwtStrategy,
        AccessTokenService,
        { provide: Clock, useClass: FixedClock },
        {
          provide: ConfigService,
          useValue: new ConfigService<Pick<Env, "JWT_ACCESS_SECRET">, true>({
            JWT_ACCESS_SECRET: SIGNING_KEY,
          }),
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.use(cookieParser());
    await app.init();
    accessTokens = moduleRef.get(AccessTokenService);
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ISSUED_AT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getPrivate(cookie?: string): request.Test {
    const pending = request(app.getHttpServer()).get("/probe/private");
    return cookie === undefined ? pending : pending.set("Cookie", cookie);
  }

  it("allows a public route without a cookie", async () => {
    const response = await request(app.getHttpServer()).get("/probe/public");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ isOpen: true });
  });

  it("rejects a private route without a cookie with unauthenticated", async () => {
    const response = await getPrivate();

    expect(response.status).toBe(401);
    expect(response.body).toEqual(UNAUTHENTICATED);
  });

  it("passes the user id of a valid sf-access cookie to the handler", async () => {
    const token = await accessTokens.sign(USER_ID);

    const response = await getPrivate(`sf-access=${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: USER_ID });
  });

  it("ignores a token sent in the Authorization header", async () => {
    const token = await accessTokens.sign(USER_ID);

    const response = await request(app.getHttpServer())
      .get("/probe/private")
      .set("Authorization", `Bearer ${token}`);

    expect(response.body).toEqual(UNAUTHENTICATED);
  });

  it("rejects a token signed with HS512", async () => {
    const token = await jwtService.signAsync(
      { sub: USER_ID },
      { algorithm: "HS512", expiresIn: 900 },
    );

    const response = await getPrivate(`sf-access=${token}`);

    expect(response.body).toEqual(UNAUTHENTICATED);
  });

  it("rejects a token signed with another secret", async () => {
    const token = await jwtService.signAsync(
      { sub: USER_ID },
      { algorithm: "HS256", expiresIn: 900, secret: OTHER_SIGNING_KEY },
    );

    const response = await getPrivate(`sf-access=${token}`);

    expect(response.body).toEqual(UNAUTHENTICATED);
  });

  it("rejects a validly signed token without a subject", async () => {
    const token = await jwtService.signAsync(
      { scope: "none" },
      { algorithm: "HS256", expiresIn: 900 },
    );

    const response = await getPrivate(`sf-access=${token}`);

    expect(response.body).toEqual(UNAUTHENTICATED);
  });

  it("rejects a token after it expires", async () => {
    const token = await accessTokens.sign(USER_ID);
    vi.setSystemTime(ISSUED_AT.getTime() + ACCESS_TTL_MS);

    const response = await getPrivate(`sf-access=${token}`);

    expect(response.body).toEqual(UNAUTHENTICATED);
  });

  it("accepts a token one second before it expires", async () => {
    const token = await accessTokens.sign(USER_ID);
    vi.setSystemTime(ISSUED_AT.getTime() + ACCESS_TTL_MS - 1000);

    const response = await getPrivate(`sf-access=${token}`);

    expect(response.body).toEqual({ userId: USER_ID });
  });
});
