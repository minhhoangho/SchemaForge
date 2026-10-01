import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiFailure } from "@/lib/api/api-failure";

import { useRetryCountdown } from "./use-retry-countdown";

function rateLimited(retryAfterSeconds: number | null): ApiFailure {
  return {
    kind: "http",
    status: 429,
    body: { statusCode: 429, code: "too-many-requests" },
    retryAfterSeconds,
  };
}

const INVALID_CREDENTIALS: ApiFailure = {
  kind: "http",
  status: 401,
  body: { statusCode: 401, code: "invalid-credentials" },
  retryAfterSeconds: null,
};

describe("useRetryCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts down the Retry-After seconds of a rate limited failure", () => {
    const failure = rateLimited(90);
    const { result } = renderHook(() => useRetryCountdown(failure));

    expect(result.current).toBe(90);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(result.current).toBe(89);

    act(() => {
      vi.advanceTimersByTime(29_000);
    });
    expect(result.current).toBe(60);
  });

  it("reaches zero when the wait is over", () => {
    const failure = rateLimited(3);
    const { result } = renderHook(() => useRetryCountdown(failure));

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(result.current).toBe(0);
  });

  it("stops ticking once the wait is over", () => {
    const failure = rateLimited(2);
    const { result } = renderHook(() => useRetryCountdown(failure));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect([result.current, vi.getTimerCount()]).toEqual([0, 0]);
  });

  it("clears its timer when the component unmounts", () => {
    const failure = rateLimited(60);
    const { unmount } = renderHook(() => useRetryCountdown(failure));

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("restarts on a new rate limited failure", () => {
    const { result, rerender } = renderHook(
      (failure: ApiFailure | null) => useRetryCountdown(failure),
      { initialProps: rateLimited(30) },
    );

    act(() => {
      vi.advanceTimersByTime(25_000);
    });
    expect(result.current).toBe(5);

    rerender(rateLimited(30));
    expect(result.current).toBe(30);
  });

  it.each([
    ["no failure", null],
    ["a failure without Retry-After", rateLimited(null)],
    ["a failure that is not rate limiting", INVALID_CREDENTIALS],
  ])("reports no wait for %s", (_label, failure) => {
    const { result } = renderHook(() => useRetryCountdown(failure));

    expect([result.current, vi.getTimerCount()]).toEqual([0, 0]);
  });
});
