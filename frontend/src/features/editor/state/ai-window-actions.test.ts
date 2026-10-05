import {
  buildSchema,
  createCounterIdGenerator,
} from "@schemaforge/core/testing";
import { describe, expect, it, vi } from "vitest";

import { createEditorStore } from "./create-editor-store";
import type { EditorStore } from "./create-editor-store";

function createHarness(): { readonly store: EditorStore } {
  const store = createEditorStore({
    schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
    document: buildSchema({ name: "shop" }),
    generateId: createCounterIdGenerator(),
    notify: vi.fn(),
    logger: { error: vi.fn(), warn: vi.fn() },
  });
  return { store };
}

describe("AI window state", () => {
  it("starts closed, not minimized, not expanded and without an unread reply", () => {
    const { store } = createHarness();

    expect(store.getState().aiWindow).toEqual({
      isOpen: false,
      isMinimized: false,
      isExpanded: false,
      hasUnreadReply: false,
    });
  });

  it("marks a reply unread while minimized and clears it on restore", () => {
    const { store } = createHarness();
    store.getState().openAiWindow();
    store.getState().toggleAiWindowMinimized();

    store.getState().markAiReplyUnread();
    expect(store.getState().aiWindow.hasUnreadReply).toBe(true);

    store.getState().toggleAiWindowMinimized();
    expect(store.getState().aiWindow.hasUnreadReply).toBe(false);
  });

  it("keeps the minimized state while closing so the bar does not resize on its way out", () => {
    const { store } = createHarness();
    store.getState().openAiWindow();
    store.getState().toggleAiWindowMinimized();

    store.getState().closeAiWindow();

    expect(store.getState().aiWindow).toMatchObject({
      isOpen: false,
      isMinimized: true,
    });
  });

  it("marks a reply unread only while the window is closed or minimized", () => {
    const { store } = createHarness();

    store.getState().markAiReplyUnread();
    expect(store.getState().aiWindow.hasUnreadReply).toBe(true);

    store.getState().openAiWindow();
    expect(store.getState().aiWindow).toMatchObject({
      isOpen: true,
      hasUnreadReply: false,
    });

    store.getState().markAiReplyUnread();
    expect(store.getState().aiWindow.hasUnreadReply).toBe(false);
  });

  it("toggles minimized and expanded", () => {
    const { store } = createHarness();
    store.getState().openAiWindow();

    store.getState().toggleAiWindowMinimized();
    store.getState().toggleAiWindowExpanded();
    expect(store.getState().aiWindow).toMatchObject({
      isMinimized: true,
      isExpanded: true,
    });

    store.getState().toggleAiWindowMinimized();
    store.getState().toggleAiWindowExpanded();
    expect(store.getState().aiWindow).toMatchObject({
      isMinimized: false,
      isExpanded: false,
    });
  });

  it("opens the whole window again after closing it minimized, keeping its size", () => {
    const { store } = createHarness();
    store.getState().openAiWindow();
    store.getState().toggleAiWindowExpanded();
    store.getState().toggleAiWindowMinimized();

    store.getState().closeAiWindow();
    store.getState().openAiWindow();

    expect(store.getState().aiWindow).toMatchObject({
      isOpen: true,
      isMinimized: false,
      isExpanded: true,
    });
  });
});
