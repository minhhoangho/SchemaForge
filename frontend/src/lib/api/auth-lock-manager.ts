import type { LockRequest } from "@/lib/storage/schema-lock-manager";

export const AUTH_REFRESH_LOCK_NAME = "schemaforge:auth-refresh";

export type AuthLockManager = {
  readonly runExclusive: <T>(task: () => Promise<T>) => Promise<T>;
};

// Reuses the LockRequest port from schema-lock-manager.ts (import type only,
// see Task 20 of the auth-cloud plan) so both locks share one narrow contract
// instead of two copies of the Web Locks types.
export function createAuthLockManager(request: LockRequest): AuthLockManager {
  return {
    runExclusive: async <T>(task: () => Promise<T>): Promise<T> => {
      const settled: { outcome?: { readonly value: T } } = {};
      // A task error rejects the lock callback, and the lock request rejects
      // with it only after the lock is released.
      await request(AUTH_REFRESH_LOCK_NAME, { mode: "exclusive" }, async () => {
        settled.outcome = { value: await task() };
      });
      if (settled.outcome === undefined) {
        throw new Error("The lock request finished without running the task.");
      }
      return settled.outcome.value;
    },
  };
}

export function createBrowserAuthLockManager(): AuthLockManager {
  // lib.dom types navigator.locks as always present, but browsers expose it
  // only in secure contexts (HTTPS or localhost).
  if (!("locks" in navigator)) {
    throw new Error(
      "The Web Locks API is unavailable. SchemaForge needs a secure context (HTTPS or localhost).",
    );
  }
  const { locks } = navigator;
  return createAuthLockManager((name, options, callback) =>
    locks.request(name, options, callback),
  );
}
