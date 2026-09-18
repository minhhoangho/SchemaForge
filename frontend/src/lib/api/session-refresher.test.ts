import { describe, expect, it, vi } from "vitest";

import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";

import type {
  SimpleApiErrorCode,
  UserResponse,
} from "@schemaforge/api-contract";
import type { Result } from "@schemaforge/core";

import type { RawAuthCalls } from "./api-client";
import type { ApiFailure } from "./api-failure";
import { createSessionRefresher } from "./session-refresher";

type UserResult = Result<UserResponse, ApiFailure>;
type VoidResult = Result<void, ApiFailure>;

const OK_USER: UserResult = {
  isOk: true,
  value: {
    id: "user-1",
    email: "user@example.com",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
};

const OK_VOID: VoidResult = { isOk: true, value: undefined };

function httpFailure(status: number, code: SimpleApiErrorCode): ApiFailure {
  return {
    kind: "http",
    status,
    body: { statusCode: status, code },
    retryAfterSeconds: null,
  };
}

function failedUser(error: ApiFailure): UserResult {
  return { isOk: false, error };
}

function createRawAuthCalls(
  overrides: Partial<RawAuthCalls> = {},
): RawAuthCalls {
  return {
    me: vi.fn(() => Promise.resolve(OK_USER)),
    refresh: vi.fn(() => Promise.resolve(OK_VOID)),
    ...overrides,
  };
}

describe("createSessionRefresher", () => {
  it("skips the refresh when me succeeds inside the lock", async () => {
    const calls = createRawAuthCalls();
    const { lockManager } = createFakeAuthLockManager();
    const refresher = createSessionRefresher({ lockManager, calls });

    const result = await refresher.refresh();

    expect(result).toStrictEqual({ isOk: true, value: undefined });
    expect(calls.refresh).not.toHaveBeenCalled();
  });

  it("posts refresh when me returns 401 inside the lock", async () => {
    const calls = createRawAuthCalls({
      me: vi.fn(() =>
        Promise.resolve(failedUser(httpFailure(401, "unauthenticated"))),
      ),
    });
    const { lockManager } = createFakeAuthLockManager();
    const refresher = createSessionRefresher({ lockManager, calls });

    const result = await refresher.refresh();

    expect(result).toStrictEqual({ isOk: true, value: undefined });
    expect(calls.refresh).toHaveBeenCalledOnce();
  });

  it("returns the me failure without refreshing for a non-401 failure", async () => {
    const failure: ApiFailure = { kind: "network" };
    const calls = createRawAuthCalls({
      me: vi.fn(() => Promise.resolve(failedUser(failure))),
    });
    const { lockManager } = createFakeAuthLockManager();
    const refresher = createSessionRefresher({ lockManager, calls });

    const result = await refresher.refresh();

    expect(result).toStrictEqual({ isOk: false, error: failure });
    expect(calls.refresh).not.toHaveBeenCalled();
  });

  it("shares one refresh between concurrent calls in the same tab", async () => {
    const me = vi.fn(() => Promise.resolve(OK_USER));
    const calls = createRawAuthCalls({ me });
    const { lockManager } = createFakeAuthLockManager();
    const refresher = createSessionRefresher({ lockManager, calls });

    const [first, second] = await Promise.all([
      refresher.refresh(),
      refresher.refresh(),
    ]);

    expect(first).toStrictEqual(second);
    expect(me).toHaveBeenCalledOnce();
  });

  it("starts a new refresh after the previous one settles", async () => {
    const me = vi.fn(() => Promise.resolve(OK_USER));
    const calls = createRawAuthCalls({ me });
    const { lockManager } = createFakeAuthLockManager();
    const refresher = createSessionRefresher({ lockManager, calls });

    await refresher.refresh();
    await refresher.refresh();

    expect(me).toHaveBeenCalledTimes(2);
  });

  it("runs refreshes from two tabs one after another", async () => {
    const registry = createFakeLockRegistry();
    const order: string[] = [];
    const release = Promise.withResolvers<undefined>();
    const firstCalls = createRawAuthCalls({
      me: vi.fn(async () => {
        order.push("first-start");
        await release.promise;
        order.push("first-end");
        return OK_USER;
      }),
    });
    const secondCalls = createRawAuthCalls({
      me: vi.fn(() => {
        order.push("second");
        return Promise.resolve(OK_USER);
      }),
    });
    const firstTab = createFakeAuthLockManager(registry);
    const secondTab = createFakeAuthLockManager(registry);
    const firstRefresher = createSessionRefresher({
      lockManager: firstTab.lockManager,
      calls: firstCalls,
    });
    const secondRefresher = createSessionRefresher({
      lockManager: secondTab.lockManager,
      calls: secondCalls,
    });

    const first = firstRefresher.refresh();
    const second = secondRefresher.refresh();
    release.resolve(undefined);
    await Promise.all([first, second]);

    expect(order).toStrictEqual(["first-start", "first-end", "second"]);
  });
});
