"use client";

import { ChevronDownIcon, SparklesIcon } from "lucide-react";
import type { JSX } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useAiChatStoreApi } from "../../state/ai-chat-store-provider";
import { useEditorStore } from "../../state/use-editor-store";
import { AI_LAUNCHER_ID } from "./ai-panel-ids";

/**
 * A turn keeps streaming after the window closes; its end marks the reply
 * unread so the launcher can say so (the editor store ignores it while the
 * window is open).
 */
function useMarkUnreadReply(): void {
  const chat = useAiChatStoreApi();
  const markAiReplyUnread = useEditorStore((state) => state.markAiReplyUnread);

  useEffect(
    () =>
      chat.subscribe((state, previous) => {
        if (previous.isSending && !state.isSending) {
          markAiReplyUnread();
        }
      }),
    [chat, markAiReplyUnread],
  );
}

/**
 * The round button that opens and closes the floating AI window, bottom
 * right of the canvas. It lives in the editor's own chunk, so it imports
 * nothing of the lazy panel (AI spec section 15).
 */
export function AiLauncher({
  windowId,
}: {
  readonly windowId: string;
}): JSX.Element {
  const { t } = useTranslation("ai");
  const isOpen = useEditorStore((state) => state.aiWindow.isOpen);
  const hasUnreadReply = useEditorStore(
    (state) => state.aiWindow.hasUnreadReply,
  );
  const openAiWindow = useEditorStore((state) => state.openAiWindow);
  const closeAiWindow = useEditorStore((state) => state.closeAiWindow);
  useMarkUnreadReply();
  const label = isOpen
    ? t("panel.close")
    : hasUnreadReply
      ? t("panel.unreadReply")
      : t("panel.toggle");
  const Icon = isOpen ? ChevronDownIcon : SparklesIcon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          id={AI_LAUNCHER_ID}
          aria-label={label}
          aria-expanded={isOpen}
          aria-controls={windowId}
          className="absolute right-4 bottom-4 z-20 size-14 rounded-full shadow-md [&_svg:not([class*='size-'])]:size-6"
          onClick={isOpen ? closeAiWindow : openAiWindow}
        >
          <Icon aria-hidden />
          {hasUnreadReply && (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 size-3.5 rounded-full border-2 border-background bg-destructive"
            />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}
