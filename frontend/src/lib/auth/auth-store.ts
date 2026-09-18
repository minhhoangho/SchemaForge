import type {
  LoginRequest,
  RegisterRequest,
  UserResponse,
} from "@schemaforge/api-contract";
import type { Result } from "@schemaforge/core";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

import type { ApiClient } from "@/lib/api/api-client";
import type { ApiFailure } from "@/lib/api/api-failure";
import type { SessionRefresher } from "@/lib/api/session-refresher";
import { logger } from "@/lib/logger";
import { SESSION_KEY } from "@/lib/storage/records";
import type { SessionRecord } from "@/lib/storage/records";

import type { AuthChannel } from "./auth-channel";
import type { AuthHintCookie } from "./auth-hint-cookie";

export type SessionUser = { readonly id: string; readonly email: string };

export type AuthState =
  | { readonly status: "unknown" }
  | { readonly status: "signed-out" }
  | { readonly status: "signed-in"; readonly user: SessionUser }
  | { readonly status: "expired"; readonly lastUser: SessionUser | null };

export type SessionStore = {
  readonly read: () => Promise<SessionRecord | null>;
  readonly write: (record: SessionRecord) => Promise<void>;
};

export type AuthStoreDependencies = {
  readonly api: ApiClient;
  readonly sessionRefresher: SessionRefresher;
  readonly hintCookie: AuthHintCookie;
  readonly channel: AuthChannel;
  readonly sessionStore: SessionStore;
  readonly onAccountChanged: (previousUserId: string) => Promise<void>;
};

export type AuthStoreState = {
  readonly auth: AuthState;
  readonly activeSignInCount: number;
  readonly initialize: () => Promise<void>;
  readonly signIn: (input: LoginRequest) => Promise<Result<void, ApiFailure>>;
  readonly signUp: (
    input: RegisterRequest,
  ) => Promise<Result<void, ApiFailure>>;
  readonly markSessionExpired: () => void;
  readonly markSignedOut: () => void;
};

const UNAUTHORIZED_STATUS = 401;

type StartupOutcome =
  | { readonly kind: "signed-in"; readonly user: SessionUser }
  // Only a 401 proves the session is gone. Network errors, timeouts and 5xx
  // keep the hint so the account's cache stays reachable (plan, Vấn đề 19).
  | { readonly kind: "expired"; readonly shouldClearHint: boolean };

function toSessionUser(user: UserResponse): SessionUser {
  return { id: user.id, email: user.email };
}

function isUnauthorized(failure: ApiFailure): boolean {
  return failure.kind === "http" && failure.status === UNAUTHORIZED_STATUS;
}

function expiredAfter(failure: ApiFailure): StartupOutcome {
  return { kind: "expired", shouldClearHint: isUnauthorized(failure) };
}

async function resolveStartup(
  dependencies: AuthStoreDependencies,
): Promise<StartupOutcome> {
  const first = await dependencies.api.auth.me();
  if (first.isOk) {
    return { kind: "signed-in", user: toSessionUser(first.value) };
  }
  if (!isUnauthorized(first.error)) {
    return expiredAfter(first.error);
  }
  const refreshed = await dependencies.sessionRefresher.refresh();
  if (!refreshed.isOk) {
    return expiredAfter(refreshed.error);
  }
  const second = await dependencies.api.auth.me();
  return second.isOk
    ? { kind: "signed-in", user: toSessionUser(second.value) }
    : expiredAfter(second.error);
}

// A failed read leaves the last user unknown: the expired state still works,
// only the sign-in form cannot prefill the email.
async function readLastUser(
  sessionStore: SessionStore,
): Promise<SessionUser | null> {
  try {
    const record = await sessionStore.read();
    return record === null ? null : { id: record.userId, email: record.email };
  } catch (cause) {
    logger.warn("auth.session-read-failed", {
      errorName: cause instanceof Error ? cause.name : "unknown",
    });
    return null;
  }
}

async function rememberAccount(
  dependencies: AuthStoreDependencies,
  user: SessionUser,
): Promise<void> {
  const previous = await dependencies.sessionStore.read();
  if (previous !== null && previous.userId !== user.id) {
    await dependencies.onAccountChanged(previous.userId);
  }
  await dependencies.sessionStore.write({
    key: SESSION_KEY,
    userId: user.id,
    email: user.email,
  });
}

export function createAuthStore(
  dependencies: AuthStoreDependencies,
): StoreApi<AuthStoreState> {
  // Every change of `auth` takes a new number, so an async step that started
  // earlier (initialize, reading the last user) cannot overwrite a newer state.
  let latestTransition = 0;
  const beginTransition = (): number => {
    latestTransition += 1;
    return latestTransition;
  };

  const store = createStore<AuthStoreState>()((set, get) => {
    async function completeSignIn(
      result: Result<UserResponse, ApiFailure>,
    ): Promise<Result<void, ApiFailure>> {
      if (!result.isOk) {
        return result;
      }
      const user = toSessionUser(result.value);
      await rememberAccount(dependencies, user);
      dependencies.hintCookie.write();
      beginTransition();
      set((state) => ({
        auth: { status: "signed-in", user },
        activeSignInCount: state.activeSignInCount + 1,
      }));
      dependencies.channel.post({ type: "signed-in" });
      return { isOk: true, value: undefined };
    }

    async function initialize(): Promise<void> {
      const transition = beginTransition();
      if (!dependencies.hintCookie.isPresent()) {
        set({ auth: { status: "signed-out" } });
        return;
      }
      const outcome = await resolveStartup(dependencies);
      if (outcome.kind === "signed-in") {
        if (transition === latestTransition) {
          set({ auth: { status: "signed-in", user: outcome.user } });
        }
        return;
      }
      const lastUser = await readLastUser(dependencies.sessionStore);
      if (transition !== latestTransition) {
        return;
      }
      if (outcome.shouldClearHint) {
        dependencies.hintCookie.clear();
      }
      set({ auth: { status: "expired", lastUser } });
    }

    function markSessionExpired(): void {
      dependencies.hintCookie.clear();
      const transition = beginTransition();
      const current = get().auth;
      if (current.status === "signed-in") {
        set({ auth: { status: "expired", lastUser: current.user } });
        return;
      }
      // readLastUser never rejects, so this chain needs no catch.
      void readLastUser(dependencies.sessionStore).then((lastUser) => {
        if (transition === latestTransition) {
          set({ auth: { status: "expired", lastUser } });
        }
      });
    }

    return {
      auth: { status: "unknown" },
      activeSignInCount: 0,
      initialize,
      signIn: async (input) =>
        completeSignIn(await dependencies.api.auth.login(input)),
      signUp: async (input) =>
        completeSignIn(await dependencies.api.auth.register(input)),
      markSessionExpired,
      markSignedOut: () => {
        beginTransition();
        set({ auth: { status: "signed-out" } });
      },
    };
  });

  // Messages from other tabs are applied but never re-broadcast.
  dependencies.channel.subscribe((message) => {
    switch (message.type) {
      case "signed-in":
        store
          .getState()
          .initialize()
          .catch((cause: unknown) => {
            logger.error("auth.initialize-failed", {
              errorName: cause instanceof Error ? cause.name : "unknown",
            });
          });
        return;
      case "signed-out":
        store.getState().markSignedOut();
        return;
      default: {
        const unhandledMessage: never = message;
        return unhandledMessage;
      }
    }
  });

  return store;
}
