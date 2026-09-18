import { describe, expect, it } from "vitest";

import {
  RATE_LIMIT_POLICIES,
  type RateLimitRule,
} from "./rate-limit.policy.js";
import { MemoryRateLimiterStore } from "./rate-limit.store.js";

const [REGISTER_RULE] = RATE_LIMIT_POLICIES.register;
const KEY = "a".repeat(64);
const OTHER_KEY = "b".repeat(64);

async function consumeTimes(
  store: MemoryRateLimiterStore,
  rule: RateLimitRule,
  key: string,
  times: number,
): Promise<void> {
  await Array.from({ length: times }).reduce<Promise<void>>(
    async (previous) => {
      await previous;
      await store.consume(rule, key);
    },
    Promise.resolve(),
  );
}

describe("MemoryRateLimiterStore", () => {
  it("allows requests up to the rule points", async () => {
    const store = new MemoryRateLimiterStore();
    await consumeTimes(store, REGISTER_RULE, KEY, REGISTER_RULE.points - 1);

    await expect(store.consume(REGISTER_RULE, KEY)).resolves.toEqual({
      isAllowed: true,
    });
  });

  it("denies the request after the points are used with a positive retry-after", async () => {
    const store = new MemoryRateLimiterStore();
    await consumeTimes(store, REGISTER_RULE, KEY, REGISTER_RULE.points);

    // The window started a few milliseconds ago, so rounding up gives the full duration.
    await expect(store.consume(REGISTER_RULE, KEY)).resolves.toEqual({
      isAllowed: false,
      retryAfterSeconds: REGISTER_RULE.durationSeconds,
    });
  });

  it("keeps separate counters for separate keys", async () => {
    const store = new MemoryRateLimiterStore();
    await consumeTimes(store, REGISTER_RULE, KEY, REGISTER_RULE.points);

    await expect(store.consume(REGISTER_RULE, OTHER_KEY)).resolves.toEqual({
      isAllowed: true,
    });
  });

  it("keeps separate counters for separate store instances", async () => {
    const exhausted = new MemoryRateLimiterStore();
    await consumeTimes(exhausted, REGISTER_RULE, KEY, REGISTER_RULE.points);
    const fresh = new MemoryRateLimiterStore();

    await expect(fresh.consume(REGISTER_RULE, KEY)).resolves.toEqual({
      isAllowed: true,
    });
  });

  it("throws for a rule that is not registered", async () => {
    const store = new MemoryRateLimiterStore();
    const unknownRule: RateLimitRule = {
      name: "unknown-rule",
      keyKind: "ip",
      points: 1,
      durationSeconds: 60,
    };

    await expect(store.consume(unknownRule, KEY)).rejects.toThrow(
      "unknown-rule",
    );
  });
});
