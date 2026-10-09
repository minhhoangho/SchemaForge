import { createCounterIdGenerator } from "@schemaforge/core/testing";
import { act, screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { Dexie } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { useEffect, useState } from "react";
import type { JSX } from "react";
import { toast } from "sonner";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { EditorScreen } from "@/features/editor/components/editor-screen";
import { SchemaListScreen } from "@/features/schema-list/components/schema-list-screen";
import { handleImportRequest } from "@/lib/import-export/handle-import-request";
import { isImportRequest } from "@/lib/import-export/import-protocol";
import { loadImporter } from "@/lib/import-export/importer-loaders";
import {
  getSchemaIdFromHref,
  getOutlineRow,
  queryOutlineRow,
  readDocument,
} from "@/testing/journey-queries";
import {
  createJourneyEnvironment,
  setJourneyTestTimeout,
} from "@/testing/mount-editor-journey";
import type { JourneyEnvironment } from "@/testing/mount-editor-journey";
import { renderWithProviders } from "@/testing/render-with-providers";

setJourneyTestTimeout();

const NAVIGATE_EVENT = "test-navigate";
const DBML_SOURCE = [
  "Table users {",
  "  id int [pk]",
  "}",
  "Table orders {",
  "  id int [pk]",
  "  user_id int",
  "}",
].join("\n");

const { push } = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: vi.fn<(href: string) => void>(),
    refresh: vi.fn<() => void>(),
  }),
  usePathname: () => "/",
}));

// The worker is the boundary: this one runs the real importer in-process.
class InlineImportWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  readonly #generateId = createCounterIdGenerator();

  postMessage(request: unknown): void {
    if (!isImportRequest(request)) return;
    void handleImportRequest(request, {
      loadImporter,
      generateId: this.#generateId,
    }).then((response) => {
      this.onmessage?.(new MessageEvent("message", { data: response }));
    });
  }

  terminate(): void {
    // Nothing runs in the background.
  }
}

// AppProviders keeps the pending import across the route change; the harness
// swaps screens inside one provider tree the same way.
function RouteHarness(): JSX.Element {
  const [schemaId, setSchemaId] = useState<string | null>(null);
  useEffect(() => {
    const onNavigate = (event: Event): void => {
      if (event instanceof CustomEvent && typeof event.detail === "string") {
        setSchemaId(getSchemaIdFromHref(event.detail));
      }
    };
    window.addEventListener(NAVIGATE_EVENT, onNavigate);
    return () => {
      window.removeEventListener(NAVIGATE_EVENT, onNavigate);
    };
  }, []);
  return schemaId === null ? (
    <SchemaListScreen />
  ) : (
    <EditorScreen
      schemaId={schemaId}
      onOpeningChange={() => {
        // The loader's live region is not rendered here.
      }}
    />
  );
}

function mountList(environment: JourneyEnvironment): {
  readonly user: UserEvent;
  readonly unmount: () => void;
} {
  push.mockImplementation((href) => {
    act(() => {
      window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: href }));
    });
  });
  return renderWithProviders(<RouteHarness />, {
    locale: "en",
    auth: { storage: environment.storage },
  });
}

async function pasteAndAnalyze(
  user: UserEvent,
  text: string,
  format: "DBML" | "JSON",
): Promise<void> {
  await user.click(await screen.findByRole("button", { name: "Import" }));
  const dialog = await screen.findByRole("dialog", { name: "Import a schema" });
  await user.click(within(dialog).getByRole("tab", { name: "Paste text" }));
  await user.click(within(dialog).getByRole("textbox", { name: "Source" }));
  await user.paste(text);
  await user.click(within(dialog).getByRole("combobox", { name: "Format" }));
  await user.click(await screen.findByRole("option", { name: format }));
  await user.click(within(dialog).getByRole("button", { name: "Analyze" }));
}

beforeAll(() => {
  Dexie.dependencies.indexedDB = new IDBFactory();
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
});

