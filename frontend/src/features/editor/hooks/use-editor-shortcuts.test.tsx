import {
  buildSchema,
  createCounterIdGenerator,
  makeTable,
} from "@schemaforge/core/testing";
import { act, renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";

import { createEditorStore } from "../state/create-editor-store";
import type { EditorStore } from "../state/create-editor-store";
import { useEditorShortcuts } from "./use-editor-shortcuts";

const OTHER_PLATFORM = "Win32";

type ShortcutProps = {
  readonly canvasElement: Element | null;
  readonly isDialogOpen: boolean;
  readonly onDeleteSelection: () => void;
};

function createTestStore(): EditorStore {
  return createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: buildSchema({
      name: "shop",
      tables: [makeTable({ id: "tbl_users", name: "users" })],
    }),
    generateId: createCounterIdGenerator(),
    notify: vi.fn<Notify>(),
    logger: { error: vi.fn<Logger["error"]>(), warn: vi.fn<Logger["warn"]>() },
  });
}

function renameSchema(store: EditorStore, name: string): void {
  act(() => {
    store.getState().dispatch({ type: "renameSchema", name });
  });
}

function createCanvas(): HTMLElement {
  const canvas = document.createElement("div");
  canvas.tabIndex = 0;
  document.body.append(canvas);
  return canvas;
}

function renderShortcuts(store: EditorStore, props: Partial<ShortcutProps>) {
  const initialProps: ShortcutProps = {
    canvasElement: null,
    isDialogOpen: false,
    onDeleteSelection: vi.fn<() => void>(),
    ...props,
  };
  return renderHook(
    (current: ShortcutProps) => {
      useEditorShortcuts({ store, platformHint: OTHER_PLATFORM, ...current });
    },
    { initialProps },
  );
}

describe("useEditorShortcuts", () => {
  afterEach(() => {
    // Elements appended by a test keep focus otherwise, and a focused text
    // field would make the next test's shortcut look ignored.
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("undoes on the undo shortcut", async () => {
    const user = userEvent.setup();
    const store = createTestStore();
    renameSchema(store, "orders");
    renderShortcuts(store, {});

    await user.keyboard("{Control>}z{/Control}");

    expect(store.getState().document.name).toBe("shop");
  });

  it("redoes on the redo shortcut", async () => {
    const user = userEvent.setup();
    const store = createTestStore();
    renameSchema(store, "orders");
    act(() => {
      store.getState().undo();
    });
    renderShortcuts(store, {});

    await user.keyboard("{Control>}y{/Control}");

    expect(store.getState().document.name).toBe("orders");
  });

  it("calls onDeleteSelection on Delete when the canvas has focus", async () => {
    const user = userEvent.setup();
    const canvas = createCanvas();
    const onDeleteSelection = vi.fn<() => void>();
    renderShortcuts(createTestStore(), {
      canvasElement: canvas,
      onDeleteSelection,
    });
    canvas.focus();

    await user.keyboard("{Delete}");

    expect(onDeleteSelection).toHaveBeenCalledOnce();
  });

  it("ignores Delete while focus is in a text field", async () => {
    const user = userEvent.setup();
    const input = document.createElement("input");
    document.body.append(input);
    const onDeleteSelection = vi.fn<() => void>();
    renderShortcuts(createTestStore(), {
      canvasElement: createCanvas(),
      onDeleteSelection,
    });
    input.focus();

    await user.keyboard("{Delete}");

    expect(onDeleteSelection).not.toHaveBeenCalled();
  });

  it("ignores Delete while focus is on a button outside the canvas", async () => {
    const user = userEvent.setup();
    const button = document.createElement("button");
    document.body.append(button);
    const onDeleteSelection = vi.fn<() => void>();
    renderShortcuts(createTestStore(), {
      canvasElement: createCanvas(),
      onDeleteSelection,
    });
    button.focus();

    await user.keyboard("{Delete}");

    expect(onDeleteSelection).not.toHaveBeenCalled();
  });

  it("ignores shortcuts while a dialog is open", async () => {
    const user = userEvent.setup();
    const store = createTestStore();
    renameSchema(store, "orders");
    renderShortcuts(store, { isDialogOpen: true });

    await user.keyboard("{Control>}z{/Control}");

    expect(store.getState().document.name).toBe("orders");
  });

  it("reads the latest dialog state without re-attaching the listener", async () => {
    const user = userEvent.setup();
    const store = createTestStore();
    renameSchema(store, "orders");
    const { rerender } = renderShortcuts(store, { isDialogOpen: false });

    rerender({
      canvasElement: null,
      isDialogOpen: true,
      onDeleteSelection: vi.fn<() => void>(),
    });
    await user.keyboard("{Control>}z{/Control}");

    expect(store.getState().document.name).toBe("orders");
  });

  it("calls the latest onDeleteSelection after a rerender", async () => {
    const user = userEvent.setup();
    const canvas = createCanvas();
    const latestOnDeleteSelection = vi.fn<() => void>();
    const { rerender } = renderShortcuts(createTestStore(), {
      canvasElement: canvas,
    });

    rerender({
      canvasElement: canvas,
      isDialogOpen: false,
      onDeleteSelection: latestOnDeleteSelection,
    });
    canvas.focus();
    await user.keyboard("{Delete}");

    expect(latestOnDeleteSelection).toHaveBeenCalledOnce();
  });

  it("prevents the default browser action for a handled shortcut", () => {
    renderShortcuts(createTestStore(), {});
    const event = new KeyboardEvent("keydown", {
      key: "z",
      ctrlKey: true,
      cancelable: true,
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves an unrelated key alone", () => {
    const store = createTestStore();
    renameSchema(store, "orders");
    renderShortcuts(store, {});
    const event = new KeyboardEvent("keydown", { key: "a", cancelable: true });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(false);
    expect(store.getState().document.name).toBe("orders");
  });

  it("removes the listener on unmount", () => {
    // Spying on the exact handler keeps listeners of other tests from
    // masking a leak.
    const addListener = vi.spyOn(window, "addEventListener");
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderShortcuts(createTestStore(), {});
    const keydownHandler = addListener.mock.calls.find(
      ([type]) => type === "keydown",
    )?.[1];

    unmount();

    expect(keydownHandler).toBeDefined();
    expect(removeListener).toHaveBeenCalledWith("keydown", keydownHandler);
  });
});
