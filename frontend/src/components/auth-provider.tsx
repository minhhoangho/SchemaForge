"use client";

import type { Result } from "@schemaforge/core";
import type { JSX, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import {
  browserFetch,
  createApiClient,
  createRawAuthCalls,
} from "@/lib/api/api-client";
import type { ApiClient } from "@/lib/api/api-client";
import type { ApiFailure } from "@/lib/api/api-failure";
import { createBrowserAuthLockManager } from "@/lib/api/auth-lock-manager";
import type { AuthLockManager } from "@/lib/api/auth-lock-manager";
import { createSessionRefresher } from "@/lib/api/session-refresher";
import type { SessionRefresher } from "@/lib/api/session-refresher";
import { createAuthChannel } from "@/lib/auth/auth-channel";
import type {
  AuthChannel,
  BroadcastChannelLike,
} from "@/lib/auth/auth-channel";
import { createAuthHintCookie } from "@/lib/auth/auth-hint-cookie";
import type { AuthHintCookie } from "@/lib/auth/auth-hint-cookie";
import { createAuthStore } from "@/lib/auth/auth-store";
import type {
  AuthState,
  AuthStoreState,
  SessionStore,
  SessionUser,
} from "@/lib/auth/auth-store";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { useStorage } from "@/lib/storage/storage-context";
import { forgetPreviousAccount } from "@/lib/sync/forget-previous-account";
import { signOut } from "@/lib/sync/sign-out";
import type { SignOutFailure } from "@/lib/sync/sign-out";

export type AuthProviderDependencies = {
  readonly fetchImpl: typeof fetch;
  readonly authLockManager: AuthLockManager;
  readonly openChannel: (name: string) => BroadcastChannelLike;
  readonly cookieJar: Pick<Document, "cookie">;
};

export type AuthProviderProps = {
  readonly hasAuthHint: boolean;
  // Tests pass a fake bundle; the app builds the browser one on mount.
  readonly dependencies?: AuthProviderDependencies;
  readonly children: ReactNode;
};

const SIGN_OUT_OK: Result<void, SignOutFailure> = {
  isOk: true,
  value: undefined,
};

// Used on the server and where the browser cannot offer Web Locks, so a cloud
// call fails loudly instead of silently doing nothing.
function rejectUnavailable<T>(): Promise<Result<T, ApiFailure>> {
  return Promise.reject(
    new Error("The SchemaForge API is unavailable in this context."),
  );
}

const UNAVAILABLE_API_CLIENT: ApiClient = {
  auth: {
    register: rejectUnavailable,
    login: rejectUnavailable,
    logout: rejectUnavailable,
    me: rejectUnavailable,
  },
  schemas: {
    list: rejectUnavailable,
    get: rejectUnavailable,
    create: rejectUnavailable,
    update: rejectUnavailable,
    remove: rejectUnavailable,
  },
};

function rejectAuthActionUnavailable(): Promise<Result<void, ApiFailure>> {
  return rejectUnavailable();
}

// Storage is still pending on the first render, so no auth store exists yet
// and the state is simply unknown; no action can run before initialize.
const PLACEHOLDER_AUTH_STORE = createStore<AuthStoreState>()(() => ({
  auth: { status: "unknown" },
  activeSignInCount: 0,
  initialize: () => Promise.resolve(),
  signIn: rejectAuthActionUnavailable,
  signUp: rejectAuthActionUnavailable,
  markSessionExpired: () => undefined,
  markSignedOut: () => undefined,
}));

const UNAVAILABLE_SESSION_STORE: SessionStore = {
  read: () => Promise.resolve(null),
  write: () => Promise.resolve(),
};

type ExpiryTarget = { notify: () => void };

type AuthRuntime = {
  readonly dependencies: AuthProviderDependencies;
  readonly api: ApiClient;
  readonly sessionRefresher: SessionRefresher;
  readonly expiry: ExpiryTarget;
};

type AuthBundle = {
  readonly store: StoreApi<AuthStoreState>;
  readonly hintCookie: AuthHintCookie;
  readonly channel: AuthChannel;
  readonly storage: StorageBundle | null;
};

type AuthContextValue = {
  readonly api: ApiClient;
  readonly bundle: AuthBundle | null;
  readonly hasAuthHint: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function createBrowserDependencies(): AuthProviderDependencies | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return {
      fetchImpl: browserFetch,
      authLockManager: createBrowserAuthLockManager(),
      openChannel: (name) => new BroadcastChannel(name),
      cookieJar: document,
    };
  } catch (cause) {
    logger.warn("auth.browser-unsupported", {
      errorName: cause instanceof Error ? cause.name : "unknown",
    });
    return null;
  }
}

function createRuntime(dependencies: AuthProviderDependencies): AuthRuntime {
  const expiry: ExpiryTarget = { notify: () => undefined };
  const sessionRefresher = createSessionRefresher({
    lockManager: dependencies.authLockManager,
    calls: createRawAuthCalls({
      baseUrl: env.apiOrigin,
      fetchImpl: dependencies.fetchImpl,
    }),
  });
  const api = createApiClient({
    baseUrl: env.apiOrigin,
    fetchImpl: dependencies.fetchImpl,
    sessionRefresher,
    onSessionExpired: () => {
      expiry.notify();
    },
  });
  return { dependencies, api, sessionRefresher, expiry };
}