afterEach(() => {
  toast.dismiss();
  push.mockReset();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("import journey", () => {
  it("imports dbml from the schema list into a new schema with one undo step back to an empty schema", async () => {
    const environment = createJourneyEnvironment();
    vi.stubGlobal("Worker", InlineImportWorker);
    const { user, unmount } = mountList(environment);
    await pasteAndAnalyze(user, DBML_SOURCE, "DBML");
    const dialog = await screen.findByRole("dialog", {
      name: "Import a schema",
    });

    await user.click(
      await within(dialog).findByRole("button", { name: "Import" }),
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledOnce();
    });
    const schemaId = getSchemaIdFromHref(push.mock.lastCall?.[0]);
    const importedName = (await readDocument(environment, schemaId)).name;
    expect(importedName).not.toBe("");
    const importedButtonText = (
      await screen.findByRole("button", { name: /^Schema name / })
    ).textContent;
    expect(importedButtonText).toContain(importedName);
    expect([getOutlineRow("users"), getOutlineRow("orders")]).toHaveLength(2);
    await waitFor(async () => {
      expect(
        Object.keys((await readDocument(environment, schemaId)).tables),
      ).toHaveLength(2);
    });

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(queryOutlineRow("users")).toBeNull();
    await waitFor(async () => {
      expect(
        Object.keys((await readDocument(environment, schemaId)).tables),
      ).toHaveLength(0);
    });
    unmount();
    const remounted = environment.mountEditor(schemaId);
    await screen.findByRole("button", { name: /^Schema name / });
    expect(queryOutlineRow("users")).toBeNull();
    expect(
      screen.getByRole("button", { name: /^Schema name / }).textContent,
    ).toBe(importedButtonText);
    expect((await readDocument(environment, schemaId)).name).toBe(importedName);
    remounted.unmount();
  });

  it("keeps the list unchanged for an unreadable json file", async () => {
    const environment = createJourneyEnvironment();
    vi.stubGlobal("Worker", InlineImportWorker);
    const { user } = mountList(environment);

    await pasteAndAnalyze(user, '{"tables": [', "JSON");

    const dialog = await screen.findByRole("dialog", {
      name: "Import a schema",
    });
    expect(
      await within(dialog).findByRole("button", { name: "Back" }),
    ).toBeDefined();
    expect(within(dialog).queryByRole("button", { name: "Import" })).toBeNull();
    expect(push).not.toHaveBeenCalled();
    await expect(environment.storage.repository.listSchemas()).resolves.toEqual(
      [],
    );
  });

  it("returns focus to the import button after a successful import", async () => {
    const environment = createJourneyEnvironment();
    vi.stubGlobal("Worker", InlineImportWorker);
    const { user } = mountList(environment);
    // The route stays on the list, as it does while the editor is loading.
    push.mockImplementation(() => undefined);
    await pasteAndAnalyze(user, DBML_SOURCE, "DBML");
    const dialog = await screen.findByRole("dialog", {
      name: "Import a schema",
    });

    await user.click(
      await within(dialog).findByRole("button", { name: "Import" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(push).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Import" }),
    );
  });

  it("returns focus to the import button and notifies when the schema cannot be created", async () => {
    const environment = createJourneyEnvironment();
    vi.stubGlobal("Worker", InlineImportWorker);
    vi.spyOn(environment.storage.repository, "createSchema").mockRejectedValue(
      new DOMException("full", "QuotaExceededError"),
    );
    const { user } = mountList(environment);
    await pasteAndAnalyze(user, DBML_SOURCE, "DBML");
    const dialog = await screen.findByRole("dialog", {
      name: "Import a schema",
    });

    await user.click(
      await within(dialog).findByRole("button", { name: "Import" }),
    );

    expect(
      await screen.findByText(
        "Browser storage is full. Delete some schemas and try again.",
      ),
    ).toBeDefined();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(push).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Import" }),
    );
  });
});
