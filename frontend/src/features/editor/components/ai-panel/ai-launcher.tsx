"use client";

import { ChevronDownIcon, SparklesIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useIsNarrowViewport } from "../../hooks/use-is-narrow-viewport";
import { useEditorStore } from "../../state/use-editor-store";
import { AI_LAUNCHER_ID } from "./ai-panel-ids";

/**
 * The round button that opens and closes the floating AI window, bottom
 * right of the canvas. It lives in the editor's own chunk, so it imports
 * nothing of the lazy panel (AI spec section 15). Its name stays the same
 * whether the window is open or closed; aria-expanded carries that.
 */
export function AiLauncher({
  windowId,
}: {
  readonly windowId: string;
}): JSX.Element | null {
  const { t } = useTranslation("ai");
  const isOpen = useEditorStore((state) => state.aiWindow.isOpen);
  const hasUnreadReply = useEditorStore(
    (state) => state.aiWindow.hasUnreadReply,
  );
  const openAiWindow = useEditorStore((state) => state.openAiWindow);
  const closeAiWindow = useEditorStore((state) => state.closeAiWindow);
  const isNarrow = useIsNarrowViewport();
  // On a narrow screen the open window is a sheet (or its minimized bar) over
  // this corner, with its own Close and Restore: a launcher under it would be
  // a focusable control hidden from view (WCAG 2.4.11).
  if (isNarrow && isOpen) {
    return null;
  }
  const label = hasUnreadReply ? t("panel.unreadReply") : t("panel.toggle");
  const Icon = isOpen ? ChevronDownIcon : SparklesIcon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          id={AI_LAUNCHER_ID}
          aria-label={label}
          aria-expanded={isOpen}
          // The window's element exists only while it is open.
          aria-controls={isOpen ? windowId : undefined}
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
