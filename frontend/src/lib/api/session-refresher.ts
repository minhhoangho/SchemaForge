import type { Result } from "@schemaforge/core";

import type { RawAuthCalls } from "./api-client";
import { isApiErrorCode } from "./api-failure";
import type { ApiFailure } from "./api-failure";
import type { AuthLockManager } from "./auth-lock-manager";

export type SessionRefresher = {
  readonly refresh: () => Promise<Result<void, ApiFailure>>;
};

async function performRefresh(
  lockManager: AuthLockManager,
  calls: RawAuthCalls,
): Promise<Result<void, ApiFailure>> {
  return lockManager.runExclusive(async () => {
    const meResult = await calls.me();
    if (meResult.isOk) {
      return { isOk: true, value: undefined };
    }
    if (isApiErrorCode(meResult.error, "unauthenticated")) {
      return calls.refresh();
    }
    return meResult;
  });
}

export function createSessionRefresher(input: {
  readonly lockManager: AuthLockManager;
  readonly calls: RawAuthCalls;
}): SessionRefresher {
  let pending: Promise<Result<void, ApiFailure>> | null = null;

  function refresh(): Promise<Result<void, ApiFailure>> {
    if (pending !== null) {
      return pending;
    }
    const started = performRefresh(input.lockManager, input.calls).finally(
      () => {
        pending = null;
      },
    );
    pending = started;
    return started;
  }

  return { refresh };
}