function createSessionStore(storage: StorageBundle): SessionStore {
  return {
    read: () => storage.repository.readSession(),
    write: ({ userId, email }) =>
      storage.repository.writeSession({ userId, email }),
  };
}

function createBundle(
  runtime: AuthRuntime,
  storage: StorageBundle | null,
): AuthBundle {
  const hintCookie = createAuthHintCookie({
    cookieJar: runtime.dependencies.cookieJar,
    isSecure: env.isProduction,
  });
  const channel = createAuthChannel(runtime.dependencies.openChannel);
  const store = createAuthStore({
    api: runtime.api,
    sessionRefresher: runtime.sessionRefresher,
    hintCookie,
    channel,
    sessionStore:
      storage === null
        ? UNAVAILABLE_SESSION_STORE
        : createSessionStore(storage),
    onAccountChanged:
      storage === null
        ? () => Promise.resolve()
        : async (previousUserId) => {
            await forgetPreviousAccount({
              repository: storage.repository,
              lockManager: storage.lockManager,
              previousUserId,
            });
          },
  });
  return { store, hintCookie, channel, storage };
}

export function AuthProvider({
  hasAuthHint,
  dependencies,
  children,
}: AuthProviderProps): JSX.Element {
  const storage = useStorage();
  const [runtime] = useState<AuthRuntime | null>(() => {
    const resolved = dependencies ?? createBrowserDependencies();
    return resolved === null ? null : createRuntime(resolved);
  });
  const [bundle, setBundle] = useState<AuthBundle | null>(null);

  // One store per tab, built once storage has answered so the session record
  // is readable from the start. Nothing here runs on the server.
  useEffect(() => {
    if (runtime === null || storage.kind === "pending") {
      return;
    }
    const created = createBundle(
      runtime,
      storage.kind === "ready" ? storage.storage : null,
    );
    runtime.expiry.notify = () => {
      created.store.getState().markSessionExpired();
    };
    setBundle(created);
    created.store
      .getState()
      .initialize()
      .catch((cause: unknown) => {
        logger.error("auth.initialize-failed", {
          errorName: cause instanceof Error ? cause.name : "unknown",
        });
      });

    return () => {
      runtime.expiry.notify = () => undefined;
      created.channel.close();
    };
  }, [runtime, storage]);

  const value = useMemo<AuthContextValue>(
    () => ({
      api: runtime?.api ?? UNAVAILABLE_API_CLIENT,
      bundle,
      hasAuthHint,
    }),
    [runtime, bundle, hasAuthHint],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

function useAuthContext(): AuthContextValue {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error("This hook must be used inside an AuthProvider.");
  }

  return value;
}

export function useApiClient(): ApiClient {
  return useAuthContext().api;
}

export function useAuth<T>(selector: (state: AuthStoreState) => T): T {
  const { bundle } = useAuthContext();

  return useStore(bundle?.store ?? PLACEHOLDER_AUTH_STORE, selector);
}

export function useInitialAuthHint(): boolean {
  return useAuthContext().hasAuthHint;
}

function readCurrentUser(state: AuthState): SessionUser | null {
  if (state.status === "signed-in") {
    return state.user;
  }
  return state.status === "expired" ? state.lastUser : null;
}

// Without a repository there is no cache to clear, but the server session
// still has to be revoked.
async function signOutWithoutCache(
  api: ApiClient,
  bundle: AuthBundle,
): Promise<Result<void, SignOutFailure>> {
  const result = await api.auth.logout();
  if (!result.isOk) {
    return {
      isOk: false,
      error: { kind: "logout-failed", failure: result.error },
    };
  }
  bundle.channel.post({ type: "signed-out" });
  bundle.hintCookie.clear();
  bundle.store.getState().markSignedOut();
  return SIGN_OUT_OK;
}

async function performSignOut(
  api: ApiClient,
  bundle: AuthBundle,
  storage: StorageBundle,
  userId: string,
): Promise<Result<void, SignOutFailure>> {
  try {
    const result = await signOut({
      api,
      repository: storage.repository,
      lockManager: storage.lockManager,
      userId,
      clearAuthHint: () => {
        bundle.hintCookie.clear();
      },
      broadcastSignedOut: () => {
        bundle.channel.post({ type: "signed-out" });
      },
      createTimeoutSignal: (ms) => AbortSignal.timeout(ms),
    });
    if (result.isOk) {
      bundle.store.getState().markSignedOut();
    }
    return result;
  } catch (cause) {
    // signOut rejects only after logout succeeded, so the server session is
    // already revoked and the hint and session record are usually gone too.
    // Staying signed-in in memory would be a lie, so the state changes and
    // the error still reaches the caller, which reports it.
    bundle.store.getState().markSignedOut();
    throw cause;
  }
}

export function useSignOut(): () => Promise<Result<void, SignOutFailure>> {
  const { api, bundle } = useAuthContext();

  return useCallback(() => {
    if (bundle === null) {
      return Promise.resolve(SIGN_OUT_OK);
    }
    const user = readCurrentUser(bundle.store.getState().auth);
    if (user === null) {
      bundle.store.getState().markSignedOut();
      return Promise.resolve(SIGN_OUT_OK);
    }
    return bundle.storage === null
      ? signOutWithoutCache(api, bundle)
      : performSignOut(api, bundle, bundle.storage, user.id);
  }, [api, bundle]);
}
