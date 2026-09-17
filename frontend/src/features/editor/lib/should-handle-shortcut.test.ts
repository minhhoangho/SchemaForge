import { describe, expect, it } from "vitest";

import {
  getShortcutPlatform,
  matchShortcut,
  shouldHandleShortcut,
} from "./should-handle-shortcut";
import type {
  ShortcutAction,
  ShortcutContext,
  ShortcutKeyEvent,
  ShortcutPlatform,
} from "./should-handle-shortcut";

function createKeyEvent(
  overrides: Partial<ShortcutKeyEvent> = {},
): ShortcutKeyEvent {
  return {
    key: "Delete",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    isComposing: false,
    defaultPrevented: false,
    target: null,
    ...overrides,
  };
}

function createContext(
  overrides: Partial<ShortcutContext> = {},
): ShortcutContext {
  return {
    shouldRequireCanvasFocus: false,
    isDialogOpen: false,
    canvasElement: null,
    ...overrides,
  };
}

function appendToBody<ElementType extends Element>(
  element: ElementType,
): ElementType {
  document.body.append(element);
  return element;
}

function createContentEditable(value: string): HTMLDivElement {
  const element = document.createElement("div");
  element.setAttribute("contenteditable", value);
  return element;
}

function createChildOfContentEditable(): HTMLSpanElement {
  const parent = appendToBody(createContentEditable(""));
  const child = document.createElement("span");
  parent.append(child);
  return child;
}

describe("matchShortcut", () => {
  it.each<[string, ShortcutPlatform, ShortcutAction, ShortcutKeyEvent]>([
    ["⌘Z", "mac", "undo", createKeyEvent({ key: "z", metaKey: true })],
    ["Ctrl+Z", "other", "undo", createKeyEvent({ key: "z", ctrlKey: true })],
    [
      "⌘⇧Z",
      "mac",
      "redo",
      createKeyEvent({ key: "Z", metaKey: true, shiftKey: true }),
    ],
    [
      "Ctrl+Shift+Z",
      "other",
      "redo",
      createKeyEvent({ key: "Z", ctrlKey: true, shiftKey: true }),
    ],
    ["Ctrl+Y", "other", "redo", createKeyEvent({ key: "y", ctrlKey: true })],
    ["Delete", "mac", "deleteSelection", createKeyEvent({ key: "Delete" })],
    ["Delete", "other", "deleteSelection", createKeyEvent({ key: "Delete" })],
    [
      "Backspace",
      "mac",
      "deleteSelection",
      createKeyEvent({ key: "Backspace" }),
    ],
    [
      "Backspace",
      "other",
      "deleteSelection",
      createKeyEvent({ key: "Backspace" }),
    ],
  ])("matches %s on %s as %s", (_label, platform, expected, event) => {
    expect(matchShortcut(event, platform)).toBe(expected);
  });

  it.each<[string, ShortcutPlatform, ShortcutKeyEvent]>([
    ["Ctrl+Z", "mac", createKeyEvent({ key: "z", ctrlKey: true })],
    ["⌘Z", "other", createKeyEvent({ key: "z", metaKey: true })],
    [
      "Ctrl+Alt+Z",
      "other",
      createKeyEvent({ key: "z", ctrlKey: true, altKey: true }),
    ],
    ["Ctrl+Y", "mac", createKeyEvent({ key: "y", ctrlKey: true })],
    [
      "Alt+Backspace",
      "mac",
      createKeyEvent({ key: "Backspace", altKey: true }),
    ],
    [
      "Alt+Backspace",
      "other",
      createKeyEvent({ key: "Backspace", altKey: true }),
    ],
    ["z", "mac", createKeyEvent({ key: "z" })],
    ["z", "other", createKeyEvent({ key: "z" })],
  ])("does not match %s on %s", (_label, platform, event) => {
    expect(matchShortcut(event, platform)).toBeNull();
  });
});

describe("getShortcutPlatform", () => {
  it.each<[string, ShortcutPlatform]>([
    ["MacIntel", "mac"],
    ["macOS", "mac"],
    ["iPad", "mac"],
    ["Win32", "other"],
    ["Linux x86_64", "other"],
    ["", "other"],
  ])("detects %s as the %s platform", (platformHint, expected) => {
    expect(getShortcutPlatform(platformHint)).toBe(expected);
  });
});

