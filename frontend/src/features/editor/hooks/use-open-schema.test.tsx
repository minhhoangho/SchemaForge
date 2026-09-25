import { createEmptySchema, CURRENT_SCHEMA_VERSION } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import { createSampleSchema } from "@schemaforge/core/testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/lib/api/api-client";
import type { ApiClient } from "@/lib/api/api-client";
import type { SessionRefresher } from "@/lib/api/session-refresher";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import type {
  SchemaRecord,
  SyncStatus,
  ViewportRecord,
} from "@/lib/storage/records";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type {
  OpenSchemaResult,
  SchemaRepository,
} from "@/lib/storage/schema-repository";
import type { OpenAuthContext } from "@/lib/sync/decide-open-action";

import { useOpenSchema } from "./use-open-schema";
import type { OpenSchemaState } from "./use-open-schema";

const BASE_URL = "https://api.schemaforge.invalid";
const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const OTHER_USER_ID = "6a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";
const TIMESTAMP_MS = Date.parse(TIMESTAMP);
const VIEWPORT: ViewportRecord = { schemaId: SCHEMA_ID, x: 10, y: 20, zoom: 1 };
const SAMPLE_DOCUMENT = createSampleSchema();
const CLOUD_DOCUMENT: SchemaDocument = { ...SAMPLE_DOCUMENT, name: "Cloud" };

const SIGNED_OUT: OpenAuthContext = { status: "signed-out" };
const SIGNED_IN: OpenAuthContext = { status: "signed-in", userId: USER_ID };
const EXPIRED: OpenAuthContext = { status: "expired", lastUserId: USER_ID };

const GUEST_RECORD: SchemaRecord = {
  id: SCHEMA_ID,
  name: "Billing",
  createdAt: 1,
  updatedAt: 1,
  ownerId: null,
  cloudRevision: null,
  syncStatus: null,
};

type Deferred<Value> = {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
};

function createDeferred<Value>(): Deferred<Value> {
  let resolve: (value: Value) => void = () => undefined;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

// The API client only reaches the refresher after a 401 "unauthenticated";
// answering 401 here is a refresh token that is no longer valid.
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

type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;

function createApi(fetchImpl: FetchStub): ApiClient {
  return createApiClient({
    baseUrl: BASE_URL,
    fetchImpl,
    sessionRefresher: expiredSessionRefresher,
    onSessionExpired: vi.fn<() => void>(),
  });
}

function rejectFetch(): FetchStub {
  return vi
    .fn<typeof fetch>()
    .mockRejectedValue(new Error("fetch must not be called here."));
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function detailResponse(revision: number, document: unknown): Response {
  return jsonResponse(
    {
      id: SCHEMA_ID,
      name: "Cloud",
      revision,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
      document,
    },
    200,
  );
}

function errorResponse(status: number, code: string): Response {
  return jsonResponse({ statusCode: status, code }, status);
}

type HookProps = {
  readonly grantId: number | null;
  readonly attempt: number;
  readonly auth: OpenAuthContext;
};

function renderOpenSchema(
  repository: SchemaRepository,
  api: ApiClient,
  initialProps: Partial<HookProps> = {},
) {
  return renderHook(
    ({ grantId, attempt, auth }: HookProps) =>
      useOpenSchema({
        repository,
        api,
        auth,
        schemaId: SCHEMA_ID,
        grantId,
        attempt,
      }),
    {
      initialProps: {
        grantId: 1,
        attempt: 0,
        auth: SIGNED_OUT,
        ...initialProps,
      },
    },
  );
}

function createDexieError(name: string): Error {
  const error = new Error("Dexie failed.");
  error.name = name;
  return error;
}

// A repository double for the phase 3 read mechanics (grants, stale reads);
// the cloud rows below run on a real repository over fake-indexeddb.
function createMockRepository(
  overrides: Partial<SchemaRepository> = {},
): SchemaRepository {
  const document = createEmptySchema("Billing");
  return {
    listSchemas: vi.fn<SchemaRepository["listSchemas"]>(),
    createSchema: vi.fn<SchemaRepository["createSchema"]>(),
    openSchema: vi
      .fn<SchemaRepository["openSchema"]>()
      .mockResolvedValue({ kind: "opened", document }),
    saveDocument: vi.fn<SchemaRepository["saveDocument"]>(),
    renameSchema: vi.fn<SchemaRepository["renameSchema"]>(),
    deleteSchema: vi.fn<SchemaRepository["deleteSchema"]>(),
    readViewport: vi
      .fn<SchemaRepository["readViewport"]>()
      .mockResolvedValue(VIEWPORT),
    saveViewport: vi.fn<SchemaRepository["saveViewport"]>(),
    readSchemaRecord: vi
      .fn<SchemaRepository["readSchemaRecord"]>()
      .mockResolvedValue(GUEST_RECORD),
    listOwnedSchemas: vi.fn<SchemaRepository["listOwnedSchemas"]>(),
    writeCloudCopy: vi.fn<SchemaRepository["writeCloudCopy"]>(),
    completePush: vi.fn<SchemaRepository["completePush"]>(),
    setSyncState: vi.fn<SchemaRepository["setSyncState"]>(),
    assignOwner: vi.fn<SchemaRepository["assignOwner"]>(),
    changeSchemaId: vi.fn<SchemaRepository["changeSchemaId"]>(),
    deleteOwnedRowsExcept: vi.fn<SchemaRepository["deleteOwnedRowsExcept"]>(),
    readSession: vi.fn<SchemaRepository["readSession"]>(),
    writeSession: vi.fn<SchemaRepository["writeSession"]>(),
    deleteSession: vi.fn<SchemaRepository["deleteSession"]>(),
    ...overrides,
  };
}

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
});

