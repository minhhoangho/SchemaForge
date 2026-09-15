export type ShortcutAction = "undo" | "redo" | "deleteSelection";

export type ShortcutPlatform = "mac" | "other";

export type ShortcutKeyEvent = Pick<
  KeyboardEvent,
  | "key"
  | "altKey"
  | "ctrlKey"
  | "metaKey"
  | "shiftKey"
  | "isComposing"
  | "defaultPrevented"
  | "target"
>;

export type ShortcutContext = {
  readonly shouldRequireCanvasFocus: boolean;
  readonly isDialogOpen: boolean;
  readonly canvasElement: Element | null;
};

const MAC_PLATFORM_PATTERN = /mac|iphone|ipad/i;
const UNDO_KEY = "z";
const REDO_KEY = "y";
const DELETE_KEYS: readonly string[] = ["Delete", "Backspace"];
// Some browsers send this key while an IME composes but leave isComposing false.
const IME_PROCESS_KEY = "Process";
const FORM_FIELD_SELECTOR = "input, textarea, select";
// jsdom has no isContentEditable, so editability is read from the attribute.
const CONTENT_EDITABLE_SELECTOR =
  '[contenteditable]:not([contenteditable="false"])';

export function getShortcutPlatform(platformHint: string): ShortcutPlatform {
  return MAC_PLATFORM_PATTERN.test(platformHint) ? "mac" : "other";
}

export function matchShortcut(
  event: ShortcutKeyEvent,
  platform: ShortcutPlatform,
): ShortcutAction | null {
  // AltGr arrives as Ctrl+Alt, so any Alt combination is text input.
  if (event.altKey) {
    return null;
  }

  if (DELETE_KEYS.includes(event.key)) {
    const hasModifier = event.ctrlKey || event.metaKey || event.shiftKey;
    return hasModifier ? null : "deleteSelection";
  }

  return matchHistoryShortcut(event, platform);
}

function matchHistoryShortcut(
  event: ShortcutKeyEvent,
  platform: ShortcutPlatform,
): ShortcutAction | null {
  const isMac = platform === "mac";
  const hasPrimaryModifierOnly = isMac
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  if (!hasPrimaryModifierOnly) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (key === UNDO_KEY) {
    return event.shiftKey ? "redo" : "undo";
  }

  const isOtherRedoKey = !isMac && key === REDO_KEY && !event.shiftKey;
  return isOtherRedoKey ? "redo" : null;
}

export function shouldHandleShortcut(
  event: ShortcutKeyEvent,
  context: ShortcutContext,
): boolean {
  const isTextEntryInProgress =
    event.isComposing || event.key === IME_PROCESS_KEY;
  if (event.defaultPrevented || isTextEntryInProgress || context.isDialogOpen) {
    return false;
  }

  // A target that is not an element, such as window, is treated as the body.
  const { target } = event;
  if (!(target instanceof Element)) {
    return true;
  }

  if (isEditableTarget(target)) {
    return false;
  }

  return (
    !context.shouldRequireCanvasFocus ||
    isCanvasFocusTarget(target, context.canvasElement)
  );
}

function isEditableTarget(target: Element): boolean {
  return (
    target.matches(FORM_FIELD_SELECTOR) ||
    target.closest(CONTENT_EDITABLE_SELECTOR) !== null
  );
}

function isCanvasFocusTarget(
  target: Element,
  canvasElement: Element | null,
): boolean {
  const isBody = target === target.ownerDocument.body;
  return isBody || (canvasElement?.contains(target) ?? false);
}
