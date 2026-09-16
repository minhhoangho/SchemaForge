import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeEnum,
  makeTable,
} from "@schemaforge/core/testing";
import { act, renderHook } from "@testing-library/react";
import type { RenderHookResult } from "@testing-library/react";
import type { JSX, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";

import type { ViewportControls } from "../lib/viewport-controls";
import {
  VIEWPORT_TRANSITION_MS,
  ViewportControlsProvider,
} from "../lib/viewport-controls";
import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { EditorStoreProvider } from "../state/editor-store-provider";
import type { SchemaCommands } from "./use-schema-commands";
import { useSchemaCommands } from "./use-schema-commands";

const CURRENT_ZOOM = 0.75;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
// Taken ids make the next add collide, so core rejects the dispatch.
const TAKEN_UUID = "00000000-0000-4000-8000-000000000000";

type Controls = {
  readonly zoomIn: ReturnType<typeof vi.fn<ViewportControls["zoomIn"]>>;
  readonly zoomOut: ReturnType<typeof vi.fn<ViewportControls["zoomOut"]>>;
  readonly fitView: ReturnType<typeof vi.fn<ViewportControls["fitView"]>>;
  readonly setCenter: ReturnType<typeof vi.fn<ViewportControls["setCenter"]>>;
  readonly getZoom: ReturnType<typeof vi.fn<ViewportControls["getZoom"]>>;
};

type Harness = {
  readonly store: EditorStore;
  readonly controls: Controls;
  readonly hook: RenderHookResult<SchemaCommands, unknown>;
};

function createDocument(): SchemaDocument {
  // A table at the origin makes the new table step aside by the offset.
  return buildSchema({
    name: "shop",
    tables: [makeTable({ id: "tbl_users", name: "users" })],
  });
}

function createDocumentWithTakenIds(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [makeTable({ id: `tbl_${TAKEN_UUID}`, name: "users" })],
    enums: [makeEnum({ id: `enum_${TAKEN_UUID}`, name: "status" })],
  });
}

function stubReducedMotion(): void {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: media === REDUCED_MOTION_QUERY,
    media,
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderCommands(document: SchemaDocument = createDocument()): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document,
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const controls: Controls = {
    zoomIn: vi.fn<ViewportControls["zoomIn"]>(),
    zoomOut: vi.fn<ViewportControls["zoomOut"]>(),
    fitView: vi.fn<ViewportControls["fitView"]>(),
    setCenter: vi.fn<ViewportControls["setCenter"]>(),
    getZoom: vi.fn<ViewportControls["getZoom"]>(() => CURRENT_ZOOM),
  };
  function Wrapper({
    children,
  }: {
    readonly children: ReactNode;
  }): JSX.Element {
    return (
      <EditorStoreProvider store={store}>
        <ViewportControlsProvider controls={controls}>
          {children}
        </ViewportControlsProvider>
      </EditorStoreProvider>
    );
  }
  const hook = renderHook(() => useSchemaCommands(), { wrapper: Wrapper });
  return { store, controls, hook };
}

function findNewTableId(store: EditorStore): string {
  const table = Object.values(store.getState().document.tables).find(
    (candidate) => candidate.id !== "tbl_users",
  );
  if (table === undefined) {
    throw new Error("Expected a new table.");
  }
  return table.id;
}

describe("useSchemaCommands", () => {
  it("dispatches one batch when adding a table", () => {
    const { store, hook } = renderCommands();

    act(() => {
      hook.result.current.addTable();
    });

    const { history, document } = store.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0]?.operation.type).toBe("batch");
    expect(Object.keys(document.tables)).toHaveLength(2);
  });

  it("selects the new table and focuses its name", () => {
    const { store, hook } = renderCommands();

    act(() => {
      hook.result.current.addTable();
    });

    const tableId = findNewTableId(store);
    const state = store.getState();
    expect(state.selection).toStrictEqual({
      tableIds: [tableId],
      relationIds: [],
    });
    expect(state.focusRequest).toStrictEqual(["tables", tableId, "name"]);
  });

  it("centers the viewport on the new table", () => {
    const { controls, hook } = renderCommands();

    act(() => {
      hook.result.current.addTable();
    });

    expect(controls.setCenter).toHaveBeenCalledExactlyOnceWith(24, 24, {
      zoom: CURRENT_ZOOM,
      duration: VIEWPORT_TRANSITION_MS,
    });
  });

  it("centers the viewport without a transition when reduced motion is preferred", () => {
    stubReducedMotion();
    const { controls, hook } = renderCommands();

    act(() => {
      hook.result.current.addTable();
    });

    expect(controls.setCenter).toHaveBeenCalledExactlyOnceWith(24, 24, {
      zoom: CURRENT_ZOOM,
      duration: 0,
    });
  });

  it("neither selects, focuses nor centers when adding a table is rejected", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(TAKEN_UUID);
    const { store, controls, hook } = renderCommands(
      createDocumentWithTakenIds(),
    );

    act(() => {
      hook.result.current.addTable();
    });

    const state = store.getState();
    expect(state.history.past).toHaveLength(0);
    expect(state.selection).toStrictEqual({ tableIds: [], relationIds: [] });
    expect(state.focusRequest).toBeNull();
    expect(controls.setCenter).not.toHaveBeenCalled();
  });

  it("neither opens the enums tab nor focuses when adding an enum is rejected", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(TAKEN_UUID);
    const { store, hook } = renderCommands(createDocumentWithTakenIds());

    act(() => {
      hook.result.current.addEnum();
    });

    const state = store.getState();
    expect(state.history.past).toHaveLength(0);
    expect(state.leftPanelTab).toBe("tables");
    expect(state.focusRequest).toBeNull();
  });

  it("dispatches one operation when adding an enum", () => {
    const { store, hook } = renderCommands();

    act(() => {
      hook.result.current.addEnum();
    });

    const { history, document } = store.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0]?.operation.type).toBe("addEnum");
    expect(Object.keys(document.enums)).toHaveLength(1);
  });

  it("opens the enums tab after adding an enum", () => {
    const { store, hook } = renderCommands();

    act(() => {
      hook.result.current.addEnum();
    });

    const state = store.getState();
    const [enumId] = Object.keys(state.document.enums);
    expect(state.leftPanelTab).toBe("enums");
    expect(state.focusRequest).toStrictEqual(["enums", enumId, "name"]);
  });

  it("returns a stable commands object across rerenders", () => {
    const { hook } = renderCommands();
    const first = hook.result.current;

    act(() => {
      first.addTable();
    });
    hook.rerender();

    expect(hook.result.current).toBe(first);
  });
});
