import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createBrowserRetryScheduler,
  nextRetryDelayMs,
  RETRY_INITIAL_DELAY_MS,
  RETRY_MAX_DELAY_MS,
} from "./retry-scheduler";

describe("nextRetryDelayMs", () => {
  it.each([
    { attempt: 0, expected: 2_000 },
    { attempt: 1, expected: 4_000 },
    { attempt: 2, expected: 8_000 },
    { attempt: 3, expected: 16_000 },
    { attempt: 4, expected: 32_000 },
    { attempt: 5, expected: 60_000 },
    { attempt: 12, expected: 60_000 },
  ])("waits $expected ms on attempt $attempt", ({ attempt, expected }) => {
    expect(nextRetryDelayMs({ attempt, retryAfterSeconds: null })).toBe(
      expected,
    );
  });

  it("starts at the initial delay and never exceeds the maximum", () => {
    expect(nextRetryDelayMs({ attempt: 0, retryAfterSeconds: null })).toBe(
      RETRY_INITIAL_DELAY_MS,
    );
    expect(nextRetryDelayMs({ attempt: 1_000, retryAfterSeconds: null })).toBe(
      RETRY_MAX_DELAY_MS,
    );
  });

  it("waits at least Retry-After seconds", () => {
    expect(nextRetryDelayMs({ attempt: 0, retryAfterSeconds: 30 })).toBe(
      30_000,
    );
  });

  it("keeps the backoff delay when Retry-After is shorter", () => {
    expect(nextRetryDelayMs({ attempt: 3, retryAfterSeconds: 1 })).toBe(16_000);
  });

  it("honors a Retry-After longer than the maximum backoff", () => {
    expect(nextRetryDelayMs({ attempt: 0, retryAfterSeconds: 120 })).toBe(
      120_000,
    );
  });
});

describe("createBrowserRetryScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the callback after the delay", () => {
    const run = vi.fn();
    createBrowserRetryScheduler().schedule(2_000, run);

    vi.advanceTimersByTime(1_999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledOnce();
  });

  it("does not run the callback after it is cancelled", () => {
    const run = vi.fn();
    const cancel = createBrowserRetryScheduler().schedule(2_000, run);

    cancel();
    vi.advanceTimersByTime(2_000);

    expect(run).not.toHaveBeenCalled();
  });
});
