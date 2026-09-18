import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { beforeAll, describe, expect, it } from "vitest";

import { Clock } from "../../common/clock.js";
import { AccessTokenService } from "./access-token.service.js";

// Obviously fake signing key, 32 characters long like the env schema requires.
const SIGNING_KEY = "k".repeat(32);
const USER_ID = "0190f3a0-0000-7000-8000-000000000001";
const NOW = new Date("2026-09-18T10:00:00.000Z");
const NOW_SECONDS = NOW.getTime() / 1000;

class FixedClock extends Clock {
  override now(): Date {
    return NOW;
  }
}

describe("AccessTokenService", () => {
  let service: AccessTokenService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SIGNING_KEY })],
      providers: [AccessTokenService, { provide: Clock, useClass: FixedClock }],
    }).compile();
    service = moduleRef.get(AccessTokenService);
    jwtService = moduleRef.get(JwtService);
  });

  it("signs an HS256 token whose subject is the user id", async () => {
    const token = await service.sign(USER_ID);

    const decoded: unknown = jwtService.decode(token, { complete: true });
    expect(decoded).toMatchObject({
      header: { alg: "HS256" },
      payload: { sub: USER_ID },
    });
  });

  it("sets iat from the clock and exp 15 minutes later", async () => {
    const token = await service.sign(USER_ID);

    const payload: unknown = jwtService.decode(token);
    expect(payload).toMatchObject({
      iat: NOW_SECONDS,
      exp: NOW_SECONDS + 15 * 60,
    });
  });
});
