import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeTable,
} from "@schemaforge/core/testing";
import { act, render, renderHook, screen } from "@testing-library/react";
import type { JSX } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";

import { createEditorStore } from "./create-editor-store";
import type { EditorStore } from "./create-editor-store";
import { EditorStoreProvider } from "./editor-store-provider";
import { useEditorStore } from "./use-editor-store";

function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [makeTable({ id: "tbl_users", name: "users" })],
  });
}

function createTestStore(): EditorStore {
  return createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: createDocument(),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
}

function SchemaName(): JSX.Element {
  const name = useEditorStore((state) => state.document.name);
  return <p>{name}</p>;
}

type RenderCounterProps = { readonly onRender: () => void };

function LeftPanelTabView({ onRender }: RenderCounterProps): JSX.Element {
  const tab = useEditorStore((state) => state.leftPanelTab);
  onRender();
  return <p>{tab}</p>;
}

describe("EditorStoreProvider", () => {
  it("exposes the store to consumers", () => {
    const store = createTestStore();

    render(
      <EditorStoreProvider store={store}>
        <SchemaName />
      </EditorStoreProvider>,
    );

    expect(screen.getByText("shop")).toBeDefined();
  });

  it("throws when useEditorStore is used outside the provider", () => {
    // React logs the render error itself; silence it so the run stays readable.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // The error is asserted below, so it does not need to be printed.
    });

    expect(() =>
      renderHook(() => useEditorStore((state) => state.schemaId)),
    ).toThrow(/EditorStoreProvider/);

    errorSpy.mockRestore();
  });

  it("re-renders a consumer only when its slice changes", () => {
    const store = createTestStore();
    const onRender = vi.fn<() => void>();
    render(
      <EditorStoreProvider store={store}>
        <LeftPanelTabView onRender={onRender} />
      </EditorStoreProvider>,
    );
    onRender.mockClear();

    act(() => {
      store.getState().dispatch({ type: "renameSchema", name: "store" });
    });
    const rendersAfterUnrelatedChange = onRender.mock.calls.length;
    act(() => {
      store.getState().setLeftPanelTab("issues");
    });

    expect(rendersAfterUnrelatedChange).toBe(0);
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(screen.getByText("issues")).toBeDefined();
  });
});
