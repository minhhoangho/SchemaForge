"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useAiChatStore,
  useAiChatStoreApi,
} from "../../state/ai-chat-store-provider";
import type {
  AiAssistantMessage,
  AiChatFailure,
  AiChatState,
} from "../../state/create-ai-chat-store";
import { useEditorStore } from "../../state/use-editor-store";
import { useAiFailureText } from "./use-ai-failure-text";

type TurnStatus = AiAssistantMessage["status"] | null;

// Primitives (and the failure, a stable object), so streamed text does not
// re-render this component.
function selectLastStatus(state: AiChatState): TurnStatus {
  const last = state.messages.at(-1);
  return last?.role === "assistant" ? last.status : null;
}

function selectLastFailure(state: AiChatState): AiChatFailure | null {
  const last = state.messages.at(-1);
  return last?.role === "assistant" ? last.failure : null;
}

/**
 * A turn keeps streaming while the window is closed or minimized; a finished
 * answer then marks the launcher (the editor store ignores it while the
 * conversation is in view). A stopped or failed turn is no new reply.
 */
function useMarkUnreadReply(): void {
  const chat = useAiChatStoreApi();
  const markAiReplyUnread = useEditorStore((state) => state.markAiReplyUnread);

  useEffect(
    () =>
      chat.subscribe((state, previous) => {
        if (
          previous.isSending &&
          !state.isSending &&
          selectLastStatus(state) === "done"
        ) {
          markAiReplyUnread();
        }
      }),
    [chat, markAiReplyUnread],
  );
}

// What the status region reads for the newest answer (section 14).
function useAnnouncement(): string {
  const { t } = useTranslation("ai");
  const failureText = useAiFailureText();
  const status = useAiChatStore(selectLastStatus);
  const failure = useAiChatStore(selectLastFailure);
  const isLogShown = useEditorStore(
    (state) => state.aiWindow.isOpen && !state.aiWindow.isMinimized,
  );
  // Whether the log was in view when the status last changed: the log then
  // reads its own failure notice, and this region stays quiet so a failure is
  // heard once. Opening or closing the window later changes nothing.
  const [isFailureInLog, setIsFailureInLog] = useState(false);
  const [seenStatus, setSeenStatus] = useState(status);
  if (status !== seenStatus) {
    setSeenStatus(status);
    setIsFailureInLog(isLogShown);
  }

  switch (status) {
    case null:
      return "";
    case "streaming":
      return t("status.responding");
    case "done":
      return t("status.done");
    case "stopped":
      return t("status.stopped");
    case "failed":
      return failure === null || isFailureInLog ? "" : failureText(failure);
  }
}

/**
 * The one live region for turn progress (section 14). The workspace renders
 * it outside everything that can be hidden or made inert, so the end of a
 * turn is heard once whether the window is open, minimized, or closed, and
 * in every right-panel mode.
 */
export function AiTurnStatus(): JSX.Element {
  useMarkUnreadReply();
  const announcement = useAnnouncement();

  return (
    <p role="status" className="sr-only">
      {announcement}
    </p>
  );
}
