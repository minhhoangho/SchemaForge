import { screen, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { JSX } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

const { push } = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const NEW_NAME = "orders";

type Fixture = {
  readonly storage: StorageBundle;
  readonly registry: FakeLockRegistry;
};

type ActionsProbeProps = {
  readonly storage: StorageBundle;
};

// Renders the hook behind real buttons so the toasts it raises show up in the
// same provider tree the screen uses.
function ActionsProbe({ storage }: ActionsProbeProps): JSX.Element {
  const actions = useSchemaActions(storage);

  return (
    <button
      type="button"
      onClick={() => {
        void actions.renameSchema(SCHEMA_ID, NEW_NAME);
      }}
    >
      rename
    </button>
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

  async function readNames(storage: StorageBundle): Promise<string[]> {
    const entries = await storage.repository.listSchemas();
    return entries.flatMap((entry) =>
      entry.kind === "readable" ? [entry.schema.name] : [],
    );
  }

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
    vi.restoreAllMocks();
  });

  it("does not rename while another tab holds the lock", async () => {
    const { storage, registry } = setUp();
    await storage.repository.createSchema("shop");
    const otherTab = createSchemaLockManager(registry.request);
    await otherTab.tryAcquire(SCHEMA_ID);
    const { user } = renderWithProviders(<ActionsProbe storage={storage} />);

    await user.click(screen.getByRole("button", { name: "rename" }));

    expect(
      await screen.findByText("Schema này đang mở ở một tab khác."),
    ).toBeDefined();
    expect(await readNames(storage)).toEqual(["shop"]);
  });

  it("releases the lock after renaming", async () => {
    const { storage, registry } = setUp();
    await storage.repository.createSchema("shop");
    const { user } = renderWithProviders(<ActionsProbe storage={storage} />);

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
    const { user } = renderWithProviders(<ActionsProbe storage={storage} />);

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
    const { user } = renderWithProviders(<ActionsProbe storage={storage} />);

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
    const { user } = renderWithProviders(<ActionsProbe storage={storage} />);

    await user.click(screen.getByRole("button", { name: "rename" }));

    expect(
      await screen.findByText(
        "Schema này không đọc được nên không đổi tên được.",
      ),
    ).toBeDefined();
  });
});
