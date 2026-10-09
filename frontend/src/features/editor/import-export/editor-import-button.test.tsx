import type { Node } from "@xyflow/react";
import type { Operation, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { act, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import type { SchemaRepository } from "@/lib/storage/schema-repository";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import {
  createFakeImporterClient,
  successOutcome,
} from "@/testing/fake-importer-client";
import type { FakeImporterClient } from "@/testing/fake-importer-client";
import { renderWithProviders } from "@/testing/render-with-providers";

import { CanvasNodeControlsProvider } from "../lib/viewport-controls";
import type { CanvasNodeControls } from "../lib/viewport-controls";
import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import { EditorImportButton } from "./editor-import-button";

const PREVIEWING_MESSAGE =
  "An AI suggestion is being previewed. Apply or discard it before importing.";
const NEW_SCHEMA_ID = "00000000-0000-4000-8000-000000000001";

const { push } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn<() => void>() }),
  usePathname: () => "/schemas/0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
}));

// The worker is the boundary: every dialog gets the client of the test.
const clients: FakeImporterClient[] = [];
vi.mock("@/lib/import-export/importer-client", () => ({
  createImporterClient: (): FakeImporterClient => {
    const client = createFakeImporterClient();
    clients.push(client);
    return client;
  },
}));

const ADD_EMAIL: Operation = {
  type: "addColumn",
  column: makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
  insertAt: 1,
};

const MEASURED_NODES: readonly Node[] = [
  {
    id: "tbl_users",
    position: { x: 10, y: 50 },
    data: {},
    measured: { width: 200, height: 90 },
  },
  {
    id: "tbl_orders",
    position: { x: 300, y: 20 },
    data: {},
    measured: { width: 240, height: 60 },
  },
];

function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({ id: "tbl_users", name: "users" }),
      makeTable({ id: "tbl_orders", name: "orders" }),
    ],
    columns: [makeColumn({ id: "col_users_id", tableId: "tbl_users" })],
  });
}

const databases: SchemaforgeDatabase[] = [];

function renderButton(themePreference: "light" | "dark" = "light"): ReturnType<
  typeof renderWithProviders
> & {
  readonly store: EditorStore;
  readonly repository: SchemaRepository;
} {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.push(database);
  const repository = createSchemaRepository({
    database,
    clock: () => 1,
    generateId: () => NEW_SCHEMA_ID,
  });
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createDocument(),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const controls: CanvasNodeControls = {
    getMeasuredNodes: () => MEASURED_NODES,
    fitNodes: vi.fn<CanvasNodeControls["fitNodes"]>(),
  };
  const view = renderWithProviders(
    <EditorStoreProvider store={store}>
      <CanvasNodeControlsProvider controls={controls}>
        <EditorImportButton />
      </CanvasNodeControlsProvider>
    </EditorStoreProvider>,
    {
      locale: "en",
      themePreference,
      auth: {
        storage: {
          database,
          repository,
          lockManager: createSchemaLockManager(
            createFakeLockRegistry().request,
          ),
        },
      },
    },
  );
  return { ...view, store, repository };
}

function importButton(): HTMLElement {
  return screen.getByRole("button", { name: "Import" });
}

async function analyzePastedJson(
  user: ReturnType<typeof renderButton>["user"],
): Promise<void> {
  await user.click(screen.getByRole("tab", { name: "Paste text" }));
  await user.click(screen.getByRole("textbox", { name: "Source" }));
  await user.paste("{}");
  await user.click(screen.getByRole("combobox", { name: "Format" }));
  await user.click(await screen.findByRole("option", { name: "JSON" }));
  await user.click(screen.getByRole("button", { name: "Analyze" }));
}

afterEach(() => {
  // Sonner keeps its toasts in module state, which outlives each render.
  toast.dismiss();
  clients.length = 0;
  push.mockReset();
  databases.forEach((database) => {
    database.close();
  });
  databases.length = 0;
});

describe("EditorImportButton", () => {
  it("opens the dialog with both modes and a merge origin", async () => {
    const { user, store } = renderButton();

    await user.click(importButton());
    await screen.findByRole("dialog", { name: "Import a schema" });
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    await user.click(
      screen.getByRole("radio", { name: "Add to the current schema" }),
    );
    await analyzePastedJson(user);

    // Right of the rightmost node (300 + 240) plus the 80px gap, at the top edge.
    await waitFor(() => {
      expect(clients.at(-1)?.requests[0]).toMatchObject({
        mode: { mode: "merge", origin: { x: 620, y: 20 } },
        target: store.getState().document,
      });
    });
  });

  it("returns focus to the import button when the dialog closes", async () => {
    const { user } = renderButton();

    await user.click(importButton());
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(importButton());
  });

  it("creates a new schema and opens it when the new mode is confirmed", async () => {
    const { user, repository } = renderButton();
    await user.click(importButton());
    const dialog = await screen.findByRole("dialog");
    await analyzePastedJson(user);
    act(() => {
      clients.at(-1)?.settle(successOutcome());
    });

    await user.click(
      await within(dialog).findByRole("button", { name: "Import" }),
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/schemas/${NEW_SCHEMA_ID}`);
    });
    expect(await repository.listSchemas()).toMatchObject([
      { kind: "readable", schema: { id: NEW_SCHEMA_ID, name: "Shop" } },
    ]);
  });

  it("disables import during an AI proposal preview", async () => {
    const { user, store } = renderButton();
    await user.click(importButton());
    await screen.findByRole("dialog");

    act(() => {
      store.getState().startProposalPreview("message-1", ADD_EMAIL);
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(importButton().getAttribute("aria-disabled")).toBe("true");
    expect(clients.at(-1)?.dispose).toHaveBeenCalled();
  });

  // The button stays focusable while disabled, so closing the dialog does not
  // drop focus to the page body.
  it("keeps focus on the import button when an AI preview closes the dialog", async () => {
    const { user, store } = renderButton();
    await user.click(importButton());
    await screen.findByRole("dialog");

    act(() => {
      store.getState().startProposalPreview("message-1", ADD_EMAIL);
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(importButton());
  });

  it("explains instead of opening the dialog on click during an AI proposal preview", async () => {
    const { user, store } = renderButton();
    act(() => {
      store.getState().startProposalPreview("message-1", ADD_EMAIL);
    });

    await user.click(importButton());

    expect(await screen.findByText(PREVIEWING_MESSAGE)).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explains instead of opening the dialog on Enter during an AI proposal preview", async () => {
    const { user, store } = renderButton();
    act(() => {
      store.getState().startProposalPreview("message-1", ADD_EMAIL);
    });

    importButton().focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByText(PREVIEWING_MESSAGE)).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it.each(["light", "dark"] as const)(
    "has no axe violations with the dialog open in the %s theme",
    async (themePreference) => {
      const { user } = renderButton(themePreference);
      await user.click(importButton());
      await screen.findByRole("dialog");

      await expectNoAxeViolations(document.body);
    },
  );
});
