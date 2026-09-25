import { act, renderHook, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/components/auth-provider";
import type { AuthProviderDependencies } from "@/components/auth-provider";
import type { BroadcastChannelLike } from "@/lib/auth/auth-channel";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { StorageProvider } from "@/lib/storage/storage-context";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";

import { useCredentialsSubmit } from "./use-credentials-submit";
import type { CredentialsSubmitState } from "./use-credentials-submit";

const { replace } = vi.hoisted(() => ({
  replace: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

// No IndexedDB in jsdom: the auth store then runs without a session record,
// which these tests do not need.
vi.mock("@/lib/storage/create-browser-storage", () => ({
  createBrowserStorage: () => {
    throw new DOMException("IndexedDB is blocked.", "SecurityError");
  },
}));

const CREDENTIALS = { email: "user@example.com", password: "stapler-42" };
const RETURN_TO = "/schemas/abc";

type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function userResponse(): Response {
  return jsonResponse(
    {
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        email: CREDENTIALS.email,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    },
    200,
  );
}

class SilentBroadcastChannel extends EventTarget {
  postMessage(): void {
    // No other tab listens in these tests.
  }

  close(): void {
    // Nothing was opened.
  }
}

function createDependencies(fetchImpl: FetchStub): AuthProviderDependencies {
  return {
    fetchImpl,
    authLockManager: createFakeAuthLockManager().lockManager,
    openChannel: (): BroadcastChannelLike => new SilentBroadcastChannel(),
    cookieJar: { cookie: "" },
  };
}

type HookResult = {
  readonly state: CredentialsSubmitState;
  readonly submit: ReturnType<typeof useCredentialsSubmit>["submit"];
  readonly isReady: boolean;
};

async function renderSubmitHook(
  mode: "sign-in" | "sign-up",
  fetchImpl: FetchStub,
  storage?: StorageBundle,
): Promise<{ readonly current: () => HookResult }> {
  const dependencies = createDependencies(fetchImpl);
  const wrapper = ({
    children,
  }: {
    readonly children: ReactNode;
  }): JSX.Element => (
    <StorageProvider storage={storage}>
      <AuthProvider hasAuthHint={false} dependencies={dependencies}>
        {children}
      </AuthProvider>
    </StorageProvider>
  );
  const { result } = renderHook(
    () => ({
      ...useCredentialsSubmit({ mode, returnTo: RETURN_TO }),
      isReady: useAuth((state) => state.auth.status === "signed-out"),
    }),
    { wrapper },
  );
  // A guest's store settles on signed-out without any request.
  await waitFor(() => {
    expect(result.current.isReady).toBe(true);
  });
  return { current: () => result.current };
}

// Real storage on fake-indexeddb whose session write fails, the local fault
// that makes the auth store reject after the server accepted the sign-in.
function createStorageFailingSessionWrite(): StorageBundle {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  const repository = createSchemaRepository({
    database,
    clock: () => 1,
    generateId: () => "00000000-0000-4000-8000-000000000001",
  });
  return {
    database,
    lockManager: createSchemaLockManager(createFakeLockRegistry().request),
    repository: {
      ...repository,
      writeSession: () =>
        Promise.reject(new DOMException("Disk is full.", "QuotaExceededError")),
    },
  };
}

describe("useCredentialsSubmit", () => {
  afterEach(() => {
    replace.mockClear();
    vi.restoreAllMocks();
  });

  it("returns to idle and logs when the auth store rejects", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(userResponse()),
    );
    const storage = createStorageFailingSessionWrite();
    const hook = await renderSubmitHook("sign-in", fetchImpl, storage);

    await act(() => hook.current().submit(CREDENTIALS));
    await act(() => hook.current().submit(CREDENTIALS));

    storage.database.close();
    expect({
      state: hook.current().state,
      requestCount: fetchImpl.mock.calls.length,
      hasNavigated: replace.mock.calls.length > 0,
      // console.error takes any[], so the event name is read as unknown.
      loggedEvents: consoleError.mock.calls.map((call): unknown => call[1]),
    }).toEqual({
      state: { kind: "idle" },
      requestCount: 2,
      hasNavigated: false,
      loggedEvents: [
        "auth.credentials-submit-failed",
        "auth.credentials-submit-failed",
      ],
    });
  });

  it("replaces the route with returnTo after a successful sign-in", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(userResponse()),
    );
    const hook = await renderSubmitHook("sign-in", fetchImpl);

    await act(() => hook.current().submit(CREDENTIALS));

    expect(replace).toHaveBeenCalledExactlyOnceWith(RETURN_TO);
  });

  it("ignores a second submit while submitting", async () => {
    let respond: (response: Response) => void = () => undefined;
    const fetchImpl = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        }),
    );
    const hook = await renderSubmitHook("sign-in", fetchImpl);

    await act(async () => {
      const first = hook.current().submit(CREDENTIALS);
      const second = hook.current().submit(CREDENTIALS);
      await second;
      respond(userResponse());
      await first;
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("exposes the failure when signing up fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        jsonResponse(
          { statusCode: 409, code: "email-already-registered" },
          409,
        ),
      ),
    );
    const hook = await renderSubmitHook("sign-up", fetchImpl);

    await act(() => hook.current().submit(CREDENTIALS));

    expect(hook.current().state).toMatchObject({
      kind: "failed",
      failure: { kind: "http", body: { code: "email-already-registered" } },
    });
  });

  it("sends a sign-up to the register endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        jsonResponse({ statusCode: 500, code: "internal-error" }, 500),
      ),
    );
    const hook = await renderSubmitHook("sign-up", fetchImpl);

    await act(() => hook.current().submit(CREDENTIALS));

    const [input] = fetchImpl.mock.calls[0] ?? [];
    expect(input instanceof URL ? input.pathname : null).toBe("/auth/register");
  });

  it("allows another submit after a failure", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        jsonResponse({ statusCode: 401, code: "invalid-credentials" }, 401),
      ),
    );
    const hook = await renderSubmitHook("sign-in", fetchImpl);

    await act(() => hook.current().submit(CREDENTIALS));
    await act(() => hook.current().submit(CREDENTIALS));

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
