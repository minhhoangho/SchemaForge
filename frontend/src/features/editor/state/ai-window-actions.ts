import type {
  EditorActions,
  EditorState,
  EditorStore,
} from "./create-editor-store";

// The floating AI window over the canvas. Not persisted, like the right panel.
export type AiWindowState = {
  readonly isOpen: boolean;
  readonly isMinimized: boolean;
  readonly isExpanded: boolean;
  // A turn ended while the window was closed or minimized; cleared when it
  // opens or is restored.
  readonly hasUnreadReply: boolean;
};

export const CLOSED_AI_WINDOW: AiWindowState = {
  isOpen: false,
  isMinimized: false,
  isExpanded: false,
  hasUnreadReply: false,
};

export type AiWindowActions = Pick<
  EditorActions,
  | "openAiWindow"
  | "closeAiWindow"
  | "toggleAiWindowMinimized"
  | "toggleAiWindowExpanded"
  | "markAiReplyUnread"
>;

export function createAiWindowActions(
  set: EditorStore["setState"],
  get: () => EditorState,
): AiWindowActions {
  const update = (patch: Partial<AiWindowState>): void => {
    set({ aiWindow: { ...get().aiWindow, ...patch } });
  };
  return {
    // Opening again shows the whole window, not a leftover minimized bar.
    // Reset here, not on close, so a minimized bar keeps its height while it
    // animates out.
    openAiWindow: () => {
      update({ isOpen: true, isMinimized: false, hasUnreadReply: false });
    },
    closeAiWindow: () => {
      update({ isOpen: false });
    },
    // Restoring shows the reply, so it is no longer unread.
    toggleAiWindowMinimized: () => {
      const isMinimized = !get().aiWindow.isMinimized;
      update(
        isMinimized ? { isMinimized } : { isMinimized, hasUnreadReply: false },
      );
    },
    toggleAiWindowExpanded: () => {
      update({ isExpanded: !get().aiWindow.isExpanded });
    },
    markAiReplyUnread: () => {
      const { isOpen, isMinimized } = get().aiWindow;
      if (!isOpen || isMinimized) {
        update({ hasUnreadReply: true });
      }
    },
  };
}
