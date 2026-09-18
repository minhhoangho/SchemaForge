import { Reflector } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { IS_PUBLIC_KEY } from "../../common/public.decorator.js";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("returns status ok", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    expect(moduleRef.get(HealthController).getHealth()).toEqual({
      status: "ok",
    });
  });

  it("marks the health route as public", () => {
    const isPublic: unknown = new Reflector().get(
      IS_PUBLIC_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method -- only its decorator metadata is read, it is never called
      HealthController.prototype.getHealth,
    );

    expect(isPublic).toBe(true);
  });
});
