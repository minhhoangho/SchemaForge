import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { act, screen, within } from "@testing-library/react";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import type { RenderResult } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Locale } from "@/lib/i18n/supported-locales";
import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";
import type { ThemePreference } from "@/lib/preferences/preference-cookies";
import type { StorageBundle } from "@/lib/storage/create-browser-storage";
import { SchemaforgeDatabase } from "@/lib/storage/database";
import { createSchemaLockManager } from "@/lib/storage/schema-lock-manager";
import { createSchemaRepository } from "@/lib/storage/schema-repository";
import { createFakeLockRegistry } from "@/testing/fake-lock-registry";
import { expectNoAxeViolations } from "@/testing/expect-no-axe-violations";
import { renderWithProviders } from "@/testing/render-with-providers";

import type { CloudStatusView } from "../../lib/to-cloud-status-view";
import type { ViewportControls } from "../../lib/viewport-controls";
import { ViewportControlsProvider } from "../../lib/viewport-controls";
import { createEditorStore } from "../../state/create-editor-store";
import type { EditorStore } from "../../state/create-editor-store";
import { EditorStoreProvider } from "../../state/editor-store-provider";
import type { CloudStatusBadgeProps } from "./cloud-status-badge";
import { EditorToolbar } from "./editor-toolbar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn<() => void>() }),
  usePathname: () => "/schemas/0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
}));

const databases = new Set<SchemaforgeDatabase>();

afterEach(() => {
  databases.forEach((database) => {
    database.close();
  });
  databases.clear();
});

type Controls = {
  readonly zoomIn: ReturnType<typeof vi.fn<ViewportControls["zoomIn"]>>;
  readonly zoomOut: ReturnType<typeof vi.fn<ViewportControls["zoomOut"]>>;
  readonly fitView: ReturnType<typeof vi.fn<ViewportControls["fitView"]>>;
  readonly setCenter: ReturnType<typeof vi.fn<ViewportControls["setCenter"]>>;
  readonly getZoom: ReturnType<typeof vi.fn<ViewportControls["getZoom"]>>;
};

type Harness = RenderResult & {
  readonly user: UserEvent;
  readonly store: EditorStore;
  readonly controls: Controls;
  readonly onRetrySave: ReturnType<typeof vi.fn<() => void>>;
  readonly onSaveToCloud: ReturnType<
    typeof vi.fn<CloudStatusBadgeProps["onSaveToCloud"]>
  >;
};

type HarnessOptions = {
  readonly document?: SchemaDocument;
  readonly locale?: Locale;
  readonly themePreference?: ThemePreference;
  readonly cloudStatus?: CloudStatusView;
};

// The account menu reads auth, which lives on top of storage.
function createAuthStorage(): { readonly storage: StorageBundle } {
  const database = new SchemaforgeDatabase({
    indexedDB: new IDBFactory(),
    IDBKeyRange,
  });
  databases.add(database);
  return {
    storage: {
      database,
      lockManager: createSchemaLockManager(createFakeLockRegistry().request),
      repository: createSchemaRepository({
        database,
        clock: () => 1,
        generateId: () => "00000000-0000-4000-8000-000000000001",
      }),
    },
  };
}

function createValidDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        primaryKeyColumnIds: ["col_users_id"],
      }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
    ],
  });
}

function createDocumentWithTwoIssues(): SchemaDocument {
  // Both tables report `table-name-duplicate`.
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({ id: "tbl_users", name: "users" }),
      makeTable({ id: "tbl_people", name: "users" }),
    ],
  });
}

