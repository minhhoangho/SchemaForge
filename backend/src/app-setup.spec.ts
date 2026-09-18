import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { MAX_REQUEST_BODY_BYTES } from "@schemaforge/api-contract";
import { IsString } from "class-validator";
import type { Request } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type AppSetupConfig, configureApp } from "./app-setup.js";
import { ApiExceptionFilter } from "./common/api-exception.filter.js";
import {
  type AuthenticatedUser,
  CurrentUser,
} from "./common/current-user.decorator.js";
import { OriginGuard } from "./common/origin.guard.js";
import { createValidationPipe } from "./common/validation.pipe.js";

const ALLOWED_ORIGIN = "http://localhost:3000";
const UNKNOWN_ORIGIN = "https://evil.example.com";
const FORWARDED_IP = "203.0.113.9";
// supertest connects over loopback; the socket address may be IPv4-mapped IPv6.
const LOOPBACK_IPV4 = "127.0.0.1";

const SETUP_CONFIG: AppSetupConfig = {
  CORS_ORIGINS: [ALLOWED_ORIGIN],
  TRUST_PROXY_HOPS: 0,
};

class ProbeBodyDto {
  @IsString()
  readonly name!: string;
}

@Controller("probe")
class ProbeController {
  @Get()
  get(): { readonly isOk: true } {
    return { isOk: true };
  }

  @Get("ip")
  ip(@Req() probeRequest: Request): { readonly ip: string | undefined } {
    return { ip: probeRequest.ip };
  }

  @Post()
  @HttpCode(200)
  post(@Body() body: ProbeBodyDto): { readonly name: string } {
    return { name: body.name };
  }

  // No authentication guard is registered here, so request.user is never set.
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Post("raw")
  @HttpCode(200)
  raw(@Req() probeRequest: Request): { readonly hasBody: boolean } {
    const body: unknown = probeRequest.body;
    return { hasBody: body !== undefined };
  }
}

describe("configureApp", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => SETUP_CONFIG],
        }),
      ],
      controllers: [ProbeController],
      providers: [
        { provide: APP_PIPE, useFactory: createValidationPipe },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: APP_GUARD, useClass: OriginGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    });
    configureApp(app, SETUP_CONFIG);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("sends the Helmet headers of spec section 8", async () => {
    const response = await request(app.getHttpServer()).get("/probe");

    expect(response.status).toBe(200);
    expect(response.headers["content-security-policy"]).toBe(
      "default-src 'none';frame-ancestors 'none';base-uri 'none';form-action 'none'",
    );
    expect(response.headers["cross-origin-resource-policy"]).toBe("same-site");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["strict-transport-security"]).toBeDefined();
  });

  it("does not send X-Powered-By", async () => {
    const response = await request(app.getHttpServer()).get("/probe");

    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("answers a preflight from a configured origin with credentials allowed", async () => {
    const response = await request(app.getHttpServer())
      .options("/probe")
      .set("Origin", ALLOWED_ORIGIN)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Content-Type");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      ALLOWED_ORIGIN,
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,PUT,DELETE",
    );
    expect(response.headers["access-control-allow-headers"]).toBe(
      "Content-Type",
    );
    expect(response.headers["access-control-max-age"]).toBe("600");
  });

  it("omits Access-Control-Allow-Origin for an unknown origin", async () => {
    const response = await request(app.getHttpServer())
      .get("/probe")
      .set("Origin", UNKNOWN_ORIGIN);

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects a state-changing request from an unknown origin with origin-not-allowed", async () => {
    const response = await request(app.getHttpServer())
      .post("/probe")
      .set("Origin", UNKNOWN_ORIGIN)
      .send({ name: "probe" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      statusCode: 403,
      code: "origin-not-allowed",
    });
  });

  it("parses a JSON body from a configured origin", async () => {
    const response = await request(app.getHttpServer())
      .post("/probe")
      .set("Origin", ALLOWED_ORIGIN)
      .send({ name: "probe" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ name: "probe" });
  });

  it("rejects a body larger than MAX_REQUEST_BODY_BYTES with payload-too-large", async () => {
    const oversizedName = "a".repeat(MAX_REQUEST_BODY_BYTES);

    const response = await request(app.getHttpServer())
      .post("/probe")
      .set("Origin", ALLOWED_ORIGIN)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ name: oversizedName }));

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      statusCode: 413,
      code: "payload-too-large",
    });
  });

  it("rejects malformed JSON with validation-failed", async () => {
    const response = await request(app.getHttpServer())
      .post("/probe")
      .set("Origin", ALLOWED_ORIGIN)
      .set("Content-Type", "application/json")
      .send('{"name": "probe"');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      statusCode: 400,
      code: "validation-failed",
      fields: [],
    });
  });

  it("does not parse an urlencoded body", async () => {
    const response = await request(app.getHttpServer())
      .post("/probe/raw")
      .set("Origin", ALLOWED_ORIGIN)
      .type("form")
      .send("name=probe");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasBody: false });
  });

  it("answers an unknown route with not-found", async () => {
    const response = await request(app.getHttpServer()).get("/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ statusCode: 404, code: "not-found" });
  });

  it("answers a route reading the current user without an authenticated user with unauthenticated", async () => {
    const response = await request(app.getHttpServer()).get("/probe/me");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ statusCode: 401, code: "unauthenticated" });
  });

  it("ignores X-Forwarded-For when TRUST_PROXY_HOPS is 0", async () => {
    const response = await request(app.getHttpServer())
      .get("/probe/ip")
      .set("X-Forwarded-For", FORWARDED_IP);

    const body = JSON.stringify(response.body);
    expect(body).not.toContain(FORWARDED_IP);
    expect(body).toContain(LOOPBACK_IPV4);
  });
});
