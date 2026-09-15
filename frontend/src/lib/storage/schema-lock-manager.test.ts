import { afterEach, describe, expect, it } from "vitest";

import { createFakeLockRegistry } from "@/testing/fake-lock-registry";

import {
  createBrowserSchemaLockManager,
  createSchemaLockManager,
  getSchemaLockName,
} from "./schema-lock-manager";
import type { LockRequest } from "./schema-lock-manager";

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const LOCK_NAME = `schemaforge:schema:${SCHEMA_ID}`;

// A macrotask runs only after every queued microtask, so lock hand-offs that
// were triggered by a release have settled when this resolves.
function flushPendingCallbacks(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("getSchemaLockName", () => {
  it("names the lock after the schema id", () => {
    expect(getSchemaLockName(SCHEMA_ID)).toBe(LOCK_NAME);
  });
});

describe("createSchemaLockManager", () => {
  it("acquires a free lock without waiting", async () => {
    const registry = createFakeLockRegistry();
    const manager = createSchemaLockManager(registry.request);

    const lock = await manager.tryAcquire(SCHEMA_ID);

    expect(lock).not.toBeNull();
    expect(registry.isHeld(LOCK_NAME)).toBe(true);
  });

  it("returns null from tryAcquire while another holder has the lock", async () => {
    const registry = createFakeLockRegistry();
    const firstTab = createSchemaLockManager(registry.request);
    const secondTab = createSchemaLockManager(registry.request);
    await firstTab.tryAcquire(SCHEMA_ID);

    const lock = await secondTab.tryAcquire(SCHEMA_ID);

    expect(lock).toBeNull();
  });

  it("waits in acquire until the current holder releases", async () => {
    const registry = createFakeLockRegistry();
    const firstTab = createSchemaLockManager(registry.request);
    const secondTab = createSchemaLockManager(registry.request);
    const firstLock = await firstTab.tryAcquire(SCHEMA_ID);

    const pendingLock = secondTab.acquire(
      SCHEMA_ID,
      new AbortController().signal,
    );
    const waitingBeforeRelease = registry.countWaiting(LOCK_NAME);
    firstLock?.release();

    await expect(pendingLock).resolves.toBeDefined();
    expect(waitingBeforeRelease).toBe(1);
    expect(registry.isHeld(LOCK_NAME)).toBe(true);
  });

  it("rejects acquire with AbortError when the signal aborts while waiting", async () => {
    const registry = createFakeLockRegistry();
    const firstTab = createSchemaLockManager(registry.request);
    const secondTab = createSchemaLockManager(registry.request);
    await firstTab.tryAcquire(SCHEMA_ID);
    const controller = new AbortController();

    const pendingLock = secondTab.acquire(SCHEMA_ID, controller.signal);
    controller.abort();

    await expect(pendingLock).rejects.toMatchObject({ name: "AbortError" });
  });

  it("removes an aborted request from the queue", async () => {
    const registry = createFakeLockRegistry();
    const firstTab = createSchemaLockManager(registry.request);
    const secondTab = createSchemaLockManager(registry.request);
    await firstTab.tryAcquire(SCHEMA_ID);
    const controller = new AbortController();

    const pendingLock = secondTab.acquire(SCHEMA_ID, controller.signal);
    controller.abort();

    await expect(pendingLock).rejects.toThrow();
    expect(registry.countWaiting(LOCK_NAME)).toBe(0);
  });

  it("ignores a second release call", async () => {
    const registry = createFakeLockRegistry();
    const firstTab = createSchemaLockManager(registry.request);
    const secondTab = createSchemaLockManager(registry.request);
    const firstLock = await firstTab.tryAcquire(SCHEMA_ID);
    const pendingLock = secondTab.acquire(
      SCHEMA_ID,
      new AbortController().signal,
    );
    firstLock?.release();
    await pendingLock;

    firstLock?.release();
    await flushPendingCallbacks();

    expect(registry.isHeld(LOCK_NAME)).toBe(true);
  });

  it("releases the lock so another tab can take it", async () => {
    const registry = createFakeLockRegistry();
    const firstTab = createSchemaLockManager(registry.request);
    const firstLock = await firstTab.tryAcquire(SCHEMA_ID);

    firstLock?.release();
    await flushPendingCallbacks();

    expect(registry.isHeld(LOCK_NAME)).toBe(false);
  });

  it("forwards other errors from the lock request", async () => {
    const failure = new Error("Lock request failed.");
    const request: LockRequest = () => Promise.reject(failure);
    const manager = createSchemaLockManager(request);

    await expect(
      manager.acquire(SCHEMA_ID, new AbortController().signal),
    ).rejects.toBe(failure);
  });

  it("rejects acquire when the lock request grants no lock", async () => {
    const request: LockRequest = async (_name, _options, callback) => {
      await callback(null);
    };
    const manager = createSchemaLockManager(request);

    await expect(
      manager.acquire(SCHEMA_ID, new AbortController().signal),
    ).rejects.toThrow(Error);
  });
});

describe("createBrowserSchemaLockManager", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "locks");
  });

  it("throws when the Web Locks API is unavailable", () => {
    expect(() => createBrowserSchemaLockManager()).toThrow(/secure context/);
  });

  it("delegates to navigator.locks.request in the browser manager", async () => {
    const registry = createFakeLockRegistry();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: registry.request },
    });
    const manager = createBrowserSchemaLockManager();

    const lock = await manager.tryAcquire(SCHEMA_ID);

    expect(lock).not.toBeNull();
    expect(registry.isHeld(LOCK_NAME)).toBe(true);
  });
});
