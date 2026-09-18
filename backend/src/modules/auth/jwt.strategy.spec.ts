import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { beforeAll, describe, expect, it } from "vitest";

import { ApiException } from "../../common/api.exception.js";
import type { Env } from "../../config/env.js";
import { JwtStrategy } from "./jwt.strategy.js";

// Obviously fake signing key, 32 characters long like the env schema requires.
const SIGNING_KEY = "k".repeat(32);
const USER_ID = "0190f3a0-0000-7000-8000-000000000001";

function rejectionOf(strategy: JwtStrategy, payload: unknown): unknown {
  try {
    strategy.validate(payload);
  } catch (error: unknown) {
    return error instanceof ApiException ? error.body : error;
  }
  return "accepted";
}

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService<Pick<Env, "JWT_ACCESS_SECRET">, true>({
            JWT_ACCESS_SECRET: SIGNING_KEY,
          }),
        },
      ],
    }).compile();
    strategy = moduleRef.get(JwtStrategy);
  });

  it("returns the user id from a payload with a subject", () => {
    expect(strategy.validate({ sub: USER_ID, iat: 1, exp: 2 })).toEqual({
      userId: USER_ID,
    });
  });

  it.each([
    { label: "no sub", payload: { iat: 1 } },
    { label: "numeric sub", payload: { sub: 42 } },
    { label: "empty sub", payload: { sub: "" } },
    { label: "not an object", payload: "subject" },
    { label: "null", payload: null },
  ])("rejects a payload without a usable subject ($label)", ({ payload }) => {
    expect(rejectionOf(strategy, payload)).toEqual({
      statusCode: 401,
      code: "unauthenticated",
    });
  });
});