type CloudFixture = {
  readonly database: SchemaforgeDatabase;
  readonly repository: SchemaRepository;
  readonly fetchImpl: FetchStub;
  readonly api: ApiClient;
};

function setUpCloud(): CloudFixture {
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
  const fetchImpl = vi.fn<typeof fetch>();
  return { database, repository, fetchImpl, api: createApi(fetchImpl) };
}

async function seedGuest(repository: SchemaRepository): Promise<void> {
  await repository.saveDocument(
    (await repository.createSchema(SAMPLE_DOCUMENT.name)).id,
    SAMPLE_DOCUMENT,
  );
}

async function seedPendingCreate(repository: SchemaRepository): Promise<void> {
  await repository.createSchema(SAMPLE_DOCUMENT.name, { ownerId: USER_ID });
}

async function seedCloudCopy(
  repository: SchemaRepository,
  syncStatus: SyncStatus,
  revision: number,
  ownerId: string = USER_ID,
): Promise<void> {
  await repository.writeCloudCopy({
    id: SCHEMA_ID,
    ownerId,
    document: SAMPLE_DOCUMENT,
    revision,
    createdAt: 1,
    updatedAt: 1,
  });
  await repository.setSyncState(SCHEMA_ID, {
    cloudRevision: revision,
    syncStatus,
  });
}

function opened(
  document: SchemaDocument,
  cloud: Extract<OpenSchemaState, { kind: "opened" }>["cloud"],
): OpenSchemaState {
  return { kind: "opened", document, viewport: null, cloud };
}

// What an owned open shows the editor; any other state reads as its kind.
function summarizeOwnedOpen(state: OpenSchemaState): unknown {
  if (state.kind !== "opened" || state.cloud.kind !== "owned") {
    return state.kind;
  }
  return {
    document: state.document,
    followUp: state.cloud.followUp,
    dialogKind: state.cloud.pendingDialog?.kind ?? null,
  };
}

