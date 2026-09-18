import { describe, expect, it, vi } from "vitest";

import { createApiClient, createRawAuthCalls } from "@/lib/api/api-client";
import { createSessionRefresher } from "@/lib/api/session-refresher";
import { logger } from "@/lib/logger";
import type { SessionRecord } from "@/lib/storage/records";
import { createFakeAuthLockManager } from "@/testing/fake-auth-lock-manager";

import { createAuthChannel } from "./auth-channel";
import type { AuthChannelMessage, BroadcastChannelLike } from "./auth-channel";
import {
  AUTH_HINT_COOKIE_NAME,
  createAuthHintCookie,
} from "./auth-hint-cookie";
import { createAuthStore } from "./auth-store";
import type { SessionStore } from "./auth-store";

const BASE_URL = "https://api.schemaforge.invalid";
const USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "user@example.com",
};
const OTHER_USER = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "other@example.com",
};
const CREDENTIALS = { email: USER.email, password: "hunter22" };

type RouteKey =
  | "GET /auth/me"
  | "POST /auth/refresh"
  | "POST /auth/login"
  | "POST /auth/register";

type FakeReply = () => Response;

function userReply(user: typeof USER = USER): FakeReply {
  return () =>
    Response.json({
      user: { ...user, createdAt: "2026-01-01T00:00:00.000Z" },
    });
}

function errorReply(status: number, code: string): FakeReply {
  return () => Response.json({ statusCode: status, code }, { status });
}

function noContentReply(): FakeReply {
  return () => new Response(null, { status: 204 });
}

function networkFailure(): FakeReply {
  return () => {
    throw new TypeError("Failed to fetch");
  };
}

// Answers each route from its own queue. A request without a queued reply
// gets a 418 with no body, which the client reports as invalid-response, so
// an unexpected request shows up as a wrong result instead of a network error.
function createFakeFetch(replies: Partial<Record<RouteKey, FakeReply[]>>) {
  const queues = new Map<string, FakeReply[]>(Object.entries(replies));
  return vi.fn<typeof fetch>((input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const key = `${init?.method ?? "GET"} ${url.pathname}`;
    const reply = queues.get(key)?.shift();
    if (reply === undefined) {
      return Promise.resolve(new Response(null, { status: 418 }));
    }
    try {
      return Promise.resolve(reply());
    } catch (cause) {
      return Promise.reject(cause instanceof Error ? cause : new Error(key));
    }
  });
}

// Keeps name=value pairs like document.cookie: Max-Age=0 removes a cookie and
// reading returns only the pairs, not the attributes.
class FakeCookieJar {
  private readonly values = new Map<string, string>();

  get cookie(): string {
    return [...this.values]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  set cookie(serialized: string) {
    const [pair = "", ...attributes] = serialized.split(";");
    const [name = "", value = ""] = pair.trim().split("=");
    if (attributes.some((attribute) => attribute.trim() === "Max-Age=0")) {
      this.values.delete(name);
      return;
    }
    this.values.set(name, value);
  }
}

class FakeBroadcastChannel extends EventTarget {
  constructor(private readonly peers: Set<FakeBroadcastChannel>) {
    super();
    peers.add(this);
  }

  postMessage(message: unknown): void {
    for (const peer of this.peers) {
      if (peer !== this) {
        peer.dispatchEvent(new MessageEvent("message", { data: message }));
      }
    }
  }

