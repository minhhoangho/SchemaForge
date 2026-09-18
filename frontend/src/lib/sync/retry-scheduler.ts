export type RetryScheduler = {
  /** Runs `run` once after `delayMs`; the returned function cancels it. */
  readonly schedule: (delayMs: number, run: () => void) => () => void;
};

export const RETRY_INITIAL_DELAY_MS = 2_000;
export const RETRY_MAX_DELAY_MS = 60_000;

const MS_PER_SECOND = 1_000;

export function createBrowserRetryScheduler(): RetryScheduler {
  return {
    schedule: (delayMs, run) => {
      const handle = setTimeout(run, delayMs);
      return () => {
        clearTimeout(handle);
      };
    },
  };
}

/**
 * Exponential backoff from 2 s, doubling per attempt (starting at 0) up to
 * 60 s. A Retry-After from the server is a floor, so it can exceed 60 s.
 */
export function nextRetryDelayMs(input: {
  readonly attempt: number;
  readonly retryAfterSeconds: number | null;
}): number {
  const backoffMs = Math.min(
    RETRY_INITIAL_DELAY_MS * 2 ** input.attempt,
    RETRY_MAX_DELAY_MS,
  );
  return input.retryAfterSeconds === null
    ? backoffMs
    : Math.max(input.retryAfterSeconds * MS_PER_SECOND, backoffMs);
}
