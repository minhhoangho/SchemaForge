import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
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
import { useRevealTable } from "./use-reveal-table";

const CURRENT_ZOOM = 0.5;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type Harness = {
  readonly store: EditorStore;
  readonly setCenter: ReturnType<typeof vi.fn<ViewportControls["setCenter"]>>;
  readonly hook: RenderHookResult<ReturnType<typeof useRevealTable>, unknown>;
};

function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({ id: "tbl_users", name: "users", position: { x: 40, y: 80 } }),
      makeTable({ id: "tbl_orders", name: "orders" }),
    ],
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
});

function renderRevealTable(): Harness {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createDocument(),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
  const setCenter = vi.fn<ViewportControls["setCenter"]>();
  const controls: ViewportControls = {
    zoomIn: vi.fn<ViewportControls["zoomIn"]>(),
    zoomOut: vi.fn<ViewportControls["zoomOut"]>(),
    fitView: vi.fn<ViewportControls["fitView"]>(),
    setCenter,
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
  const hook = renderHook(() => useRevealTable(), { wrapper: Wrapper });
  return { store, setCenter, hook };
}

describe("useRevealTable", () => {
  it("selects the table and centers the viewport on it", () => {
    const { store, setCenter, hook } = renderRevealTable();

    act(() => {
      hook.result.current("tbl_users");
    });

    expect(store.getState().selection).toStrictEqual({
      tableIds: ["tbl_users"],
      relationIds: [],
    });
    expect(setCenter).toHaveBeenCalledExactlyOnceWith(40, 80, {
      zoom: CURRENT_ZOOM,
      duration: VIEWPORT_TRANSITION_MS,
    });
  });

  it("keeps the current zoom", () => {
    const { setCenter, hook } = renderRevealTable();

    act(() => {
      hook.result.current("tbl_orders");
    });

    expect(setCenter.mock.calls[0]?.[2].zoom).toBe(CURRENT_ZOOM);
  });

  it("uses no transition when reduced motion is requested", () => {
    stubReducedMotion();
    const { setCenter, hook } = renderRevealTable();

    act(() => {
      hook.result.current("tbl_users");
    });

    expect(setCenter).toHaveBeenCalledExactlyOnceWith(40, 80, {
      zoom: CURRENT_ZOOM,
      duration: 0,
    });
  });

  it("does nothing for a table the document no longer holds", () => {
    const { store, setCenter, hook } = renderRevealTable();

    act(() => {
      hook.result.current("tbl_missing");
    });

    expect(store.getState().selection).toStrictEqual({
      tableIds: [],
      relationIds: [],
    });
    expect(setCenter).not.toHaveBeenCalled();
  });
});