describe("shouldHandleShortcut", () => {
  it("handles a shortcut whose target is the body", () => {
    const event = createKeyEvent({ target: document.body });

    expect(
      shouldHandleShortcut(
        event,
        createContext({ shouldRequireCanvasFocus: true }),
      ),
    ).toBe(true);
  });

  it("ignores a prevented event", () => {
    const event = createKeyEvent({
      target: document.body,
      defaultPrevented: true,
    });

    expect(shouldHandleShortcut(event, createContext())).toBe(false);
  });

  it("ignores a key event during IME composition", () => {
    const event = createKeyEvent({ target: document.body, isComposing: true });

    expect(shouldHandleShortcut(event, createContext())).toBe(false);
  });

  it("ignores the IME Process key", () => {
    const event = createKeyEvent({ target: document.body, key: "Process" });

    expect(shouldHandleShortcut(event, createContext())).toBe(false);
  });

  it.each<[string, () => Element]>([
    ["input", () => appendToBody(document.createElement("input"))],
    ["textarea", () => appendToBody(document.createElement("textarea"))],
    ["select", () => appendToBody(document.createElement("select"))],
    ["a child of div[contenteditable]", createChildOfContentEditable],
    [
      'div[contenteditable="true"]',
      () => appendToBody(createContentEditable("true")),
    ],
  ])("ignores events from %s", (_label, createTarget) => {
    const event = createKeyEvent({ target: createTarget() });

    expect(shouldHandleShortcut(event, createContext())).toBe(false);
  });

  it("handles events from an element with contenteditable false", () => {
    const target = appendToBody(createContentEditable("false"));
    const event = createKeyEvent({ target });

    expect(shouldHandleShortcut(event, createContext())).toBe(true);
  });

  it("ignores shortcuts while a dialog is open", () => {
    const event = createKeyEvent({ target: document.body });

    expect(
      shouldHandleShortcut(event, createContext({ isDialogOpen: true })),
    ).toBe(false);
  });

  it.each(["dialog", "alertdialog"])(
    "ignores shortcuts from a button inside a %s element",
    (role) => {
      const dialog = appendToBody(document.createElement("div"));
      dialog.setAttribute("role", role);
      const button = document.createElement("button");
      dialog.append(button);
      const event = createKeyEvent({ key: "z", target: button });

      expect(shouldHandleShortcut(event, createContext())).toBe(false);
    },
  );

  it("handles a canvas-only shortcut from inside the canvas", () => {
    const canvasElement = appendToBody(document.createElement("div"));
    const node = document.createElement("div");
    canvasElement.append(node);
    const event = createKeyEvent({ target: node });

    expect(
      shouldHandleShortcut(
        event,
        createContext({ shouldRequireCanvasFocus: true, canvasElement }),
      ),
    ).toBe(true);
  });

  it("ignores a canvas-only shortcut from a panel button", () => {
    const canvasElement = appendToBody(document.createElement("div"));
    const panelButton = appendToBody(document.createElement("button"));
    const event = createKeyEvent({ target: panelButton });

    expect(
      shouldHandleShortcut(
        event,
        createContext({ shouldRequireCanvasFocus: true, canvasElement }),
      ),
    ).toBe(false);
  });

  it("handles an editor-wide shortcut from a panel button", () => {
    const canvasElement = appendToBody(document.createElement("div"));
    const panelButton = appendToBody(document.createElement("button"));
    const event = createKeyEvent({ key: "z", target: panelButton });

    expect(
      shouldHandleShortcut(
        event,
        createContext({ shouldRequireCanvasFocus: false, canvasElement }),
      ),
    ).toBe(true);
  });

  it("treats a target that is not an element like the body", () => {
    const event = createKeyEvent({ target: window });

    expect(
      shouldHandleShortcut(
        event,
        createContext({ shouldRequireCanvasFocus: true }),
      ),
    ).toBe(true);
  });
});
