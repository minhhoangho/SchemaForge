import { afterEach, describe, expect, it, vi } from "vitest";

import { createFakeLockRegistry } from "@/testing/fake-lock-registry";

import {
  AUTH_REFRESH_LOCK_NAME,
  createAuthLockManager,
  createBrowserAuthLockManager,
} from "./auth-lock-manager";
import type { LockRequest } from "@/lib/storage/schema-lock-manager";

describe("createAuthLockManager", () => {
  it("uses the schemaforge:auth-refresh lock name", async () => {
    const request = vi.fn<LockRequest>(async (_name, _options, callback) => {
      await callback({ name: _name, mode: "exclusive" });
    });
    const manager = createAuthLockManager(request);

    await manager.runExclusive(() => Promise.resolve(undefined));

    expect(request).toHaveBeenCalledWith(
      AUTH_REFRESH_LOCK_NAME,
      { mode: "exclusive" },
      expect.any(Function),
    );
  });

  it("waits for the current holder before running the task", async () => {
    const registry = createFakeLockRegistry();
    const firstTab = createAuthLockManager(registry.request);
    const secondTab = createAuthLockManager(registry.request);
    const order: string[] = [];
    const firstRelease = Promise.withResolvers<undefined>();

    const first = firstTab.runExclusive(async () => {
      order.push("first");
      await firstRelease.promise;
    });
    const second = secondTab.runExclusive((): Promise<void> => {
      order.push("second");
      return Promise.resolve();
    });
    const waitingBeforeRelease = registry.countWaiting(AUTH_REFRESH_LOCK_NAME);
    firstRelease.resolve(undefined);
    await Promise.all([first, second]);

    expect(waitingBeforeRelease).toBe(1);
    expect(order).toStrictEqual(["first", "second"]);
  });

  it("releases the lock when the task rejects", async () => {
    const registry = createFakeLockRegistry();
    const manager = createAuthLockManager(registry.request);
    const failure = new Error("Task failed.");

    const outcome = await manager
      .runExclusive(() => Promise.reject(failure))
      .then(
        () => null,
        (error: unknown) => ({
          error,
          isHeldWhenRejected: registry.isHeld(AUTH_REFRESH_LOCK_NAME),
        }),
      );

    expect(outcome).toStrictEqual({
      error: failure,
      isHeldWhenRejected: false,
    });
  });

  it("resolves runExclusive with the value the task returns", async () => {
    const registry = createFakeLockRegistry();
    const manager = createAuthLockManager(registry.request);

    const value = await manager.runExclusive(() => Promise.resolve(42));

    expect(value).toBe(42);
  });
});

describe("createBrowserAuthLockManager", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "locks");
  });

  it("throws when the Web Locks API is unavailable", () => {
    expect(() => createBrowserAuthLockManager()).toThrow(/secure context/);
  });

  it("delegates to navigator.locks.request in the browser manager", async () => {
    const registry = createFakeLockRegistry();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: registry.request },
    });
    const manager = createBrowserAuthLockManager();

    await expect(
      manager.runExclusive(() => Promise.resolve("value")),
    ).resolves.toBe("value");
  });
});
