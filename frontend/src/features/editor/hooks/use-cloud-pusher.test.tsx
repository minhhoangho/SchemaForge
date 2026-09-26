import type { SchemaDocument } from "@schemaforge/core";
import {
  createCounterIdGenerator,
  createSampleSchema,
} from "@schemaforge/core/testing";
import { act, screen, waitFor } from "@testing-library/react";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { useApiClient, useAuth } from "@/components/auth-provider";
import type { AuthStoreState } from "@/lib/auth/auth-store";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { RetryScheduler } from "@/lib/sync/retry-scheduler";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { RetrySchedulerContext, useCloudPusher } from "./use-cloud-pusher";
import type { CloudPusherControls } from "./use-cloud-pusher";

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const EMAIL = "user@example.com";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";
const HINT_COOKIE = "sf-auth-hint=1";
const SAMPLE_DOCUMENT = createSampleSchema();

type FakeScheduler = {
  readonly scheduler: RetryScheduler;
  readonly runLatest: () => void;
  readonly scheduledCount: () => number;
};

type Fixture = FakeBackend & {
  readonly storage: StorageBundle;
  readonly store: EditorStore;
  readonly scheduler: FakeScheduler;
};

type Mounted = Fixture & {
  readonly controls: () => CloudPusherControls;
  readonly auth: () => AuthStoreState;
  readonly unmount: () => void;
};

type MountOptions = {
  readonly ownerId?: string | null;
  readonly shouldUseContextScheduler?: boolean;
  readonly isPending?: boolean;
};

const databases = new Set<SchemaforgeDatabase>();

beforeAll(() => {
  // liveQuery skips every query while Dexie finds no global IndexedDB.
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
});

afterEach(() => {
  vi.unstubAllGlobals();
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
});

