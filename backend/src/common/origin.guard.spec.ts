import { ConfigService } from "@nestjs/config";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { Test } from "@nestjs/testing";
import { beforeAll, describe, expect, it } from "vitest";

import type { Env } from "../config/env.js";
import { ApiException } from "./api.exception.js";
import { OriginGuard } from "./origin.guard.js";
import { Public } from "./public.decorator.js";

const ALLOWED_ORIGIN = "http://localhost:3000";

class ProbeController {
  @Public()
  login(): void {
    // Handler body is irrelevant; only its metadata matters.
  }

  update(): void {
    // Handler body is irrelevant; only its metadata matters.
  }
}

function contextFor(
  method: string,
  origin?: string,
  // eslint-disable-next-line @typescript-eslint/unbound-method -- only its decorator metadata is read, it is never called
  handler: () => void = ProbeController.prototype.update,
): ExecutionContextHost {
  const headers = origin === undefined ? {} : { origin };
  return new ExecutionContextHost(
    [{ method, headers }, {}],
    ProbeController,
    handler,
  );
}

function rejectionOf(
  guard: OriginGuard,
  context: ExecutionContextHost,
): unknown {
  try {
    guard.canActivate(context);
  } catch (error: unknown) {
    return error instanceof ApiException ? error.body : error;
  }
  return "allowed";
}

const ORIGIN_NOT_ALLOWED = { statusCode: 403, code: "origin-not-allowed" };

describe("OriginGuard", () => {
  let guard: OriginGuard;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OriginGuard,
        {
          provide: ConfigService,
          useValue: new ConfigService<Pick<Env, "CORS_ORIGINS">, true>({
            CORS_ORIGINS: [ALLOWED_ORIGIN, "https://app.example.com"],
          }),
        },
      ],
    }).compile();
    guard = moduleRef.get(OriginGuard);
  });

  it.each(["GET", "HEAD", "OPTIONS"])(
    "allows safe methods without an Origin header (%s)",
    (method) => {
      expect(guard.canActivate(contextFor(method))).toBe(true);
    },
  );

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "rejects a state-changing request without an Origin header (%s)",
    (method) => {
      expect(rejectionOf(guard, contextFor(method))).toEqual(
        ORIGIN_NOT_ALLOWED,
      );
    },
  );

  it("rejects Origin null", () => {
    expect(rejectionOf(guard, contextFor("POST", "null"))).toEqual(
      ORIGIN_NOT_ALLOWED,
    );
  });

  it("rejects an origin that is not configured", () => {
    expect(
      rejectionOf(guard, contextFor("POST", "https://evil.example.com")),
    ).toEqual(ORIGIN_NOT_ALLOWED);
  });

  it("rejects an origin with a trailing slash", () => {
    expect(rejectionOf(guard, contextFor("PUT", `${ALLOWED_ORIGIN}/`))).toEqual(
      ORIGIN_NOT_ALLOWED,
    );
  });

  it("allows a configured origin", () => {
    expect(guard.canActivate(contextFor("DELETE", ALLOWED_ORIGIN))).toBe(true);
  });

  it("applies to handlers marked public", () => {
    const context = contextFor(
      "POST",
      undefined,
      // eslint-disable-next-line @typescript-eslint/unbound-method -- only its decorator metadata is read, it is never called
      ProbeController.prototype.login,
    );

    expect(rejectionOf(guard, context)).toEqual(ORIGIN_NOT_ALLOWED);
  });
});
