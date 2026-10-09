import type { BatchOperation } from "@schemaforge/core";
import { screen, waitFor } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { useState } from "react";
import type { JSX } from "react";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/components/auth-provider";
import { usePendingImport } from "@/components/pending-import-provider";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { renderWithProviders } from "@/testing/render-with-providers";

import { useCreateImportedSchema } from "./use-create-imported-schema";

const { push } = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn<() => void>() }),
  usePathname: () => "/",
}));

const SCHEMA_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const TIMESTAMP = "2026-09-18T00:00:00.000Z";
const OPERATION: BatchOperation = { type: "batch", operations: [] };

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function Probe(): JSX.Element {
  const createImportedSchema = useCreateImportedSchema();
  const { takePendingImport } = usePendingImport();
  const status = useAuth((state) => state.auth.status);
  const [taken, setTaken] = useState("nothing");
  return (
    <>
      <p>{`auth-${status}`}</p>
      <p>{`taken-${taken}`}</p>
      <button
        type="button"
        onClick={() => {
          void createImportedSchema({
            mode: "new",
            schemaName: "shop",
            operation: OPERATION,
          });
        }}
      >
        import
      </button>
      <button
        type="button"
        onClick={() => {
          setTaken(
            takePendingImport(SCHEMA_ID) === null ? "nothing" : "import",
          );
        }}
      >
        take
      </button>
    </>
  );
}

describe("useCreateImportedSchema", () => {
  const databases = new Set<SchemaforgeDatabase>();

  function createStorage(): StorageBundle {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    return {
      database,
      repository: createSchemaRepository({
        database,
        clock: () => 1,
        generateId: () => SCHEMA_ID,
      }),
      lockManager: createSchemaLockManager(createFakeLockRegistry().request),
    };
  }

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
    push.mockReset();
    toast.dismiss();
    vi.restoreAllMocks();
  });

  it("creates a local schema and navigates when signed out", async () => {
    const storage = createStorage();
    const { user } = renderWithProviders(<Probe />, {
      locale: "en",
      auth: { storage },
    });
    await screen.findByText("auth-signed-out");

    await user.click(screen.getByRole("button", { name: "import" }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/schemas/${SCHEMA_ID}`);
    });
    const entries = await storage.repository.listSchemas();
    expect(entries).toMatchObject([
      { kind: "readable", schema: { id: SCHEMA_ID, name: "shop" } },
    ]);
  });

  it("creates an owned pending schema when signed in", async () => {
    const storage = createStorage();
    const fetchImpl = vi.fn<typeof fetch>(() =>
      jsonResponse({
        user: { id: USER_ID, email: "user@example.com", createdAt: TIMESTAMP },
      }),
    );
    const { user } = renderWithProviders(<Probe />, {
      locale: "en",
      auth: {
        storage,
        hasAuthHint: true,
        dependencies: { fetchImpl, cookieJar: { cookie: "sf-auth-hint=1" } },
      },
    });
    await screen.findByText("auth-signed-in");

    await user.click(screen.getByRole("button", { name: "import" }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });

    const entries = await storage.repository.listSchemas();
    expect(entries).toMatchObject([
      {
        kind: "readable",
        schema: { ownerId: USER_ID, syncStatus: "pending" },
      },
    ]);
  });

  it("stores the pending import before navigating", async () => {
    const storage = createStorage();
    const { user } = renderWithProviders(<Probe />, {
      locale: "en",
      auth: { storage },
    });
    await screen.findByText("auth-signed-out");
    // The entry must exist when the router is called, as the editor reads it
    // on mount.
    push.mockImplementation(() => {
      screen.getByRole("button", { name: "take" }).click();
    });

    await user.click(screen.getByRole("button", { name: "import" }));

    expect(await screen.findByText("taken-import")).toBeDefined();
  });

  it("notifies a storage error and does not navigate", async () => {
    const storage = createStorage();
    vi.spyOn(storage.repository, "createSchema").mockRejectedValue(
      new DOMException("full", "QuotaExceededError"),
    );
    const { user } = renderWithProviders(<Probe />, {
      locale: "en",
      auth: { storage },
    });
    await screen.findByText("auth-signed-out");

    await user.click(screen.getByRole("button", { name: "import" }));

    expect(
      await screen.findByText(
        "Browser storage is full. Delete some schemas and try again.",
      ),
    ).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });
});
