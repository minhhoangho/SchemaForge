import { MAX_REQUEST_BODY_BYTES } from "@schemaforge/api-contract";
import type { SchemaDocument } from "@schemaforge/core";
import { createSampleSchema } from "@schemaforge/core/testing";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/lib/api/api-client";
import type { SessionRefresher } from "@/lib/api/session-refresher";
import { logger } from "@/lib/logger";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";

import { createCloudPusher } from "./cloud-pusher";
import type { CloudPusher, CloudPushState } from "./cloud-pusher";
import type { RetryScheduler } from "./retry-scheduler";

const BASE_URL = "https://api.schemaforge.invalid";
const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";
const SAMPLE_DOCUMENT = createSampleSchema();
const FIRST_CHANGE: SchemaDocument = { ...SAMPLE_DOCUMENT, name: "First" };
const LATEST_CHANGE: SchemaDocument = { ...SAMPLE_DOCUMENT, name: "Latest" };

type ScheduledRun = {
  readonly delayMs: number;
  readonly run: () => void;
  isCancelled: boolean;
};

type FakeScheduler = {
  readonly scheduler: RetryScheduler;
  readonly delays: () => readonly number[];
  readonly runLatest: () => void;
  readonly hasActiveRun: () => boolean;
};

type FakeOnlineEvents = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly emit: () => void;
  readonly listenerCount: () => number;
};

type Fixture = {
  readonly repository: SchemaRepository;
  readonly database: SchemaforgeDatabase;
  readonly fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly scheduler: FakeScheduler;
  readonly online: FakeOnlineEvents;
  readonly pusher: CloudPusher;
};

const databases = new Set<SchemaforgeDatabase>();
const pushers = new Set<CloudPusher>();

afterEach(() => {
  pushers.forEach((pusher) => {
    pusher.dispose();
  });
  pushers.clear();
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
  vi.restoreAllMocks();
});

function createFakeScheduler(): FakeScheduler {
  const runs: ScheduledRun[] = [];
  return {
    scheduler: {
      schedule: (delayMs, run) => {
        const entry: ScheduledRun = { delayMs, run, isCancelled: false };
        runs.push(entry);
        return () => {
          entry.isCancelled = true;
        };
      },
    },
    delays: () => runs.map((entry) => entry.delayMs),
    runLatest: () => {
      const latest = runs.at(-1);
      if (latest === undefined || latest.isCancelled) {
        throw new Error("No active retry is scheduled.");
      }
      latest.run();
    },
    hasActiveRun: () => runs.some((entry) => !entry.isCancelled),
  };
}