describe("useOpenSchema", () => {
  it("stays in opening while no lock has been granted", async () => {
    const repository = createMockRepository();

    const { result } = renderOpenSchema(repository, createApi(rejectFetch()), {
      grantId: null,
    });
    await act(() => Promise.resolve());

    expect({
      state: result.current,
      readCount: vi.mocked(repository.openSchema).mock.calls.length,
    }).toEqual({ state: { kind: "opening" }, readCount: 0 });
  });

  it("reads the document and the viewport together", async () => {
    const document = createEmptySchema("Billing");
    const repository = createMockRepository({
      openSchema: vi
        .fn<SchemaRepository["openSchema"]>()
        .mockResolvedValue({ kind: "opened", document }),
    });

    const { result } = renderOpenSchema(repository, createApi(rejectFetch()));

    await waitFor(() => {
      expect(result.current).toEqual({
        kind: "opened",
        document,
        viewport: VIEWPORT,
        cloud: { kind: "guest" },
      });
    });
    expect({
      openedIds: vi.mocked(repository.openSchema).mock.calls,
      viewportIds: vi.mocked(repository.readViewport).mock.calls,
    }).toEqual({ openedIds: [[SCHEMA_ID]], viewportIds: [[SCHEMA_ID]] });
  });

  it("re-reads the document when a new grant arrives", async () => {
    const firstDocument = createEmptySchema("Billing");
    const secondDocument = createEmptySchema("Invoices");
    const repository = createMockRepository({
      openSchema: vi
        .fn<SchemaRepository["openSchema"]>()
        .mockResolvedValueOnce({ kind: "opened", document: firstDocument })
        .mockResolvedValueOnce({ kind: "opened", document: secondDocument }),
    });
    const { result, rerender } = renderOpenSchema(
      repository,
      createApi(rejectFetch()),
    );
    await waitFor(() => {
      expect(result.current.kind).toBe("opened");
    });

    rerender({ grantId: null, attempt: 0, auth: SIGNED_OUT });
    const whileWaiting: OpenSchemaState = result.current;
    rerender({ grantId: 2, attempt: 0, auth: SIGNED_OUT });

    await waitFor(() => {
      expect(result.current).toEqual({
        kind: "opened",
        document: secondDocument,
        viewport: VIEWPORT,
        cloud: { kind: "guest" },
      });
    });
    expect(whileWaiting).toEqual({ kind: "opening" });
  });

  // React 19 drops a state update on an unmounted component without a trace,
  // so a late result is made observable by releasing the lock (the effect is
  // cleaned up) and taking the same grant again while the new read is pending.
  it("ignores a result that arrives after its read was cleaned up", async () => {
    const lateRead = createDeferred<OpenSchemaResult>();
    const currentRead = createDeferred<OpenSchemaResult>();
    const repository = createMockRepository({
      openSchema: vi
        .fn<SchemaRepository["openSchema"]>()
        .mockReturnValueOnce(lateRead.promise)
        .mockReturnValueOnce(currentRead.promise),
    });
    const { result, rerender } = renderOpenSchema(
      repository,
      createApi(rejectFetch()),
    );
    rerender({ grantId: null, attempt: 0, auth: SIGNED_OUT });

    await act(async () => {
      lateRead.resolve({ kind: "not-found" });
      await lateRead.promise;
    });
    rerender({ grantId: 1, attempt: 0, auth: SIGNED_OUT });

    expect(result.current).toEqual({ kind: "opening" });
  });

  it("ignores a result for a grant that was replaced", async () => {
    const staleRead = createDeferred<OpenSchemaResult>();
    const freshDocument: SchemaDocument = createEmptySchema("Fresh");
    const repository = createMockRepository({
      openSchema: vi
        .fn<SchemaRepository["openSchema"]>()
        .mockReturnValueOnce(staleRead.promise)
        .mockResolvedValueOnce({ kind: "opened", document: freshDocument }),
    });
    const { result, rerender } = renderOpenSchema(
      repository,
      createApi(rejectFetch()),
    );

    rerender({ grantId: 2, attempt: 0, auth: SIGNED_OUT });
    await waitFor(() => {
      expect(result.current.kind).toBe("opened");
    });
    await act(async () => {
      staleRead.resolve({ kind: "not-found" });
      await staleRead.promise;
    });

    expect(result.current).toEqual({
      kind: "opened",
      document: freshDocument,
      viewport: VIEWPORT,
      cloud: { kind: "guest" },
    });
  });

  it("reports not found for a schema that was never stored", async () => {
    const repository = createMockRepository({
      readSchemaRecord: vi
        .fn<SchemaRepository["readSchemaRecord"]>()
        .mockResolvedValue(null),
      openSchema: vi
        .fn<SchemaRepository["openSchema"]>()
        .mockResolvedValue({ kind: "not-found" }),
    });

    const { result } = renderOpenSchema(repository, createApi(rejectFetch()));

    await waitFor(() => {
      expect(result.current).toEqual({
        kind: "not-found",
        shouldOfferSignIn: true,
      });
    });
  });

  it.each([
    [
      "version-unsupported",
      true,
      [{ code: "version-unsupported", path: ["version"] }],
    ],
    ["invalid-shape", false, [{ code: "invalid-shape", path: ["name"] }]],
  ] as const)(
    "marks an unreadable document with %s",
    async (_code, isVersionUnsupported, errors) => {
      const repository = createMockRepository({
        openSchema: vi
          .fn<SchemaRepository["openSchema"]>()
          .mockResolvedValue({ kind: "unreadable", errors }),
      });

      const { result } = renderOpenSchema(repository, createApi(rejectFetch()));

      await waitFor(() => {
        expect(result.current).toEqual({
          kind: "unreadable",
          isVersionUnsupported,
        });
      });
    },
  );

  it("maps a thrown dexie error to a storage error", async () => {
    const repository = createMockRepository({
      readViewport: vi
        .fn<SchemaRepository["readViewport"]>()
        .mockRejectedValue(createDexieError("DatabaseClosedError")),
    });

    const { result } = renderOpenSchema(repository, createApi(rejectFetch()));

    await waitFor(() => {
      expect(result.current).toEqual({
        kind: "storage-error",
        errorCode: "closed",
      });
    });
  });

  describe("with the cloud", () => {
    it("opens a guest schema without calling fetch", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      await seedGuest(repository);

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toEqual(
          opened(SAMPLE_DOCUMENT, { kind: "guest" }),
        );
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("stores the cloud document and opens it when there is no cache", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      fetchImpl.mockResolvedValueOnce(detailResponse(4, CLOUD_DOCUMENT));

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toEqual(
          opened(CLOUD_DOCUMENT, {
            kind: "owned",
            userId: USER_ID,
            followUp: "none",
            pendingDialog: null,
          }),
        );
      });
      expect({
        record: await repository.readSchemaRecord(SCHEMA_ID),
        document: await repository.openSchema(SCHEMA_ID),
      }).toEqual({
        record: {
          id: SCHEMA_ID,
          name: CLOUD_DOCUMENT.name,
          createdAt: TIMESTAMP_MS,
          updatedAt: TIMESTAMP_MS,
          ownerId: USER_ID,
          cloudRevision: 4,
          syncStatus: "synced",
        },
        document: { kind: "opened", document: CLOUD_DOCUMENT },
      });
    });

    it("shows not-found with a sign-in offer when there is no cache and the user is signed out", async () => {
      const { repository, fetchImpl, api } = setUpCloud();

      const { result } = renderOpenSchema(repository, api);

      await waitFor(() => {
        expect(result.current).toEqual({
          kind: "not-found",
          shouldOfferSignIn: true,
        });
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("shows needs-network when there is no cache and the backend is unreachable", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      fetchImpl.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toEqual({ kind: "needs-network" });
      });
    });

    it("opens a pending schema that was never created without calling fetch", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      await seedPendingCreate(repository);

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          kind: "opened",
          cloud: {
            kind: "owned",
            userId: USER_ID,
            followUp: "push-create",
            pendingDialog: null,
          },
        });
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("replaces a synced cache that has an older revision", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      await seedCloudCopy(repository, "synced", 2);
      fetchImpl.mockResolvedValueOnce(detailResponse(3, CLOUD_DOCUMENT));

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          kind: "opened",
          document: CLOUD_DOCUMENT,
          cloud: { kind: "owned", followUp: "none", pendingDialog: null },
        });
      });
      expect(await repository.readSchemaRecord(SCHEMA_ID)).toMatchObject({
        cloudRevision: 3,
        syncStatus: "synced",
      });
    });

    it("deletes a synced cache that was deleted in the cloud", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      await seedCloudCopy(repository, "synced", 2);
      fetchImpl.mockResolvedValueOnce(errorResponse(404, "not-found"));

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toEqual({ kind: "deleted-elsewhere" });
      });
      expect({
        record: await repository.readSchemaRecord(SCHEMA_ID),
        document: await repository.openSchema(SCHEMA_ID),
      }).toEqual({ record: null, document: { kind: "not-found" } });
    });

    it("marks conflict and reports the conflict dialog for a newer cloud revision", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      await seedCloudCopy(repository, "pending", 2);
      fetchImpl.mockResolvedValueOnce(detailResponse(3, CLOUD_DOCUMENT));

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          kind: "opened",
          document: SAMPLE_DOCUMENT,
          cloud: {
            kind: "owned",
            followUp: "none",
            pendingDialog: {
              kind: "conflict",
              cloud: { id: SCHEMA_ID, revision: 3, document: CLOUD_DOCUMENT },
            },
          },
        });
      });
      expect(await repository.readSchemaRecord(SCHEMA_ID)).toMatchObject({
        cloudRevision: 2,
        syncStatus: "conflict",
      });
    });

    it("marks deleted-in-cloud for a pending schema missing in the cloud", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      await seedCloudCopy(repository, "pending", 2);
      fetchImpl.mockResolvedValueOnce(errorResponse(404, "not-found"));

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          kind: "opened",
          document: SAMPLE_DOCUMENT,
          cloud: {
            kind: "owned",
            followUp: "none",
            pendingDialog: { kind: "deleted-in-cloud" },
          },
        });
      });
      expect(await repository.readSchemaRecord(SCHEMA_ID)).toMatchObject({
        cloudRevision: 2,
        syncStatus: "deleted-in-cloud",
      });
    });

    it("opens the cache when the backend is unreachable", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      await seedCloudCopy(repository, "synced", 2);
      fetchImpl.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          kind: "opened",
          document: SAMPLE_DOCUMENT,
          cloud: { kind: "owned", followUp: "retry-when-online" },
        });
      });
    });

    it("opens the cache and waits for sign-in when the session expired", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      await seedCloudCopy(repository, "synced", 2);
      fetchImpl.mockResolvedValueOnce(errorResponse(401, "unauthenticated"));

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          kind: "opened",
          document: SAMPLE_DOCUMENT,
          cloud: {
            kind: "owned",
            userId: USER_ID,
            followUp: "wait-for-sign-in",
          },
        });
      });
    });

    it("does not overwrite the cache for a cloud document from a newer version", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      await seedCloudCopy(repository, "synced", 2);
      fetchImpl.mockResolvedValueOnce(
        detailResponse(3, {
          ...CLOUD_DOCUMENT,
          version: CURRENT_SCHEMA_VERSION + 1,
        }),
      );

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toEqual({
          kind: "unreadable",
          isVersionUnsupported: true,
        });
      });
      expect({
        record: await repository.readSchemaRecord(SCHEMA_ID),
        document: await repository.openSchema(SCHEMA_ID),
      }).toMatchObject({
        record: { cloudRevision: 2, syncStatus: "synced" },
        document: { kind: "opened", document: SAMPLE_DOCUMENT },
      });
    });

    it("reads again when attempt increases", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      fetchImpl
        .mockRejectedValueOnce(new TypeError("Failed to fetch"))
        .mockResolvedValueOnce(detailResponse(1, CLOUD_DOCUMENT));
      const { result, rerender } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });
      await waitFor(() => {
        expect(result.current).toEqual({ kind: "needs-network" });
      });

      rerender({ grantId: 1, attempt: 1, auth: SIGNED_IN });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          kind: "opened",
          document: CLOUD_DOCUMENT,
        });
      });
    });

    it("does not read before the lock is granted", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      const readSchemaRecord = vi.spyOn(repository, "readSchemaRecord");

      const { result } = renderOpenSchema(repository, api, {
        grantId: null,
        auth: SIGNED_IN,
      });
      await act(() => Promise.resolve());

      expect({
        state: result.current,
        recordReads: readSchemaRecord.mock.calls.length,
        fetchCount: fetchImpl.mock.calls.length,
      }).toEqual({ state: { kind: "opening" }, recordReads: 0, fetchCount: 0 });
    });

    it("reads again when the auth status changes before the schema opens", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      fetchImpl.mockResolvedValueOnce(detailResponse(1, CLOUD_DOCUMENT));
      const { result, rerender } = renderOpenSchema(repository, api);
      await waitFor(() => {
        expect(result.current.kind).toBe("not-found");
      });

      rerender({ grantId: 1, attempt: 0, auth: SIGNED_IN });

      await waitFor(() => {
        expect(result.current).toMatchObject({
          kind: "opened",
          document: CLOUD_DOCUMENT,
        });
      });
    });

    it("keeps an opened schema when the auth status changes", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      await seedCloudCopy(repository, "synced", 2);
      fetchImpl.mockResolvedValueOnce(detailResponse(2, SAMPLE_DOCUMENT));
      const { result, rerender } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });
      await waitFor(() => {
        expect(result.current.kind).toBe("opened");
      });
      const openedState = result.current;

      rerender({ grantId: 1, attempt: 0, auth: EXPIRED });
      await act(() => Promise.resolve());

      expect(result.current).toBe(openedState);
    });

    it.each([
      ["synced", 2, () => detailResponse(2, CLOUD_DOCUMENT), "none", null],
      [
        "pending",
        2,
        () => detailResponse(2, CLOUD_DOCUMENT),
        "push-update",
        null,
      ],
      [
        "conflict",
        3,
        () => detailResponse(3, CLOUD_DOCUMENT),
        "none",
        "conflict",
      ],
      [
        "deleted-in-cloud",
        null,
        () => errorResponse(404, "not-found"),
        "none",
        "deleted-in-cloud",
      ],
    ] as const)(
      "opens a %s cache with the cloud at revision %s",
      async (syncStatus, _revision, answer, followUp, dialogKind) => {
        const { repository, fetchImpl, api } = setUpCloud();
        await seedCloudCopy(repository, syncStatus, 2);
        fetchImpl.mockResolvedValueOnce(answer());

        const { result } = renderOpenSchema(repository, api, {
          auth: SIGNED_IN,
        });

        await waitFor(() => {
          expect(summarizeOwnedOpen(result.current)).toEqual({
            document: SAMPLE_DOCUMENT,
            followUp,
            dialogKind,
          });
        });
      },
    );

    it("shows not-found for a schema cached by another account", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      await seedCloudCopy(repository, "synced", 2, OTHER_USER_ID);

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toEqual({
          kind: "not-found",
          shouldOfferSignIn: false,
        });
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("shows unreadable for a stored document whose record is damaged", async () => {
      const { database, repository, fetchImpl, api } = setUpCloud();
      await seedGuest(repository);
      await database.table<unknown>("schemas").put({ id: SCHEMA_ID, name: 42 });

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toEqual({
          kind: "unreadable",
          isVersionUnsupported: false,
        });
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("writes nothing when the cloud answers after the read was cancelled", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      const writeCloudCopy = vi.spyOn(repository, "writeCloudCopy");
      const getSchema = vi.spyOn(api.schemas, "get");
      const cloudAnswer = createDeferred<Response>();
      fetchImpl.mockReturnValueOnce(cloudAnswer.promise);
      const { rerender } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });
      await waitFor(() => {
        expect(fetchImpl).toHaveBeenCalled();
      });

      rerender({ grantId: 1, attempt: 0, auth: SIGNED_OUT });
      // The cancelled read decides right after its request settles, so
      // waiting for that request covers the moment a write would start.
      await act(async () => {
        cloudAnswer.resolve(detailResponse(1, CLOUD_DOCUMENT));
        await getSchema.mock.results[0]?.value;
      });

      expect(writeCloudCopy).not.toHaveBeenCalled();
    });

    it("shows not-found without a sign-in offer when there is no cache and the cloud has no such schema", async () => {
      const { repository, fetchImpl, api } = setUpCloud();
      fetchImpl.mockResolvedValueOnce(errorResponse(404, "not-found"));

      const { result } = renderOpenSchema(repository, api, {
        auth: SIGNED_IN,
      });

      await waitFor(() => {
        expect(result.current).toEqual({
          kind: "not-found",
          shouldOfferSignIn: false,
        });
      });
      expect({
        record: await repository.readSchemaRecord(SCHEMA_ID),
        document: await repository.openSchema(SCHEMA_ID),
      }).toEqual({ record: null, document: { kind: "not-found" } });
    });
  });
});