function createFakeScheduler(): FakeScheduler {
  const runs: (() => void)[] = [];
  return {
    scheduler: {
      schedule: (_delayMs, run) => {
        runs.push(run);
        return () => {
          runs.splice(runs.indexOf(run), 1);
        };
      },
    },
    runLatest: () => {
      const latest = runs.at(-1);
      if (latest === undefined) {
        throw new Error("No retry is scheduled.");
      }
      latest();
    },
    scheduledCount: () => runs.length,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function userResponse(): Response {
  return jsonResponse({
    user: { id: USER_ID, email: EMAIL, createdAt: TIMESTAMP },
  });
}

function summaryResponse(revision = 1): Response {
  return jsonResponse({
    id: SCHEMA_ID,
    name: SAMPLE_DOCUMENT.name,
    revision,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse({ statusCode: status, code }, status);
}

function requestPath(input: RequestInfo | URL): string {
  if (!(input instanceof URL)) {
    throw new Error("Expected the API client to call fetch with a URL.");
  }
  return input.pathname;
}

type FakeBackend = {
  readonly fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly schemaRequests: () => readonly RequestInit[];
  readonly queueSchemaAnswer: (answer: () => Promise<Response>) => void;
  readonly expireSession: () => void;
};

// Every request answers 401 while the session is expired, until a sign-in.
// Otherwise schema requests are recorded and take the next queued answer,
// falling back to success.
function createFakeBackend(): FakeBackend {
  const requests: RequestInit[] = [];
  const answers: (() => Promise<Response>)[] = [];
  let isSessionValid = true;
  const fetchImpl = vi.fn<typeof fetch>((input, init) => {
    const path = requestPath(input);
    if (path === "/auth/login") {
      isSessionValid = true;
      return Promise.resolve(userResponse());
    }
    if (path.startsWith("/schemas")) {
      requests.push(init ?? {});
    }
    if (!isSessionValid) {
      return Promise.resolve(errorResponse(401, "unauthenticated"));
    }
    if (path.startsWith("/auth/")) {
      return Promise.resolve(userResponse());
    }
    return answers.shift()?.() ?? Promise.resolve(summaryResponse());
  });
  return {
    fetchImpl,
    schemaRequests: () => requests,
    queueSchemaAnswer: (answer) => {
      answers.push(answer);
    },
    expireSession: () => {
      isSessionValid = false;
    },
  };
}

async function createFixture(options: MountOptions): Promise<Fixture> {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  let now = 1_000;
  const repository = createSchemaRepository({
    database,
    clock: () => {
      now += 1;
      return now;
    },
    generateId: () => SCHEMA_ID,
  });
  const ownerId = options.ownerId === undefined ? USER_ID : options.ownerId;
  const record = await repository.createSchema(
    "Billing",
    ownerId === null ? undefined : { ownerId },
  );
  await repository.saveDocument(SCHEMA_ID, SAMPLE_DOCUMENT);
  if (ownerId !== null && options.isPending !== true) {
    const saved = await repository.readSchemaRecord(SCHEMA_ID);
    await repository.completePush(SCHEMA_ID, {
      revision: 1,
      sentUpdatedAt: saved?.updatedAt ?? record.updatedAt,
    });
  }
  const backend = createFakeBackend();
  return {
    storage: {
      database,
      repository,
      lockManager: createSchemaLockManager(createFakeLockRegistry().request),
    },
    store: createEditorStore({
      schemaId: SCHEMA_ID,
      document: SAMPLE_DOCUMENT,
      generateId: createCounterIdGenerator(),
      notify: vi.fn<Notify>(),
      logger: {
        error: vi.fn<Logger["error"]>(),
        warn: vi.fn<Logger["warn"]>(),
      },
    }),
    scheduler: createFakeScheduler(),
    ...backend,
  };
}

type Captured = {
  controls: CloudPusherControls | null;
  auth: AuthStoreState | null;
};

function AuthProbe({ captured }: { readonly captured: Captured }): JSX.Element {
  const auth = useAuth((state) => state);
  captured.auth = auth;
  return <span>{`auth:${auth.auth.status}`}</span>;
}

type HarnessProps = {
  readonly fixture: Fixture;
  readonly ownerId: string | null;
  readonly shouldPassScheduler: boolean;
  readonly captured: Captured;
};

function Harness({
  fixture,
  ownerId,
  shouldPassScheduler,
  captured,
}: HarnessProps): JSX.Element {
  const controls = useCloudPusher({
    store: fixture.store,
    repository: fixture.storage.repository,
    apiClient: useApiClient(),
    schemaId: SCHEMA_ID,
    ownerId,
    ...(shouldPassScheduler ? { scheduler: fixture.scheduler.scheduler } : {}),
  });
  captured.controls = controls;
  return <span>{`cloud:${controls.status.kind}`}</span>;
}

async function mountPusher(options: MountOptions = {}): Promise<Mounted> {
  const fixture = await createFixture(options);
  const ownerId = options.ownerId === undefined ? USER_ID : options.ownerId;
  const captured: Captured = { controls: null, auth: null };
  const view = renderWithProviders(<AuthProbe captured={captured} />, {
    locale: "en",
    auth: {
      storage: fixture.storage,
      hasAuthHint: true,
      dependencies: {
        fetchImpl: fixture.fetchImpl,
        cookieJar: { cookie: HINT_COOKIE },
      },
    },
  });
  await screen.findByText("auth:signed-in");
  const harness = (
    <Harness
      fixture={fixture}
      ownerId={ownerId}
      shouldPassScheduler={options.shouldUseContextScheduler !== true}
      captured={captured}
    />
  );
  view.rerender(
    <>
      <AuthProbe captured={captured} />
      {options.shouldUseContextScheduler === true ? (
        <RetrySchedulerContext value={fixture.scheduler.scheduler}>
          {harness}
        </RetrySchedulerContext>
      ) : (
        harness
      )}
    </>,
  );
  await screen.findByText(/^cloud:/);
  return {
    ...fixture,
    controls: () => {
      if (captured.controls === null) {
        throw new Error("The harness has not rendered.");
      }
      return captured.controls;
    },
    auth: () => {
      if (captured.auth === null) {
        throw new Error("The auth probe has not rendered.");
      }
      return captured.auth;
    },
    unmount: view.unmount,
  };
}

// What autosave does after a successful write.
async function saveLocally(
  mounted: Mounted,
  document: SchemaDocument,
): Promise<void> {
  await mounted.storage.repository.saveDocument(SCHEMA_ID, document);
  act(() => {
    mounted.store.getState().setSaveStatus({ kind: "saving" });
    mounted.store.getState().setSaveStatus({ kind: "saved" });
  });
}

function sentName(request: RequestInit | undefined): unknown {
  if (typeof request?.body !== "string") {
    throw new Error("The request has no JSON body.");
  }
  const body: unknown = JSON.parse(request.body);
  if (
    typeof body !== "object" ||
    body === null ||
    !("document" in body) ||
    typeof body.document !== "object" ||
    body.document === null ||
    !("name" in body.document)
  ) {
    throw new Error("The request body has no document.");
  }
  return body.document.name;
}

async function waitForRequests(mounted: Mounted, count: number): Promise<void> {
  await waitFor(() => {
    expect(mounted.schemaRequests()).toHaveLength(count);
  });
}

describe("useCloudPusher", () => {
  it("does not call the api for a guest schema", async () => {
    const mounted = await mountPusher({ ownerId: null });

    await saveLocally(mounted, { ...SAMPLE_DOCUMENT, name: "Changed" });

    expect(mounted.schemaRequests()).toHaveLength(0);
    expect(mounted.controls().status).toEqual({ kind: "local-only" });
  });

  it("pushes a pending schema once when the editor opens", async () => {
    const mounted = await mountPusher({ isPending: true });

    await waitForRequests(mounted, 1);
    await waitFor(() => {
      expect(mounted.controls().status).toEqual({ kind: "synced" });
    });
  });

  it("pushes the document after autosave reports saved", async () => {
    const mounted = await mountPusher();

    await saveLocally(mounted, { ...SAMPLE_DOCUMENT, name: "Changed" });

    await waitForRequests(mounted, 1);
    expect(sentName(mounted.schemaRequests()[0])).toBe("Changed");
  });

  it("sends one more push when a change arrives during a request", async () => {
    const mounted = await mountPusher();
    let respond: (() => void) | null = null;
    mounted.queueSchemaAnswer(
      () =>
        new Promise<Response>((resolve) => {
          respond = () => {
            resolve(summaryResponse(2));
          };
        }),
    );
    await saveLocally(mounted, { ...SAMPLE_DOCUMENT, name: "First" });
    await waitFor(() => {
      expect(respond).not.toBeNull();
    });

    await saveLocally(mounted, { ...SAMPLE_DOCUMENT, name: "Latest" });
    act(() => {
      respond?.();
    });

    await waitForRequests(mounted, 2);
    expect(sentName(mounted.schemaRequests()[1])).toBe("Latest");
  });

  it("pushes immediately on the online event", async () => {
    const mounted = await mountPusher();
    mounted.queueSchemaAnswer(() =>
      Promise.reject(new TypeError("Failed to fetch")),
    );
    await saveLocally(mounted, { ...SAMPLE_DOCUMENT, name: "Offline" });
    await waitFor(() => {
      expect(mounted.controls().status).toEqual({
        kind: "unsynced",
        reason: "offline",
      });
    });

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitForRequests(mounted, 2);
    await waitFor(() => {
      expect(mounted.controls().status).toEqual({ kind: "synced" });
    });
  });

  it("resumes pushing when the auth status returns to signed-in", async () => {
    const mounted = await mountPusher();
    mounted.expireSession();
    await saveLocally(mounted, { ...SAMPLE_DOCUMENT, name: "Expired" });
    await screen.findByText("auth:expired");
    await screen.findByText("cloud:unsynced-session-expired");

    await act(async () => {
      await mounted.auth().signIn({ email: EMAIL, password: "a-password" });
    });

    await waitForRequests(mounted, 2);
    expect(sentName(mounted.schemaRequests()[1])).toBe("Expired");
  });

  it("retry pushes the latest document", async () => {
    const mounted = await mountPusher();
    mounted.queueSchemaAnswer(() =>
      Promise.resolve(errorResponse(403, "schema-limit-reached")),
    );
    await saveLocally(mounted, { ...SAMPLE_DOCUMENT, name: "Rejected" });
    await waitFor(() => {
      expect(mounted.controls().status).toEqual({
        kind: "failed",
        failure: "schema-limit-reached",
      });
    });
    await mounted.storage.repository.saveDocument(SCHEMA_ID, {
      ...SAMPLE_DOCUMENT,
      name: "Newest",
    });

    act(() => {
      mounted.controls().retry();
    });

    await waitForRequests(mounted, 2);
    expect(sentName(mounted.schemaRequests()[1])).toBe("Newest");
  });

  it("exposes resume from the cloud pusher", async () => {
    const mounted = await mountPusher();
    mounted.expireSession();
    await saveLocally(mounted, { ...SAMPLE_DOCUMENT, name: "Stopped" });
    await screen.findByText("cloud:unsynced-session-expired");
    act(() => {
      mounted.controls().retry();
    });
    const requestsWhileStopped = mounted.schemaRequests().length;

    act(() => {
      mounted.controls().resume();
    });

    await waitForRequests(mounted, 2);
    expect(requestsWhileStopped).toBe(1);
  });

  it("uses the scheduler from RetrySchedulerContext", async () => {
    const mounted = await mountPusher({ shouldUseContextScheduler: true });
    mounted.queueSchemaAnswer(() =>
      Promise.resolve(errorResponse(500, "internal-error")),
    );

    await saveLocally(mounted, { ...SAMPLE_DOCUMENT, name: "Later" });

    await waitFor(() => {
      expect(mounted.scheduler.scheduledCount()).toBe(1);
    });
    expect(mounted.controls().status).toEqual({
      kind: "unsynced",
      reason: "server-unreachable",
    });
  });

  it("sends nothing after unmount", async () => {
    const mounted = await mountPusher();
    mounted.queueSchemaAnswer(() =>
      Promise.resolve(errorResponse(500, "internal-error")),
    );
    await saveLocally(mounted, { ...SAMPLE_DOCUMENT, name: "Later" });
    await waitFor(() => {
      expect(mounted.scheduler.scheduledCount()).toBe(1);
    });

    mounted.unmount();
    window.dispatchEvent(new Event("online"));
    await act(() => Promise.resolve());

    expect(mounted.schemaRequests()).toHaveLength(1);
  });

  it("disposes the pusher when the auth status becomes signed-out for an owned schema", async () => {
    const mounted = await mountPusher();

    act(() => {
      mounted.auth().markSignedOut();
    });
    await screen.findByText("auth:signed-out");
    await saveLocally(mounted, { ...SAMPLE_DOCUMENT, name: "Signed out" });
    act(() => {
      mounted.controls().retry();
    });
    await act(() => Promise.resolve());

    expect(mounted.schemaRequests()).toHaveLength(0);
  });
});
