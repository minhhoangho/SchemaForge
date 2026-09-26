import { createSampleSchema } from "@schemaforge/core/testing";
import { screen, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/components/auth-provider";
import { logger } from "@/lib/logger";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import {
  createSchemaLockManager,
  getSchemaLockName,
} from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import type { FakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { useSchemaActions } from "./use-schema-actions";
import type { SchemaActionTarget } from "./use-schema-actions";

const { push } = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn<() => void>() }),
  usePathname: () => "/",
}));

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const NEW_NAME = "orders";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const EMAIL = "user@example.com";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";
const CLOUD_UPDATED_AT = Date.parse(TIMESTAMP);

type Handler = () => Promise<Response>;
type Handlers = Readonly<Record<string, Handler>>;
type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;

type Fixture = {
  readonly storage: StorageBundle;
  readonly registry: FakeLockRegistry;
};

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function emptyResponse(status: number): Promise<Response> {
  return Promise.resolve(new Response(null, { status }));
}

function errorResponse(status: number, code: string): Promise<Response> {
  return jsonResponse({ statusCode: status, code }, status);
}

function summary(revision: number): Readonly<Record<string, string | number>> {
  return {
    id: SCHEMA_ID,
    name: "shop",
    revision,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function requestKey(input: RequestInfo | URL, init?: RequestInit): string {
  if (!(input instanceof URL)) {
    throw new Error("Expected the API client to call fetch with a URL.");
  }
  return `${init?.method ?? "GET"} ${input.pathname}`;
}

const SIGNED_IN: Handlers = {
  "GET /auth/me": () =>
    jsonResponse({ user: { id: USER_ID, email: EMAIL, createdAt: TIMESTAMP } }),
};

function createFetch(handlers: Handlers): FetchStub {
  return vi.fn<typeof fetch>((input, init) => {
    const handler = handlers[requestKey(input, init)];
    return handler === undefined ? errorResponse(404, "not-found") : handler();
  });
}

function sentRequests(fetchImpl: FetchStub): readonly string[] {
  return fetchImpl.mock.calls.map(([input, init]) => requestKey(input, init));
}

type ActionsProbeProps = {
  readonly storage: StorageBundle;
  readonly target: SchemaActionTarget;
  readonly reload: () => void;
};

// Renders the hook behind real buttons so the toasts it raises and the
// sign-in prompt show up in the same provider tree the screen uses.
function ActionsProbe({
  storage,
  target,
  reload,
}: ActionsProbeProps): JSX.Element {
  const actions = useSchemaActions(storage, { reload });
  const status = useAuth((state) => state.auth.status);

  return (
    <>
      <p>{status}</p>
      <button
        type="button"
        onClick={() => {
          void actions.createSchema("shop");
        }}
      >
        create
      </button>
      <button
        type="button"
        onClick={() => {
          void actions.renameSchema(target, NEW_NAME);
        }}
      >
        rename
      </button>
      <button
        type="button"
        onClick={() => {
          void actions.deleteSchema(target);
        }}
      >
        delete
      </button>
      <button
        type="button"
        onClick={() => {
          void actions.uploadToCloud(target);
        }}
      >
        upload
      </button>
    </>
  );
}

describe("useSchemaActions", () => {
  const databases = new Set<SchemaforgeDatabase>();

  function setUp(repositoryOverrides: Partial<SchemaRepository> = {}): Fixture {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    const registry = createFakeLockRegistry();
    const repository = createSchemaRepository({
      database,
      clock: () => 1,
      generateId: () => SCHEMA_ID,
    });
    return {
      registry,
      storage: {
        database,
        repository: { ...repository, ...repositoryOverrides },
        lockManager: createSchemaLockManager(registry.request),
      },
    };
  }

  async function renderProbe(input: {
    readonly storage: StorageBundle;
    readonly source?: SchemaActionTarget["source"];
    readonly fetchImpl?: FetchStub | null;
    readonly reload?: () => void;
  }): Promise<ReturnType<typeof renderWithProviders>> {
    const fetchImpl = input.fetchImpl ?? null;
    const result = renderWithProviders(
      <ActionsProbe
        storage={input.storage}
        target={{
          id: SCHEMA_ID,
          name: "shop",
          source: input.source ?? "guest",
        }}
        reload={input.reload ?? vi.fn<() => void>()}
      />,
      {
        auth: {
          storage: input.storage,
          hasAuthHint: fetchImpl !== null,
          dependencies: {
            fetchImpl: fetchImpl ?? vi.fn<typeof fetch>(),
            cookieJar: { cookie: fetchImpl === null ? "" : "sf-auth-hint=1" },
          },
        },
      },
    );
    await screen.findByText(fetchImpl === null ? "signed-out" : "signed-in");
    return result;
  }

  async function readNames(storage: StorageBundle): Promise<string[]> {
    const entries = await storage.repository.listSchemas();
    return entries.flatMap((entry) =>
      entry.kind === "readable" ? [entry.schema.name] : [],
    );
  }

  async function createCachedSchema(storage: StorageBundle): Promise<void> {
    await storage.repository.createSchema("shop", { ownerId: USER_ID });
    await storage.repository.setSyncState(SCHEMA_ID, {
      cloudRevision: 1,
      syncStatus: "synced",
    });
  }

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
    push.mockClear();
    toast.dismiss();
    vi.restoreAllMocks();
  });

  describe("guest schemas", () => {
    it("does not rename while another tab holds the lock", async () => {
      const { storage, registry } = setUp();
      await storage.repository.createSchema("shop");
      const otherTab = createSchemaLockManager(registry.request);
      await otherTab.tryAcquire(SCHEMA_ID);
      const { user } = await renderProbe({ storage });

      await user.click(screen.getByRole("button", { name: "rename" }));

      expect(
        await screen.findByText("Schema này đang mở ở một tab khác."),
      ).toBeDefined();
      expect(await readNames(storage)).toEqual(["shop"]);
    });

    it("releases the lock after renaming", async () => {
      const { storage, registry } = setUp();
      await storage.repository.createSchema("shop");
      const { user } = await renderProbe({ storage });

      await user.click(screen.getByRole("button", { name: "rename" }));

      await waitFor(async () => {
        expect(await readNames(storage)).toEqual([NEW_NAME]);
        expect(registry.isHeld(getSchemaLockName(SCHEMA_ID))).toBe(false);
      });
    });

    it("maps a storage error to a translated toast", async () => {
      vi.spyOn(logger, "error").mockImplementation(() => undefined);
      const quotaError = new Error("The quota was exceeded.");
      quotaError.name = "QuotaExceededError";
      const { storage } = setUp({
        renameSchema: vi
          .fn<SchemaRepository["renameSchema"]>()
          .mockRejectedValue(quotaError),
      });
      const { user } = await renderProbe({ storage });

      await user.click(screen.getByRole("button", { name: "rename" }));

      expect(
        await screen.findByText(
          "Bộ nhớ trình duyệt đã đầy. Hãy xóa bớt schema rồi thử lại.",
        ),
      ).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith("schema-list.action-failed", {
        errorName: "QuotaExceededError",
      });
    });

    it("releases the lock when the repository throws", async () => {
      vi.spyOn(logger, "error").mockImplementation(() => undefined);
      const { storage, registry } = setUp({
        renameSchema: vi
          .fn<SchemaRepository["renameSchema"]>()
          .mockRejectedValue(new Error("The write failed.")),
      });
      const { user } = await renderProbe({ storage });

      await user.click(screen.getByRole("button", { name: "rename" }));

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalled();
      });
      expect(registry.isHeld(getSchemaLockName(SCHEMA_ID))).toBe(false);
    });

    it("explains that an unreadable schema cannot be renamed", async () => {
      const { storage } = setUp({
        renameSchema: vi
          .fn<SchemaRepository["renameSchema"]>()
          .mockResolvedValue({ kind: "unreadable" }),
      });
      const { user } = await renderProbe({ storage });

      await user.click(screen.getByRole("button", { name: "rename" }));

      expect(
        await screen.findByText(
          "Schema này không đọc được nên không đổi tên được.",
        ),
      ).toBeDefined();
    });

    it("deletes a guest schema without calling the api", async () => {
      const { storage } = setUp();
      await storage.repository.createSchema("shop");
      const fetchImpl = createFetch(SIGNED_IN);
      const { user } = await renderProbe({ storage, fetchImpl });

      await user.click(screen.getByRole("button", { name: "delete" }));

      await waitFor(async () => {
        expect(await readNames(storage)).toEqual([]);
      });
      expect(sentRequests(fetchImpl)).toEqual(["GET /auth/me"]);
    });
  });

  describe("create", () => {
    it("creates an owned pending schema while signed in", async () => {
      const { storage } = setUp();
      const reload = vi.fn<() => void>();
      const { user } = await renderProbe({
        storage,
        fetchImpl: createFetch(SIGNED_IN),
        reload,
      });

      await user.click(screen.getByRole("button", { name: "create" }));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith(`/schemas/${SCHEMA_ID}`);
      });
      expect(await storage.repository.readSchemaRecord(SCHEMA_ID)).toEqual(
        expect.objectContaining({
          ownerId: USER_ID,
          cloudRevision: null,
          syncStatus: "pending",
        }),
      );
      expect(reload).toHaveBeenCalled();
    });

    it("creates a guest schema while signed out", async () => {
      const { storage } = setUp();
      const { user } = await renderProbe({ storage });

      await user.click(screen.getByRole("button", { name: "create" }));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith(`/schemas/${SCHEMA_ID}`);
      });
      expect(await storage.repository.readSchemaRecord(SCHEMA_ID)).toEqual(
        expect.objectContaining({ ownerId: null, syncStatus: null }),
      );
    });

    it("creates an owned schema while offline", async () => {
      const { storage } = setUp();
      const fetchImpl = createFetch(SIGNED_IN);
      const { user } = await renderProbe({ storage, fetchImpl });
      fetchImpl.mockRejectedValue(new TypeError("Failed to fetch"));

      await user.click(screen.getByRole("button", { name: "create" }));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith(`/schemas/${SCHEMA_ID}`);
      });
      expect(await storage.repository.readSchemaRecord(SCHEMA_ID)).toEqual(
        expect.objectContaining({ ownerId: USER_ID, syncStatus: "pending" }),
      );
    });
  });

  describe("rename", () => {
    it("renames a cached schema and runs the background sync", async () => {
      const { storage } = setUp();
      await createCachedSchema(storage);
      const fetchImpl = createFetch({
        ...SIGNED_IN,
        [`PUT /schemas/${SCHEMA_ID}`]: () => jsonResponse(summary(2)),
      });
      const reload = vi.fn<() => void>();
      const { user } = await renderProbe({
        storage,
        source: "cached",
        fetchImpl,
        reload,
      });

      await user.click(screen.getByRole("button", { name: "rename" }));

      await waitFor(() => {
        expect(reload).toHaveBeenCalled();
      });
      expect(sentRequests(fetchImpl)).toContain(`PUT /schemas/${SCHEMA_ID}`);
      expect(await readNames(storage)).toEqual([NEW_NAME]);
    });

    it("downloads a cloud-only schema before renaming it", async () => {
      const { storage } = setUp();
      const fetchImpl = createFetch({
        ...SIGNED_IN,
        [`GET /schemas/${SCHEMA_ID}`]: () =>
          jsonResponse({ ...summary(3), document: createSampleSchema() }),
      });
      const { user } = await renderProbe({
        storage,
        source: "cloud-only",
        fetchImpl,
      });

      await user.click(screen.getByRole("button", { name: "rename" }));

      await waitFor(async () => {
        expect(await readNames(storage)).toEqual([NEW_NAME]);
      });
      expect(await storage.repository.readSchemaRecord(SCHEMA_ID)).toEqual(
        expect.objectContaining({
          ownerId: USER_ID,
          cloudRevision: 3,
          createdAt: CLOUD_UPDATED_AT,
        }),
      );
    });

    it("does not write the cache when downloading a cloud-only schema fails", async () => {
      const { storage } = setUp();
      const fetchImpl = createFetch({
        ...SIGNED_IN,
        [`GET /schemas/${SCHEMA_ID}`]: () =>
          errorResponse(500, "internal-error"),
      });
      const { user } = await renderProbe({
        storage,
        source: "cloud-only",
        fetchImpl,
      });

      await user.click(screen.getByRole("button", { name: "rename" }));

      expect(
        await screen.findByText("Có lỗi xảy ra ở máy chủ. Hãy thử lại sau."),
      ).toBeDefined();
      expect(await storage.repository.listSchemas()).toEqual([]);
    });
  });

  describe("delete a cloud schema", () => {
    it("deletes a cloud schema from the cloud and the cache on 204", async () => {
      const { storage } = setUp();
      await createCachedSchema(storage);
      const fetchImpl = createFetch({
        ...SIGNED_IN,
        [`DELETE /schemas/${SCHEMA_ID}`]: () => emptyResponse(204),
      });
      const reload = vi.fn<() => void>();
      const { user } = await renderProbe({
        storage,
        source: "cached",
        fetchImpl,
        reload,
      });

      await user.click(screen.getByRole("button", { name: "delete" }));

      await waitFor(() => {
        expect(reload).toHaveBeenCalled();
      });
      expect(sentRequests(fetchImpl)).toContain(`DELETE /schemas/${SCHEMA_ID}`);
      expect(await storage.repository.listSchemas()).toEqual([]);
    });

    it("deletes the cache when the cloud answers 404", async () => {
      const { storage } = setUp();
      await createCachedSchema(storage);
      const { user } = await renderProbe({
        storage,
        source: "cached",
        fetchImpl: createFetch(SIGNED_IN),
      });

      await user.click(screen.getByRole("button", { name: "delete" }));

      await waitFor(async () => {
        expect(await storage.repository.listSchemas()).toEqual([]);
      });
    });

    it("keeps the cache and shows a network toast when the delete request fails", async () => {
      const { storage } = setUp();
      await createCachedSchema(storage);
      const fetchImpl = createFetch({
        ...SIGNED_IN,
        [`DELETE /schemas/${SCHEMA_ID}`]: () =>
          Promise.reject(new TypeError("Failed to fetch")),
      });
      const { user } = await renderProbe({
        storage,
        source: "cached",
        fetchImpl,
      });

      await user.click(screen.getByRole("button", { name: "delete" }));

      expect(
        await screen.findByText("Cần kết nối mạng để xóa schema trên cloud"),
      ).toBeDefined();
      expect(await readNames(storage)).toEqual(["shop"]);
    });

    it("does not call the api when the schema is open in another tab", async () => {
      const { storage, registry } = setUp();
      await createCachedSchema(storage);
      await createSchemaLockManager(registry.request).tryAcquire(SCHEMA_ID);
      const fetchImpl = createFetch(SIGNED_IN);
      const { user } = await renderProbe({
        storage,
        source: "cloud-only",
        fetchImpl,
      });

      await user.click(screen.getByRole("button", { name: "delete" }));

      expect(
        await screen.findByText("Schema này đang mở ở một tab khác."),
      ).toBeDefined();
      expect(sentRequests(fetchImpl)).toEqual(["GET /auth/me"]);
    });
  });

  describe("upload to cloud", () => {
    it("opens the sign-in prompt instead of uploading while signed out", async () => {
      const { storage } = setUp();
      await storage.repository.createSchema("shop");
      const { user } = await renderProbe({ storage });

      await user.click(screen.getByRole("button", { name: "upload" }));

      expect(await screen.findByRole("dialog")).toBeDefined();
      expect(await storage.repository.readSchemaRecord(SCHEMA_ID)).toEqual(
        expect.objectContaining({ ownerId: null }),
      );
    });

    it("uploads a guest schema and reloads the cloud list", async () => {
      const { storage } = setUp();
      await storage.repository.createSchema("shop");
      const fetchImpl = createFetch({
        ...SIGNED_IN,
        "POST /schemas": () => jsonResponse(summary(1), 201),
      });
      const reload = vi.fn<() => void>();
      const { user } = await renderProbe({ storage, fetchImpl, reload });

      await user.click(screen.getByRole("button", { name: "upload" }));

      await waitFor(() => {
        expect(reload).toHaveBeenCalled();
      });
      expect(await storage.repository.readSchemaRecord(SCHEMA_ID)).toEqual(
        expect.objectContaining({ ownerId: USER_ID, syncStatus: "synced" }),
      );
      expect(
        await screen.findByText("Đã lưu 1 schema lên cloud", { exact: false }),
      ).toBeDefined();
    });
  });
});
