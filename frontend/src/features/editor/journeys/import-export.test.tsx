import { serializeSchemaDocument } from "@schemaforge/core";
import { buildSchema, makeColumn, makeTable } from "@schemaforge/core/testing";
import { screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleImportRequest } from "@/lib/import-export/handle-import-request";
import type { ImporterClient } from "@/lib/import-export/importer-client";
import { loadImporter } from "@/lib/import-export/importer-loaders";
import {
  getSchemaIdFromHref,
  queryOutlineRow,
  readDocument,
} from "@/testing/journey-queries";
import {
  createJourneyEnvironment,
  createShopDocument,
  openJourneyEditor,
  setJourneyTestTimeout,
} from "@/testing/mount-editor-journey";
import type { JourneyEnvironment } from "@/testing/mount-editor-journey";
import { mountRoutedEditor } from "@/testing/mount-routed-editor";

setJourneyTestTimeout();

const { push, downloadBlob } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  downloadBlob: vi.fn<(blob: Blob, fileName: string) => void>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh: vi.fn<() => void>(),
  }),
  usePathname: () => "/schemas",
}));

// The browser download is the boundary: the test reads the blob instead.
vi.mock("@/lib/download/download-blob", () => ({ downloadBlob }));

// The worker boundary: the real importers run in the test thread.
vi.mock("@/lib/import-export/importer-client", () => ({
  createImporterClient: (): ImporterClient => {
    let idCount = 0;
    return {
      prepare: () => undefined,
      cancel: () => undefined,
      dispose: () => undefined,
      run: (request) =>
        handleImportRequest(
          { ...request, requestId: 1 },
          {
            loadImporter,
            generateId: () => {
              idCount += 1;
              return `imported-${String(idCount)}`;
            },
          },
        ),
    };
  },
}));

// "users" clashes with the open shop schema, "invoices" does not.
function createImportedJson(): string {
  return serializeSchemaDocument(
    buildSchema({
      name: "billing",
      tables: [
        makeTable({ id: "tbl_users", name: "users" }),
        makeTable({ id: "tbl_invoices", name: "invoices" }),
      ],
      columns: [makeColumn({ id: "col_invoices_id", tableId: "tbl_invoices" })],
    }),
  );
}

async function analyzeMerge(user: UserEvent, source: string): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Import" }));
  const dialog = await screen.findByRole("dialog", { name: "Import a schema" });
  await user.click(
    within(dialog).getByRole("radio", { name: "Add to the current schema" }),
  );
  await user.click(within(dialog).getByRole("tab", { name: "Paste text" }));
  await user.click(within(dialog).getByRole("textbox", { name: "Source" }));
  await user.paste(source);
  await user.click(within(dialog).getByRole("combobox", { name: "Format" }));
  await user.click(await screen.findByRole("option", { name: "JSON" }));
  await user.click(within(dialog).getByRole("button", { name: "Analyze" }));
}

async function readTableNames(
  ...args: Parameters<typeof readDocument>
): Promise<readonly string[]> {
  const document = await readDocument(...args);
  return Object.values(document.tables)
    .map((table) => table.name)
    .toSorted();
}

async function storeShop(environment: JourneyEnvironment): Promise<string> {
  const shop = createShopDocument();
  const schemaId = await environment.createSchema(shop.name);
  await environment.storage.repository.saveDocument(schemaId, shop);
  return schemaId;
}

async function exportJson(user: UserEvent): Promise<File> {
  await user.click(screen.getByRole("button", { name: "Export" }));
  await user.click(await screen.findByRole("menuitem", { name: "JSON" }));
  const [blob, fileName] = downloadBlob.mock.lastCall ?? [];
  if (blob === undefined || fileName === undefined) {
    throw new Error("The editor did not download a json file.");
  }
  return new File([await blob.text()], fileName);
}

async function importAsNewSchema(user: UserEvent, file: File): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Import" }));
  const dialog = await screen.findByRole("dialog", { name: "Import a schema" });
  await user.upload(
    within(dialog).getByLabelText("Choose a file", { selector: "input" }),
    file,
  );
  await user.click(within(dialog).getByRole("button", { name: "Analyze" }));
  await user.click(
    await within(dialog).findByRole("button", { name: "Import" }),
  );
}

afterEach(() => {
  push.mockReset();
  downloadBlob.mockReset();
  // Sonner keeps its toasts in module state, which outlives each render.
  toast.dismiss();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("import and export journeys", () => {
  it("merges an import into the open schema, renames clashing names and undoes in one step", async () => {
    const { environment, schemaId, user } =
      await openJourneyEditor(createShopDocument());

    await analyzeMerge(user, createImportedJson());
    const dialog = screen.getByRole("dialog");
    await user.click(
      await within(dialog).findByRole("button", { name: "Import" }),
    );

    await waitFor(async () => {
      expect(await readTableNames(environment, schemaId)).toEqual([
        "invoices",
        "orders",
        "users",
        "users_2",
      ]);
    });
    expect(queryOutlineRow("users_2")).not.toBeNull();

    // The toast's undo reverts the whole import as one history entry.
    const toastRegion = screen.getByRole("region", { name: /Notifications/ });
    await user.click(
      await within(toastRegion).findByRole("button", { name: "Undo" }),
    );

    await waitFor(async () => {
      expect(await readTableNames(environment, schemaId)).toEqual([
        "orders",
        "users",
      ]);
    });
    expect(queryOutlineRow("invoices")).toBeNull();
  });

  it("leaves the open schema unchanged when the json file is invalid", async () => {
    const { environment, schemaId, user } =
      await openJourneyEditor(createShopDocument());

    await analyzeMerge(user, "{");
    const dialog = screen.getByRole("dialog");
    await within(dialog).findByRole("button", { name: "Back" });
    expect(within(dialog).queryByRole("button", { name: "Import" })).toBeNull();
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(
      screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(await readTableNames(environment, schemaId)).toEqual([
      "orders",
      "users",
    ]);
  });

  it("exports json from the editor and imports it as a new identical schema", async () => {
    const environment = createJourneyEnvironment();
    const user = await mountRoutedEditor(
      environment,
      await storeShop(environment),
      push,
    );
    const exported = await exportJson(user);

    await importAsNewSchema(user, exported);

    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });
    const newSchemaId = getSchemaIdFromHref(push.mock.lastCall?.[0]);
    await waitFor(async () => {
      expect(
        serializeSchemaDocument(await readDocument(environment, newSchemaId)),
      ).toBe(await exported.text());
    });
  });

  it("applies a new-mode import from the editor once under StrictMode", async () => {
    const environment = createJourneyEnvironment();
    const user = await mountRoutedEditor(
      environment,
      await storeShop(environment),
      push,
    );
    const exported = await exportJson(user);

    await importAsNewSchema(user, exported);

    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });
    const newSchemaId = getSchemaIdFromHref(push.mock.lastCall?.[0]);
    await waitFor(async () => {
      expect(
        Object.keys((await readDocument(environment, newSchemaId)).tables),
      ).toHaveLength(2);
    });
    expect(queryOutlineRow("users")).not.toBeNull();
    // A second StrictMode pass would find the operation already applied.
    expect(screen.queryByText("The action was not applied")).toBeNull();
    // One history entry: a single undo empties the schema and ends the history.
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(async () => {
      expect(
        Object.keys((await readDocument(environment, newSchemaId)).tables),
      ).toHaveLength(0);
    });
    expect(
      screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