function renderToolbar(options: HarnessOptions = {}): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: options.document ?? createValidDocument(),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const controls: Controls = {
    zoomIn: vi.fn<ViewportControls["zoomIn"]>(),
    zoomOut: vi.fn<ViewportControls["zoomOut"]>(),
    fitView: vi.fn<ViewportControls["fitView"]>(),
    setCenter: vi.fn<ViewportControls["setCenter"]>(),
    getZoom: vi.fn<ViewportControls["getZoom"]>(() => 1),
  };
  const onRetrySave = vi.fn<() => void>();
  const onSaveToCloud = vi.fn<CloudStatusBadgeProps["onSaveToCloud"]>();
  const result = renderWithProviders(
    <EditorStoreProvider store={store}>
      <ViewportControlsProvider controls={controls}>
        <EditorToolbar
          onRetrySave={onRetrySave}
          cloud={{
            status: options.cloudStatus ?? { kind: "local-only" },
            onRetry: vi.fn<CloudStatusBadgeProps["onRetry"]>(),
            onSaveToCloud,
            onOpenCloudDialog:
              vi.fn<CloudStatusBadgeProps["onOpenCloudDialog"]>(),
          }}
        />
      </ViewportControlsProvider>
    </EditorStoreProvider>,
    {
      locale: options.locale ?? "en",
      themePreference: options.themePreference ?? "light",
      auth: createAuthStorage(),
    },
  );
  return { ...result, store, controls, onRetrySave, onSaveToCloud };
}

