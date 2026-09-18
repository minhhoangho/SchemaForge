import { describe, expect, it } from "vitest";

import { createFakeAuthLockManager } from "./fake-auth-lock-manager";

describe("createFakeAuthLockManager", () => {
  it("reports the lock as held while a task runs", async () => {
    const { lockManager, isHeld } = createFakeAuthLockManager();
    const release = Promise.withResolvers<undefined>();
    let isHeldDuringTask = false;

    const task = lockManager.runExclusive(async () => {
      isHeldDuringTask = isHeld();
      await release.promise;
    });
    release.resolve(undefined);
    await task;

    expect(isHeldDuringTask).toBe(true);
    expect(isHeld()).toBe(false);
  });
});