  close(): void {
    this.peers.delete(this);
  }
}

function createInMemorySessionStore(initial: SessionRecord | null = null): {
  readonly sessionStore: SessionStore;
  readonly current: () => SessionRecord | null;
} {
  let record = initial;
  return {
    sessionStore: {
      read: vi.fn(() => Promise.resolve(record)),
      write: vi.fn((next: SessionRecord) => {
        record = next;
        return Promise.resolve();
      }),
    },
    current: () => record,
  };
}

function sessionOf(user: typeof USER): SessionRecord {
  return { key: "current", userId: user.id, email: user.email };
}

function createHarness(input: {
  readonly replies?: Partial<Record<RouteKey, FakeReply[]>>;
  readonly hasHint?: boolean;
  readonly session?: SessionRecord | null;
}) {
  const fetchImpl = createFakeFetch(input.replies ?? {});
  const sessionRefresher = createSessionRefresher({
    lockManager: createFakeAuthLockManager().lockManager,
    calls: createRawAuthCalls({ baseUrl: BASE_URL, fetchImpl }),
  });
  const api = createApiClient({
    baseUrl: BASE_URL,
    fetchImpl,
    sessionRefresher,
    onSessionExpired: vi.fn(),
  });
  const cookieJar = new FakeCookieJar();
  if (input.hasHint === true) {
    cookieJar.cookie = `${AUTH_HINT_COOKIE_NAME}=1`;
  }
  const peers = new Set<FakeBroadcastChannel>();
  const openChannel = (): BroadcastChannelLike =>
    new FakeBroadcastChannel(peers);
  const otherTab = createAuthChannel(openChannel);
  const otherTabMessages: AuthChannelMessage[] = [];
  otherTab.subscribe((message) => otherTabMessages.push(message));
  const session = createInMemorySessionStore(input.session ?? null);
  const onAccountChanged = vi.fn(() => Promise.resolve());
  const store = createAuthStore({
    api,
    sessionRefresher,
    hintCookie: createAuthHintCookie({ cookieJar, isSecure: false }),
    channel: createAuthChannel(openChannel),
    sessionStore: session.sessionStore,
    onAccountChanged,
  });
  return {
    store,
    fetchImpl,
    cookieJar,
    otherTab,
    otherTabMessages,
    session,
    onAccountChanged,
  };
}

describe("createAuthStore", () => {
  it("starts in the unknown state", () => {
    const { store } = createHarness({});

    expect(store.getState().auth).toEqual({ status: "unknown" });
    expect(store.getState().activeSignInCount).toBe(0);
  });

  it("becomes signed-out without calling fetch when there is no hint", async () => {
    const { store, fetchImpl, session } = createHarness({});

    await store.getState().initialize();

    expect(store.getState().auth).toEqual({ status: "signed-out" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(session.sessionStore.read).not.toHaveBeenCalled();
  });

  it("calls me and becomes signed-in when the hint is present", async () => {
    const { store, fetchImpl } = createHarness({
      hasHint: true,
      replies: { "GET /auth/me": [userReply()] },
    });

    await store.getState().initialize();

    expect(store.getState().auth).toEqual({ status: "signed-in", user: USER });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("refreshes once and retries me after a 401", async () => {
    const { store, fetchImpl } = createHarness({
      hasHint: true,
      replies: {
        // The refresher checks me inside the auth lock before refreshing.
        "GET /auth/me": [
          errorReply(401, "unauthenticated"),
          errorReply(401, "unauthenticated"),
          userReply(),
        ],
        "POST /auth/refresh": [noContentReply()],
      },
    });

    await store.getState().initialize();

    expect(store.getState().auth).toEqual({ status: "signed-in", user: USER });
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("clears the hint and becomes expired with the stored last user when the refresh fails", async () => {
    const { store, cookieJar } = createHarness({
      hasHint: true,
      session: sessionOf(USER),
      replies: {
        "GET /auth/me": [
          errorReply(401, "unauthenticated"),
          errorReply(401, "unauthenticated"),
        ],
        "POST /auth/refresh": [errorReply(401, "session-expired")],
      },
    });

    await store.getState().initialize();

    expect(store.getState().auth).toEqual({
      status: "expired",
      lastUser: USER,
    });
    expect(cookieJar.cookie).toBe("");
  });

  it("clears the hint when me still returns 401 after a successful refresh", async () => {
    const { store, cookieJar } = createHarness({
      hasHint: true,
      replies: {
        "GET /auth/me": [
          errorReply(401, "unauthenticated"),
          errorReply(401, "unauthenticated"),
          errorReply(401, "unauthenticated"),
        ],
        "POST /auth/refresh": [noContentReply()],
      },
    });

    await store.getState().initialize();

    expect(store.getState().auth).toEqual({
      status: "expired",
      lastUser: null,
    });
    expect(cookieJar.cookie).toBe("");
  });

  it.each([
    ["a network error", networkFailure()],
    ["a server error", errorReply(500, "internal-error")],
  ])(
    "keeps the hint and becomes expired when me fails with %s",
    async (_label, reply) => {
      const { store, cookieJar } = createHarness({
        hasHint: true,
        session: sessionOf(USER),
        replies: { "GET /auth/me": [reply] },
      });

      await store.getState().initialize();

      expect(store.getState().auth).toEqual({
        status: "expired",
        lastUser: USER,
      });
      expect(cookieJar.cookie).toBe(`${AUTH_HINT_COOKIE_NAME}=1`);
    },
  );

  it("keeps the hint when the refresh fails with a network error", async () => {
    const { store, cookieJar } = createHarness({
      hasHint: true,
      replies: {
        "GET /auth/me": [
          errorReply(401, "unauthenticated"),
          errorReply(401, "unauthenticated"),
        ],
        "POST /auth/refresh": [networkFailure()],
      },
    });

    await store.getState().initialize();

    expect(store.getState().auth).toEqual({
      status: "expired",
      lastUser: null,
    });
    expect(cookieJar.cookie).toBe(`${AUTH_HINT_COOKIE_NAME}=1`);
  });

  it("writes the hint, the session record and broadcasts signed-in after signing in", async () => {
    const { store, cookieJar, session, otherTabMessages } = createHarness({
      replies: { "POST /auth/login": [userReply()] },
    });

    const result = await store.getState().signIn(CREDENTIALS);

    expect(result).toEqual({ isOk: true, value: undefined });
    expect(store.getState().auth).toEqual({ status: "signed-in", user: USER });
    expect(cookieJar.cookie).toBe(`${AUTH_HINT_COOKIE_NAME}=1`);
    expect(session.current()).toEqual(sessionOf(USER));
    expect(otherTabMessages).toEqual([{ type: "signed-in" }]);
  });

  it("signs up with the same effects as signing in", async () => {
    const { store, cookieJar, session } = createHarness({
      replies: { "POST /auth/register": [userReply()] },
    });

    const result = await store.getState().signUp(CREDENTIALS);

    expect(result).toEqual({ isOk: true, value: undefined });
    expect(store.getState().auth).toEqual({ status: "signed-in", user: USER });
    expect(store.getState().activeSignInCount).toBe(1);
    expect(cookieJar.cookie).toBe(`${AUTH_HINT_COOKIE_NAME}=1`);
    expect(session.current()).toEqual(sessionOf(USER));
  });

  it("increments activeSignInCount only for an active sign-in", async () => {
    const { store } = createHarness({
      hasHint: true,
      replies: {
        "GET /auth/me": [userReply()],
        "POST /auth/login": [userReply()],
      },
    });

    await store.getState().initialize();
    const countAfterInitialize = store.getState().activeSignInCount;
    await store.getState().signIn(CREDENTIALS);

    expect(countAfterInitialize).toBe(0);
    expect(store.getState().activeSignInCount).toBe(1);
  });

  it("keeps the state and writes nothing when signing in fails", async () => {
    const { store, cookieJar, session, otherTabMessages } = createHarness({
      replies: { "POST /auth/login": [errorReply(401, "invalid-credentials")] },
    });
    await store.getState().initialize();

    const result = await store.getState().signIn(CREDENTIALS);

    expect(result.isOk).toBe(false);
    expect(store.getState().auth).toEqual({ status: "signed-out" });
    expect(store.getState().activeSignInCount).toBe(0);
    expect(cookieJar.cookie).toBe("");
    expect(session.sessionStore.write).not.toHaveBeenCalled();
    expect(otherTabMessages).toEqual([]);
  });

  it("rejects and writes no hint when the session record cannot be written", async () => {
    const { store, cookieJar, session, otherTabMessages } = createHarness({
      replies: { "POST /auth/login": [userReply()] },
    });
    await store.getState().initialize();
    const writeFailure = Object.assign(new Error("closed"), {
      name: "DatabaseClosedError",
    });
    vi.mocked(session.sessionStore.write).mockRejectedValueOnce(writeFailure);

    await expect(store.getState().signIn(CREDENTIALS)).rejects.toBe(
      writeFailure,
    );
    expect(store.getState().auth).toEqual({ status: "signed-out" });
    expect(store.getState().activeSignInCount).toBe(0);
    expect(cookieJar.cookie).toBe("");
    expect(otherTabMessages).toEqual([]);
  });

  it("calls onAccountChanged before replacing the session of another account", async () => {
    const { store, session, onAccountChanged } = createHarness({
      session: sessionOf(OTHER_USER),
      replies: { "POST /auth/login": [userReply()] },
    });
    const sessionWhenCalled: (SessionRecord | null)[] = [];
    onAccountChanged.mockImplementation(() => {
      sessionWhenCalled.push(session.current());
      return Promise.resolve();
    });

    await store.getState().signIn(CREDENTIALS);

    expect(onAccountChanged).toHaveBeenCalledExactlyOnceWith(OTHER_USER.id);
    expect(sessionWhenCalled).toEqual([sessionOf(OTHER_USER)]);
    expect(session.current()).toEqual(sessionOf(USER));
  });

  it("does not call onAccountChanged for the same account", async () => {
    const { store, onAccountChanged } = createHarness({
      session: sessionOf(USER),
      replies: { "POST /auth/login": [userReply()] },
    });

    await store.getState().signIn(CREDENTIALS);

    expect(onAccountChanged).not.toHaveBeenCalled();
  });

  it("runs initialize when another tab broadcasts signed-in", async () => {
    const { store, cookieJar, otherTab } = createHarness({
      replies: { "GET /auth/me": [userReply()] },
    });
    await store.getState().initialize();
    cookieJar.cookie = `${AUTH_HINT_COOKIE_NAME}=1`;

    otherTab.post({ type: "signed-in" });

    await vi.waitFor(() => {
      expect(store.getState().auth).toEqual({
        status: "signed-in",
        user: USER,
      });
    });
    expect(store.getState().activeSignInCount).toBe(0);
  });

  it("becomes signed-out when another tab broadcasts signed-out", async () => {
    const { store, otherTab, otherTabMessages } = createHarness({
      replies: { "POST /auth/login": [userReply()] },
    });
    await store.getState().signIn(CREDENTIALS);

    otherTab.post({ type: "signed-out" });

    expect(store.getState().auth).toEqual({ status: "signed-out" });
    expect(otherTabMessages).toEqual([{ type: "signed-in" }]);
  });

  it("ignores an initialize result that finishes after the user signed out", async () => {
    let answerMe: (response: Response) => void = () => undefined;
    const { store, fetchImpl } = createHarness({ hasHint: true });
    fetchImpl.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          answerMe = resolve;
        }),
    );

    const initializing = store.getState().initialize();
    store.getState().markSignedOut();
    answerMe(userReply()());
    await initializing;

    expect(store.getState().auth).toEqual({ status: "signed-out" });
  });

  it("keeps the last user when the session expires", async () => {
    const { store, cookieJar } = createHarness({
      replies: { "POST /auth/login": [userReply()] },
    });
    await store.getState().signIn(CREDENTIALS);

    store.getState().markSessionExpired();

    expect(store.getState().auth).toEqual({
      status: "expired",
      lastUser: USER,
    });
    expect(cookieJar.cookie).toBe("");
  });

  it("reads the last user from the session record when the session expires while not signed in", async () => {
    const { store } = createHarness({ session: sessionOf(OTHER_USER) });

    store.getState().markSessionExpired();

    await vi.waitFor(() => {
      expect(store.getState().auth).toEqual({
        status: "expired",
        lastUser: OTHER_USER,
      });
    });
  });

  it("keeps a sign-in that completes before the expired session read finishes", async () => {
    const { store, session } = createHarness({
      replies: { "POST /auth/login": [userReply()] },
    });
    let answerRead: (record: SessionRecord | null) => void = () => undefined;
    vi.mocked(session.sessionStore.read).mockImplementationOnce(
      () =>
        new Promise<SessionRecord | null>((resolve) => {
          answerRead = resolve;
        }),
    );

    store.getState().markSessionExpired();
    await store.getState().signIn(CREDENTIALS);
    answerRead(sessionOf(OTHER_USER));
    // A macrotask lets every pending microtask, including the late read's
    // continuation, run before the assertion.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    expect(store.getState().auth).toEqual({ status: "signed-in", user: USER });
  });

  it("becomes expired without a last user and logs when the session record cannot be read", async () => {
    const { store, session } = createHarness({
      hasHint: true,
      replies: { "GET /auth/me": [networkFailure()] },
    });
    vi.mocked(session.sessionStore.read).mockRejectedValueOnce(
      Object.assign(new Error("closed"), { name: "DatabaseClosedError" }),
    );
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);

    await store.getState().initialize();

    expect(store.getState().auth).toEqual({
      status: "expired",
      lastUser: null,
    });
    expect(warn).toHaveBeenCalledWith("auth.session-read-failed", {
      errorName: "DatabaseClosedError",
    });
  });

  it("becomes signed-out without touching the hint or the session record", async () => {
    const { store, cookieJar, session } = createHarness({
      replies: { "POST /auth/login": [userReply()] },
    });
    await store.getState().signIn(CREDENTIALS);

    store.getState().markSignedOut();

    expect(store.getState().auth).toEqual({ status: "signed-out" });
    expect(cookieJar.cookie).toBe(`${AUTH_HINT_COOKIE_NAME}=1`);
    expect(session.current()).toEqual(sessionOf(USER));
  });
});