describe("EditorToolbar", () => {
  it.each([
    [
      "en",
      "Back to your schemas",
      ["Undo", "Redo", "Zoom out", "Zoom in", "Fit view", "No issues", "Theme"],
    ],
    [
      "vi",
      "Quay lại danh sách schema",
      [
        "Hoàn tác",
        "Làm lại",
        "Thu nhỏ",
        "Phóng to",
        "Xem toàn bộ",
        "Không có vấn đề",
        "Giao diện",
      ],
    ],
  ] as const)(
    "names every icon button in %s",
    (locale, backToList, buttonNames) => {
      renderToolbar({ locale });

      expect(screen.getByRole("link", { name: backToList })).toBeDefined();
      expect(
        buttonNames.map((name) => screen.getByRole("button", { name })),
      ).toHaveLength(buttonNames.length);
    },
  );

  it("disables undo when there is nothing to undo", () => {
    renderToolbar();

    expect(
      screen.getByRole("button", { name: "Undo" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("enables redo after an undo", async () => {
    const { user } = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Add table" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(
      screen.getByRole("button", { name: "Redo" }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("renames the schema from the toolbar dialog", async () => {
    const { user, store } = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Schema name shop" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename schema" });
    const field = within(dialog).getByLabelText("Schema name");
    await user.clear(field);
    await user.type(field, "store");
    await user.click(within(dialog).getByRole("button", { name: "Rename" }));

    expect(store.getState().document.name).toBe("store");
    expect(store.getState().history.past).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Schema name store" }),
    ).toBeDefined();
  });

  it("renames the schema when Enter is pressed in the dialog", async () => {
    const { user, store } = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Schema name shop" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename schema" });
    const field = within(dialog).getByLabelText("Schema name");
    await user.clear(field);
    await user.type(field, "store{Enter}");

    expect(store.getState().document.name).toBe("store");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("returns focus to the schema name button after renaming", async () => {
    const { user } = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Schema name shop" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename schema" });
    const field = within(dialog).getByLabelText("Schema name");
    await user.clear(field);
    await user.type(field, "store");
    await user.click(within(dialog).getByRole("button", { name: "Rename" }));

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Schema name store" }),
    );
  });

  it("returns focus to the schema name button when the dialog closes with Escape", async () => {
    const { user } = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Schema name shop" }));
    await screen.findByRole("dialog", { name: "Rename schema" });
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Schema name shop" }),
    );
  });

  it("keeps the focused schema name button when the name gets an issue", () => {
    const { store } = renderToolbar();
    const button = screen.getByRole("button", { name: "Schema name shop" });
    button.focus();

    act(() => {
      store.getState().dispatch({ type: "renameSchema", name: "" });
    });

    const updated = screen.getByRole("button", {
      name: "Schema name",
      description: "The name cannot be empty.",
    });
    expect(updated).toBe(button);
    expect(document.activeElement).toBe(button);
  });

  it("describes the schema name issue on the schema name button", () => {
    renderToolbar({ document: buildSchema({ name: "" }) });

    expect(
      screen.getByRole("button", {
        name: "Schema name",
        description: "The name cannot be empty.",
      }),
    ).toBeDefined();
  });

  it("shows the issue count and opens the issues tab", async () => {
    const { user, store } = renderToolbar({
      document: createDocumentWithTwoIssues(),
    });

    await user.click(screen.getByRole("button", { name: "2 issues" }));

    expect(store.getState().leftPanelTab).toBe("issues");
  });

  it("shows the check icon when there is no issue", () => {
    renderToolbar();

    const button = screen.getByRole("button", { name: "No issues" });
    expect(button.textContent).toBe("");
  });

  it("calls zoomIn, zoomOut and fitView on the viewport controls", async () => {
    const { user, controls } = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    await user.click(screen.getByRole("button", { name: "Fit view" }));

    expect(controls.zoomIn).toHaveBeenCalledOnce();
    expect(controls.zoomOut).toHaveBeenCalledOnce();
    expect(controls.fitView).toHaveBeenCalledOnce();
  });

  it("shows the retry button while saving failed", async () => {
    const { user, store, onRetrySave } = renderToolbar();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();

    act(() => {
      store.getState().setSaveStatus({ kind: "failed", errorCode: "unknown" });
    });
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetrySave).toHaveBeenCalledOnce();
  });

  // While saving works, the cloud status sits in the save status's place.
  it("announces a failed save but not saving or saved", () => {
    const { store } = renderToolbar({ cloudStatus: { kind: "syncing" } });

    act(() => {
      store.getState().setSaveStatus({ kind: "saving" });
    });
    const textWhileSaving = screen.getByRole("status").textContent;
    act(() => {
      store.getState().setSaveStatus({ kind: "failed", errorCode: "unknown" });
    });

    expect(textWhileSaving).toBe("");
    expect(screen.getByRole("status").textContent).toBe("Not saved");
  });

  it("shows the local save failure instead of the cloud status", () => {
    const { store } = renderToolbar({
      cloudStatus: { kind: "synced" },
    });

    act(() => {
      store.getState().setSaveStatus({ kind: "failed", errorCode: "unknown" });
    });

    expect({
      hasLocalFailure: screen.getByRole("status").textContent === "Not saved",
      hasCloudStatus: screen.queryByText("Saved to the cloud") !== null,
    }).toEqual({ hasLocalFailure: true, hasCloudStatus: false });
  });

  it("shows the cloud status when the local save succeeded", async () => {
    const { user, onSaveToCloud } = renderToolbar();

    await user.click(screen.getByRole("button", { name: "Save to cloud" }));

    expect(screen.getByText("Only saved on this browser")).toBeDefined();
    expect(onSaveToCloud).toHaveBeenCalledOnce();
  });

  it("renders the account menu", async () => {
    renderToolbar();

    expect(await screen.findByRole("link", { name: "Sign in" })).toBeDefined();
  });

  it.each(["light", "dark"] as const)(
    "reports no axe violations in the %s theme",
    async (themePreference) => {
      const { container } = renderToolbar({
        document: createDocumentWithTwoIssues(),
        themePreference,
      });

      await expectNoAxeViolations(container);
    },
  );

  it.each(["light", "dark"] as const)(
    "reports no axe violations with the rename dialog open in the %s theme",
    async (themePreference) => {
      const { user } = renderToolbar({ themePreference });

      await user.click(
        screen.getByRole("button", { name: "Schema name shop" }),
      );
      await screen.findByRole("dialog", { name: "Rename schema" });

      await expectNoAxeViolations(document.body);
    },
  );

  it.each(["light", "dark"] as const)(
    "reports no axe violations when the schema name has an issue in the %s theme",
    async (themePreference) => {
      const { container } = renderToolbar({
        document: buildSchema({ name: "" }),
        themePreference,
      });

      await expectNoAxeViolations(container);
    },
  );
});
