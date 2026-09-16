import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import {
  createSchemaLockManager,
  getSchemaLockName,
} from "@/lib/storage/schema-lock-manager";
import type {
  SchemaLock,
  SchemaLockManager,
} from "@/lib/storage/schema-lock-manager";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";

import { useSchemaLock } from "./use-schema-lock";

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const LOCK_NAME = getSchemaLockName(SCHEMA_ID);

function renderSchemaLock(lockManager: SchemaLockManager) {
  return renderHook(() => useSchemaLock({ schemaId: SCHEMA_ID, lockManager }));
}

async function holdInOtherTab(
  lockManager: SchemaLockManager,
): Promise<SchemaLock> {
  const lock = await lockManager.tryAcquire(SCHEMA_ID);
  if (lock === null) {
    throw new Error("The other tab could not take the lock.");
  }
  return lock;
}

// A macrotask runs only after every queued microtask, so the aborted request
// has rejected and its handler has run by the time this resolves.
async function flushPendingPromises(): Promise<void> {
  await act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      }),
  );
}

describe("useSchemaLock", () => {
  beforeEach(() => {
    vi.spyOn(logger, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports acquiring before the lock manager answers", () => {
    const registry = createFakeLockRegistry();
    const { result } = renderSchemaLock(
      createSchemaLockManager(registry.request),
    );

    expect(result.current).toStrictEqual({ kind: "acquiring" });
  });

  it("reports held when the lock is free", async () => {
    const registry = createFakeLockRegistry();
    const { result } = renderSchemaLock(
      createSchemaLockManager(registry.request),
    );

    await waitFor(() => {
      expect(result.current).toStrictEqual({ kind: "held", grantId: 1 });
    });
    expect(registry.isHeld(LOCK_NAME)).toBe(true);
  });

  it("reports blocked while another tab holds the lock", async () => {
    const registry = createFakeLockRegistry();
    const lockManager = createSchemaLockManager(registry.request);
    await holdInOtherTab(lockManager);

    const { result } = renderSchemaLock(lockManager);

    await waitFor(() => {
      expect(result.current).toStrictEqual({ kind: "blocked" });
    });
    expect(registry.countWaiting(LOCK_NAME)).toBe(1);
  });

  it("reports held with a new grant id after the other tab releases", async () => {
    const registry = createFakeLockRegistry();
    const lockManager = createSchemaLockManager(registry.request);
    const otherTabLock = await holdInOtherTab(lockManager);
    const { result } = renderSchemaLock(lockManager);
    await waitFor(() => {
      expect(result.current).toStrictEqual({ kind: "blocked" });
    });

    act(() => {
      otherTabLock.release();
    });

    await waitFor(() => {
      expect(result.current).toStrictEqual({ kind: "held", grantId: 2 });
    });
  });

  it("releases the lock on unmount", async () => {
    const registry = createFakeLockRegistry();
    const { result, unmount } = renderSchemaLock(
      createSchemaLockManager(registry.request),
    );
    await waitFor(() => {
      expect(result.current.kind).toBe("held");
    });

    unmount();

    await waitFor(() => {
      expect(registry.isHeld(LOCK_NAME)).toBe(false);
    });
  });

  it("removes the waiting request on unmount", async () => {
    const registry = createFakeLockRegistry();
    const lockManager = createSchemaLockManager(registry.request);
    await holdInOtherTab(lockManager);
    const { result, unmount } = renderSchemaLock(lockManager);
    await waitFor(() => {
      expect(result.current.kind).toBe("blocked");
    });

    unmount();

    expect(registry.countWaiting(LOCK_NAME)).toBe(0);
  });

  it("does not log the aborted request on unmount", async () => {
    const logWarning = vi.spyOn(logger, "warn");
    const registry = createFakeLockRegistry();
    const lockManager = createSchemaLockManager(registry.request);
    await holdInOtherTab(lockManager);
    const { result, unmount } = renderSchemaLock(lockManager);
    await waitFor(() => {
      expect(result.current.kind).toBe("blocked");
    });

    unmount();
    await flushPendingPromises();

    expect(logWarning).not.toHaveBeenCalled();
  });

  it("logs the error name when the lock request fails", async () => {
    const logWarning = vi.spyOn(logger, "warn");
    const lockManager: SchemaLockManager = {
      tryAcquire: vi
        .fn<SchemaLockManager["tryAcquire"]>()
        .mockRejectedValue(new DOMException("denied", "SecurityError")),
      acquire: vi.fn<SchemaLockManager["acquire"]>(),
    };

    renderSchemaLock(lockManager);

    await waitFor(() => {
      expect(logWarning).toHaveBeenCalledWith("editor.lock-failed", {
        errorName: "SecurityError",
      });
    });
  });

  it("releases a lock granted after unmount", async () => {
    const registry = createFakeLockRegistry();
    const lockManager = createSchemaLockManager(registry.request);
    const { unmount } = renderSchemaLock(lockManager);

    unmount();

    await waitFor(() => {
      expect(registry.isHeld(LOCK_NAME)).toBe(false);
    });
    expect(await lockManager.tryAcquire(SCHEMA_ID)).not.toBeNull();
  });
});