function createFakeOnlineEvents(): FakeOnlineEvents {
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: () => {
      listeners.forEach((listener) => {
        listener();
      });
    },
    listenerCount: () => listeners.size,
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function summaryBody(revision: number) {
  return {
    id: SCHEMA_ID,
    name: SAMPLE_DOCUMENT.name,
    revision,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function summaryResponse(revision: number): Response {
  return jsonResponse(summaryBody(revision), 200);
}

function errorResponse(
  status: number,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Response {
  return jsonResponse({ statusCode: status, ...body }, status, headers);
}

function serverErrorResponse(): Response {
  return errorResponse(500, { code: "internal-error" });
}

const expiredSessionRefresher: SessionRefresher = {
  refresh: () =>
    Promise.resolve({
      isOk: false,
      error: {
        kind: "http",
        status: 401,
        body: { statusCode: 401, code: "session-expired" },
        retryAfterSeconds: null,
      },
    }),
};

async function setUp(
  options: { readonly isOnline?: boolean } = {},
): Promise<Fixture> {
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
  await repository.createSchema("Billing", { ownerId: USER_ID });
  await repository.saveDocument(SCHEMA_ID, SAMPLE_DOCUMENT);
  const fetchImpl = vi.fn<typeof fetch>();
  const scheduler = createFakeScheduler();
  const online = createFakeOnlineEvents();
  const pusher = createCloudPusher({
    api: createApiClient({
      baseUrl: BASE_URL,
      fetchImpl,
      sessionRefresher: expiredSessionRefresher,
      onSessionExpired: vi.fn(),
    }),
    repository,
    schemaId: SCHEMA_ID,
    userId: USER_ID,
    scheduler: scheduler.scheduler,
    onlineEvents: online,
    isOnline: () => options.isOnline ?? true,
  });
  pushers.add(pusher);
  return { repository, database, fetchImpl, scheduler, online, pusher };
}

function deferResponse(fetchImpl: Fixture["fetchImpl"]): {
  readonly respond: (response: Response) => void;
} {
  let resolveResponse: ((response: Response) => void) | null = null;
  fetchImpl.mockImplementationOnce(
    () =>
      new Promise<Response>((resolve) => {
        resolveResponse = resolve;
      }),
  );
  return {
    respond: (response) => {
      if (resolveResponse === null) {
        throw new Error("The deferred request has not been sent yet.");
      }
      resolveResponse(response);
    },
  };
}

async function waitForState(
  pusher: CloudPusher,
  expected: CloudPushState,
): Promise<void> {
  await vi.waitFor(() => {
    expect(pusher.getState()).toEqual(expected);
  });
}

async function waitForRequestCount(
  fetchImpl: Fixture["fetchImpl"],
  count: number,
): Promise<void> {
  await vi.waitFor(() => {
    expect(fetchImpl).toHaveBeenCalledTimes(count);
  });
}

async function saveAndRequest(
  fixture: Fixture,
  document: SchemaDocument,
): Promise<void> {
  await fixture.repository.saveDocument(SCHEMA_ID, document);
  fixture.pusher.requestPush();
}

function requestBody(fetchImpl: Fixture["fetchImpl"], index: number): unknown {
  const body = fetchImpl.mock.calls[index]?.[1]?.body;
  if (typeof body !== "string") {
    throw new Error(`No request body recorded at index ${String(index)}.`);
  }
  return JSON.parse(body);
}

async function retryAndWaitForDelays(
  scheduler: FakeScheduler,
  count: number,
): Promise<void> {
  scheduler.runLatest();
  await vi.waitFor(() => {
    expect(scheduler.delays()).toHaveLength(count);
  });
}

async function reachConflict(fixture: Fixture): Promise<void> {
  fixture.fetchImpl
    .mockResolvedValueOnce(
      errorResponse(409, { code: "schema-id-unavailable" }),
    )
    .mockResolvedValueOnce(
      jsonResponse({ ...summaryBody(2), document: FIRST_CHANGE }, 200),
    );
  fixture.pusher.requestPush();
  await vi.waitFor(() => {
    expect(fixture.pusher.getState().kind).toBe("conflict");
  });
}

async function reachSessionExpired(fixture: Fixture): Promise<void> {
  fixture.fetchImpl.mockResolvedValueOnce(
    errorResponse(401, { code: "unauthenticated" }),
  );
  fixture.pusher.requestPush();
  await waitForState(fixture.pusher, { kind: "session-expired" });
}

describe("createCloudPusher sending", () => {
  it("starts idle", async () => {
    const { pusher } = await setUp();

    expect(pusher.getState()).toEqual({ kind: "idle" });
  });

  it("sends one request at a time", async () => {
    const fixture = await setUp();
    const first = deferResponse(fixture.fetchImpl);
    fixture.pusher.requestPush();
    await waitForRequestCount(fixture.fetchImpl, 1);

    await saveAndRequest(fixture, FIRST_CHANGE);
    await saveAndRequest(fixture, LATEST_CHANGE);

    expect(fixture.fetchImpl).toHaveBeenCalledOnce();
    expect(fixture.pusher.getState()).toEqual({ kind: "sending" });
    fixture.fetchImpl.mockResolvedValueOnce(summaryResponse(2));
    first.respond(summaryResponse(1));
    await waitForState(fixture.pusher, { kind: "synced" });
  });

  it("sends the latest document once more after changes arrive while sending", async () => {
    const fixture = await setUp();
    const first = deferResponse(fixture.fetchImpl);
    fixture.fetchImpl.mockResolvedValueOnce(summaryResponse(2));
    fixture.pusher.requestPush();
    await waitForRequestCount(fixture.fetchImpl, 1);
    await saveAndRequest(fixture, FIRST_CHANGE);
    await saveAndRequest(fixture, LATEST_CHANGE);

    first.respond(summaryResponse(1));
    await waitForState(fixture.pusher, { kind: "synced" });

    expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
    expect(requestBody(fixture.fetchImpl, 1)).toEqual({
      document: LATEST_CHANGE,
      expectedRevision: 1,
    });
  });

  it("publishes each state change to subscribers until they unsubscribe", async () => {
    const fixture = await setUp();
    const listener = vi.fn();
    const unsubscribe = fixture.pusher.subscribe(listener);
    fixture.fetchImpl.mockResolvedValueOnce(summaryResponse(1));

    fixture.pusher.requestPush();
    await waitForState(fixture.pusher, { kind: "synced" });
    unsubscribe();
    await saveAndRequest(fixture, FIRST_CHANGE);

    expect(listener.mock.calls).toEqual([
      [{ kind: "sending" }],
      [{ kind: "synced" }],
    ]);
  });

  it("returns to idle when the schema is not pushable", async () => {
    const fixture = await setUp();
    await fixture.repository.setSyncState(SCHEMA_ID, {
      cloudRevision: 1,
      syncStatus: "synced",
    });

    fixture.pusher.requestPush();

    await waitForState(fixture.pusher, { kind: "idle" });
    expect(fixture.fetchImpl).not.toHaveBeenCalled();
  });
});

describe("createCloudPusher retries", () => {
  it("retries after 2 seconds and doubles the delay up to 60 seconds", async () => {
    const { fetchImpl, scheduler, pusher } = await setUp();
    fetchImpl.mockImplementation(() => Promise.resolve(serverErrorResponse()));
    pusher.requestPush();
    await waitForState(pusher, { kind: "waiting-retry", reason: "server" });

    await retryAndWaitForDelays(scheduler, 2);
    await retryAndWaitForDelays(scheduler, 3);
    await retryAndWaitForDelays(scheduler, 4);
    await retryAndWaitForDelays(scheduler, 5);
    await retryAndWaitForDelays(scheduler, 6);
    await retryAndWaitForDelays(scheduler, 7);

    expect(scheduler.delays()).toEqual([
      2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000,
    ]);
  });

  it("resets the delay after a successful push", async () => {
    const fixture = await setUp();
    fixture.fetchImpl
      .mockResolvedValueOnce(serverErrorResponse())
      .mockResolvedValueOnce(summaryResponse(1))
      .mockResolvedValueOnce(serverErrorResponse());
    fixture.pusher.requestPush();
    await waitForState(fixture.pusher, {
      kind: "waiting-retry",
      reason: "server",
    });
    fixture.scheduler.runLatest();
    await waitForState(fixture.pusher, { kind: "synced" });

    await saveAndRequest(fixture, FIRST_CHANGE);
    await vi.waitFor(() => {
      expect(fixture.scheduler.delays()).toHaveLength(2);
    });

    expect(fixture.scheduler.delays()).toEqual([2_000, 2_000]);
  });

  it("waits for Retry-After on 429", async () => {
    const { fetchImpl, scheduler, pusher } = await setUp();
    fetchImpl.mockResolvedValueOnce(
      errorResponse(
        429,
        { code: "too-many-requests" },
        { "Retry-After": "30" },
      ),
    );

    pusher.requestPush();

    await waitForState(pusher, { kind: "waiting-retry", reason: "server" });
    expect(scheduler.delays()).toEqual([30_000]);
  });

  it("reports offline after a network failure", async () => {
    const { fetchImpl, pusher } = await setUp();
    fetchImpl.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    pusher.requestPush();

    await waitForState(pusher, { kind: "waiting-retry", reason: "offline" });
  });

  it("reports offline when the browser is offline", async () => {
    const { fetchImpl, pusher } = await setUp({ isOnline: false });
    fetchImpl.mockResolvedValueOnce(serverErrorResponse());

    pusher.requestPush();

    await waitForState(pusher, { kind: "waiting-retry", reason: "offline" });
  });

  it("retries immediately on the online event", async () => {
    const { fetchImpl, scheduler, online, pusher } = await setUp();
    fetchImpl
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(summaryResponse(1));
    pusher.requestPush();
    await waitForState(pusher, { kind: "waiting-retry", reason: "offline" });

    online.emit();

    await waitForState(pusher, { kind: "synced" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(scheduler.hasActiveRun()).toBe(false);
  });

  it("retries immediately when a new change is requested while waiting", async () => {
    const fixture = await setUp();
    fixture.fetchImpl
      .mockResolvedValueOnce(serverErrorResponse())
      .mockResolvedValueOnce(summaryResponse(1));
    fixture.pusher.requestPush();
    await waitForState(fixture.pusher, {
      kind: "waiting-retry",
      reason: "server",
    });

    await saveAndRequest(fixture, FIRST_CHANGE);

    await waitForState(fixture.pusher, { kind: "synced" });
    expect(requestBody(fixture.fetchImpl, 1)).toEqual({
      id: SCHEMA_ID,
      document: FIRST_CHANGE,
    });
    expect(fixture.scheduler.hasActiveRun()).toBe(false);
  });

  it("retries with backoff when the push throws", async () => {
    vi.spyOn(logger, "error").mockImplementation(() => undefined);
    const { database, scheduler, pusher } = await setUp();
    database.close();

    pusher.requestPush();

    await waitForState(pusher, { kind: "waiting-retry", reason: "server" });
    expect(scheduler.delays()).toEqual([2_000]);
  });
});

describe("createCloudPusher stops", () => {
  it("stops pushing after a conflict", async () => {
    const fixture = await setUp();
    await reachConflict(fixture);

    await saveAndRequest(fixture, LATEST_CHANGE);

    expect(fixture.pusher.getState()).toEqual({
      kind: "conflict",
      cloud: { ...summaryBody(2), document: FIRST_CHANGE },
    });
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("stops pushing after the cloud copy was deleted", async () => {
    const fixture = await setUp();
    await fixture.repository.setSyncState(SCHEMA_ID, {
      cloudRevision: 3,
      syncStatus: "pending",
    });
    fixture.fetchImpl.mockResolvedValueOnce(
      errorResponse(404, { code: "not-found" }),
    );
    fixture.pusher.requestPush();
    await waitForState(fixture.pusher, { kind: "deleted-in-cloud" });

    fixture.pusher.requestPush();

    expect(fixture.pusher.getState()).toEqual({ kind: "deleted-in-cloud" });
    expect(fixture.fetchImpl).toHaveBeenCalledOnce();
  });

  it("stops pushing after the session expires", async () => {
    const fixture = await setUp();
    await reachSessionExpired(fixture);

    await saveAndRequest(fixture, FIRST_CHANGE);
    fixture.online.emit();

    expect(fixture.pusher.getState()).toEqual({ kind: "session-expired" });
    expect(fixture.fetchImpl).toHaveBeenCalledOnce();
  });

  it("pushes again after resume", async () => {
    const fixture = await setUp();
    await reachSessionExpired(fixture);
    fixture.fetchImpl.mockResolvedValueOnce(summaryResponse(1));

    fixture.pusher.resume();

    await waitForState(fixture.pusher, { kind: "synced" });
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a failed push until a new change", async () => {
    const fixture = await setUp();
    fixture.fetchImpl
      .mockResolvedValueOnce(
        errorResponse(403, { code: "schema-limit-reached" }),
      )
      .mockResolvedValueOnce(summaryResponse(1));
    fixture.pusher.requestPush();
    await waitForState(fixture.pusher, {
      kind: "failed",
      code: "schema-limit-reached",
    });
    fixture.online.emit();
    expect(fixture.scheduler.delays()).toEqual([]);
    expect(fixture.fetchImpl).toHaveBeenCalledOnce();

    await saveAndRequest(fixture, FIRST_CHANGE);

    await waitForState(fixture.pusher, { kind: "synced" });
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not send when the document exceeds the size limit", async () => {
    const fixture = await setUp();

    await saveAndRequest(fixture, {
      ...SAMPLE_DOCUMENT,
      name: "x".repeat(MAX_REQUEST_BODY_BYTES),
    });

    await waitForState(fixture.pusher, {
      kind: "failed",
      code: "payload-too-large",
    });
    expect(fixture.fetchImpl).not.toHaveBeenCalled();
  });

  it("stops timers and listeners after dispose", async () => {
    const { fetchImpl, scheduler, online, pusher } = await setUp();
    fetchImpl.mockResolvedValueOnce(serverErrorResponse());
    pusher.requestPush();
    await waitForState(pusher, { kind: "waiting-retry", reason: "server" });

    pusher.dispose();

    expect(scheduler.hasActiveRun()).toBe(false);
    expect(online.listenerCount()).toBe(0);
  });

  it("does not publish a state after dispose while a push is in flight", async () => {
    const { repository, fetchImpl, pusher } = await setUp();
    const listener = vi.fn();
    const pending = deferResponse(fetchImpl);
    pusher.requestPush();
    await waitForRequestCount(fetchImpl, 1);
    pusher.subscribe(listener);

    pusher.dispose();
    pending.respond(summaryResponse(1));
    await vi.waitFor(async () => {
      await expect(
        repository.readSchemaRecord(SCHEMA_ID),
      ).resolves.toMatchObject({ syncStatus: "synced" });
    });
    pusher.requestPush();

    expect(listener).not.toHaveBeenCalled();
    expect(pusher.getState()).toEqual({ kind: "sending" });
  });
});

describe("createCloudPusher changes requested while sending", () => {
  async function sendWithQueuedChange(
    fixture: Fixture,
    responses: {
      readonly first: Response;
      readonly next: Response;
    },
  ): Promise<void> {
    const first = deferResponse(fixture.fetchImpl);
    fixture.fetchImpl.mockResolvedValueOnce(responses.next);
    fixture.pusher.requestPush();
    await waitForRequestCount(fixture.fetchImpl, 1);
    await saveAndRequest(fixture, FIRST_CHANGE);
    first.respond(responses.first);
  }

  it("sends the queued change immediately when the send ends retryable", async () => {
    const fixture = await setUp();

    await sendWithQueuedChange(fixture, {
      first: serverErrorResponse(),
      next: summaryResponse(1),
    });

    await waitForState(fixture.pusher, { kind: "synced" });
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
    expect(fixture.scheduler.delays()).toEqual([]);
  });

  it("sends the queued change immediately when the send fails", async () => {
    const fixture = await setUp();

    await sendWithQueuedChange(fixture, {
      first: errorResponse(403, { code: "schema-limit-reached" }),
      next: summaryResponse(1),
    });

    await waitForState(fixture.pusher, { kind: "synced" });
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
    expect(fixture.scheduler.delays()).toEqual([]);
  });

  it("does not lengthen the backoff for an immediate re-send", async () => {
    const fixture = await setUp();

    await sendWithQueuedChange(fixture, {
      first: serverErrorResponse(),
      next: serverErrorResponse(),
    });

    await waitForState(fixture.pusher, {
      kind: "waiting-retry",
      reason: "server",
    });
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
    expect(fixture.scheduler.delays()).toEqual([2_000]);
  });

  it("drops the queued change when the send ends in a conflict", async () => {
    const fixture = await setUp();

    await sendWithQueuedChange(fixture, {
      first: errorResponse(409, { code: "schema-id-unavailable" }),
      next: jsonResponse({ ...summaryBody(2), document: LATEST_CHANGE }, 200),
    });

    await vi.waitFor(() => {
      expect(fixture.pusher.getState().kind).toBe("conflict");
    });
    expect(fixture.fetchImpl).toHaveBeenCalledTimes(2);
    expect(fixture.scheduler.delays()).toEqual([]);
  });
});
