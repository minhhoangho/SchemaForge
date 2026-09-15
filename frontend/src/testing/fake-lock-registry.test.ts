import { describe, expect, it, vi } from "vitest";

import { createFakeLockRegistry } from "./fake-lock-registry";

const LOCK_NAME = "schemaforge:schema:first";
const OTHER_LOCK_NAME = "schemaforge:schema:second";

describe("createFakeLockRegistry", () => {
  it("grants requests for the same name in order", async () => {
    const registry = createFakeLockRegistry();
    const grantOrder: string[] = [];
    const firstRelease = Promise.withResolvers<undefined>();

    const first = registry.request(LOCK_NAME, { mode: "exclusive" }, () => {
      grantOrder.push("first");
      return firstRelease.promise;
    });
    const second = registry.request(LOCK_NAME, { mode: "exclusive" }, () => {
      grantOrder.push("second");
      return undefined;
    });
    const third = registry.request(LOCK_NAME, { mode: "exclusive" }, () => {
      grantOrder.push("third");
      return undefined;
    });
    const waitingBeforeRelease = registry.countWaiting(LOCK_NAME);
    firstRelease.resolve(undefined);
    await Promise.all([first, second, third]);

    expect(waitingBeforeRelease).toBe(2);
    expect(grantOrder).toStrictEqual(["first", "second", "third"]);
    expect(registry.isHeld(LOCK_NAME)).toBe(false);
  });

  it("does not block requests for other names", async () => {
    const registry = createFakeLockRegistry();
    const release = Promise.withResolvers<undefined>();
    const holder = registry.request(
      LOCK_NAME,
      { mode: "exclusive" },
      () => release.promise,
    );
    const callback = vi.fn(() => undefined);

    await registry.request(OTHER_LOCK_NAME, { mode: "exclusive" }, callback);
    const isFirstLockHeld = registry.isHeld(LOCK_NAME);
    release.resolve(undefined);
    await holder;

    expect(callback).toHaveBeenCalledWith({
      name: OTHER_LOCK_NAME,
      mode: "exclusive",
    });
    expect(isFirstLockHeld).toBe(true);
  });

  it("calls back with null for ifAvailable while the lock is held", async () => {
    const registry = createFakeLockRegistry();
    const release = Promise.withResolvers<undefined>();
    const holder = registry.request(
      LOCK_NAME,
      { mode: "exclusive" },
      () => release.promise,
    );
    const callback = vi.fn(() => undefined);

    await registry.request(
      LOCK_NAME,
      { mode: "exclusive", ifAvailable: true },
      callback,
    );
    release.resolve(undefined);
    await holder;

    expect(callback).toHaveBeenCalledWith(null);
  });

  it("rejects immediately for an already aborted signal", async () => {
    const registry = createFakeLockRegistry();
    const callback = vi.fn(() => undefined);

    const request = registry.request(
      LOCK_NAME,
      { mode: "exclusive", signal: AbortSignal.abort() },
      callback,
    );

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(callback).not.toHaveBeenCalled();
    expect(registry.countWaiting(LOCK_NAME)).toBe(0);
  });
});
