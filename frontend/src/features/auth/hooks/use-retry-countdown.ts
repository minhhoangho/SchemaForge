"use client";

import { useEffect, useState } from "react";

import type { ApiFailure } from "@/lib/api/api-failure";
import { isApiErrorCode } from "@/lib/api/api-failure";

/** Seconds the rate limit asks the user to wait, or null when it does not. */
export function retryAfterSecondsOf(failure: ApiFailure | null): number | null {
  if (
    failure?.kind !== "http" ||
    !isApiErrorCode(failure, "too-many-requests")
  ) {
    return null;
  }
  return failure.retryAfterSeconds;
}

/**
 * Seconds left of the `Retry-After` wait of a `429` failure, counted down
 * against the clock (not by accumulating ticks), and 0 when there is no wait.
 *
 * `failure` must keep its identity across renders (it comes from state): a
 * different object means a new attempt and restarts the wait.
 */
export function useRetryCountdown(failure: ApiFailure | null): number {
  const [trackedFailure, setTrackedFailure] = useState(failure);
  const [deadline, setDeadline] = useState(toDeadline(failure));
  const [now, setNow] = useState(() => Date.now());

  // A new failure restarts the wait, even when it asks for the same seconds.
  if (failure !== trackedFailure) {
    setTrackedFailure(failure);
    setDeadline(toDeadline(failure));
    setNow(Date.now());
  }

  useEffect(() => {
    if (deadline === null) {
      return undefined;
    }
    const interval = setInterval(() => {
      if (Date.now() >= deadline) {
        // Dropping the deadline both ends the wait and stops this interval.
        setDeadline(null);
      }
      setNow(Date.now());
    }, 1_000);
    return () => {
      clearInterval(interval);
    };
  }, [deadline]);

  if (deadline === null) {
    return 0;
  }
  return Math.max(0, Math.ceil((deadline - now) / 1_000));
}

function toDeadline(failure: ApiFailure | null): number | null {
  const seconds = retryAfterSecondsOf(failure);
  return seconds === null ? null : Date.now() + seconds * 1_000;
}
