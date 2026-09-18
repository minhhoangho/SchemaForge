import {
  AUTH_REFRESH_LOCK_NAME,
  createAuthLockManager,
} from "@/lib/api/auth-lock-manager";
import type { AuthLockManager } from "@/lib/api/auth-lock-manager";

import { createFakeLockRegistry } from "./fake-lock-registry";
import type { FakeLockRegistry } from "./fake-lock-registry";

export type FakeAuthLockManager = {
  readonly lockManager: AuthLockManager;
  readonly isHeld: () => boolean;
};

// Two fake tabs share one FakeAuthLockManager by passing the same registry.
export function createFakeAuthLockManager(
  registry: FakeLockRegistry = createFakeLockRegistry(),
): FakeAuthLockManager {
  return {
    lockManager: createAuthLockManager(registry.request),
    isHeld: () => registry.isHeld(AUTH_REFRESH_LOCK_NAME),
  };
}
