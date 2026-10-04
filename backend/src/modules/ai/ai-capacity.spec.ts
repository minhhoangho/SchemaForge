import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_GLOBAL_BUDGET_WINDOW_SECONDS } from "./ai.constants.js";
import { AiCapacity } from "./ai-capacity.js";
import { AI_GLOBAL_REQUESTS_PER_HOUR } from "./ai-model.provider.js";

const USER_ID = "0190f3a0-0000-7000-8000-0000000000a1";
const OTHER_USER_ID = "0190f3a0-0000-7000-8000-0000000000a2";
const BUDGET_PER_HOUR = 2;

async function createCapacity(): Promise<AiCapacity> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      AiCapacity,
      { provide: AI_GLOBAL_REQUESTS_PER_HOUR, useValue: BUDGET_PER_HOUR },
    ],
  }).compile();
  return moduleRef.get(AiCapacity);
}

async function exhaustBudget(capacity: AiCapacity): Promise<void> {
  await capacity.tryConsumeGlobalBudget();
  await capacity.tryConsumeGlobalBudget();
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AiCapacity.tryAcquireStream", () => {
  it("allows one stream per user", async () => {
    const capacity = await createCapacity();
    capacity.tryAcquireStream(USER_ID);

    expect(capacity.tryAcquireStream(USER_ID)).toBeNull();
  });

  it("allows another user while one user streams", async () => {
    const capacity = await createCapacity();
    capacity.tryAcquireStream(USER_ID);

    expect(capacity.tryAcquireStream(OTHER_USER_ID)).toBeInstanceOf(Function);
  });

  it("allows the user again after release", async () => {
    const capacity = await createCapacity();
    capacity.tryAcquireStream(USER_ID)?.();

    expect(capacity.tryAcquireStream(USER_ID)).toBeInstanceOf(Function);
  });

  it("ignores a second call of the same release", async () => {
    const capacity = await createCapacity();
    const release = capacity.tryAcquireStream(USER_ID);
    release?.();
    release?.();

    expect(capacity.tryAcquireStream(USER_ID)).toBeInstanceOf(Function);
  });

  it("a stale release does not free a newer lock", async () => {
    const capacity = await createCapacity();
    const staleRelease = capacity.tryAcquireStream(USER_ID);
    staleRelease?.();
    capacity.tryAcquireStream(USER_ID);
    staleRelease?.();

    expect(capacity.tryAcquireStream(USER_ID)).toBeNull();
  });
});

describe("AiCapacity.tryConsumeGlobalBudget", () => {
  it("allows requests up to the configured budget", async () => {
    const capacity = await createCapacity();
    await capacity.tryConsumeGlobalBudget();

    await expect(capacity.tryConsumeGlobalBudget()).resolves.toStrictEqual({
      isAllowed: true,
    });
  });

  it("stops the global budget after the configured number of requests", async () => {
    const capacity = await createCapacity();
    await exhaustBudget(capacity);

    await expect(capacity.tryConsumeGlobalBudget()).resolves.toMatchObject({
      isAllowed: false,
    });
  });

  it("keeps a separate budget per instance", async () => {
    await exhaustBudget(await createCapacity());
    const fresh = await createCapacity();

    await expect(fresh.tryConsumeGlobalBudget()).resolves.toStrictEqual({
      isAllowed: true,
    });
  });

  it("returns the seconds until the budget window resets, rounded up", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(0) });
    const capacity = await createCapacity();
    await exhaustBudget(capacity);
    vi.setSystemTime(new Date(1_500));

    const result = await capacity.tryConsumeGlobalBudget();
    vi.useRealTimers();

    expect(result).toStrictEqual({
      isAllowed: false,
      retryAfterSeconds: AI_GLOBAL_BUDGET_WINDOW_SECONDS - 1,
    });
  });

  it("logs ai.budget.exhausted once per budget window", async () => {
    const warn = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    const capacity = await createCapacity();
    await exhaustBudget(capacity);
    await capacity.tryConsumeGlobalBudget();
    await capacity.tryConsumeGlobalBudget();
    await capacity.tryConsumeGlobalBudget();

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("logs ai.budget.exhausted without user data", async () => {
    const warn = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);
    const capacity = await createCapacity();
    capacity.tryAcquireStream(USER_ID);
    await exhaustBudget(capacity);
    await capacity.tryConsumeGlobalBudget();

    expect(warn.mock.calls).toEqual([["ai.budget.exhausted"]]);
  });
});
