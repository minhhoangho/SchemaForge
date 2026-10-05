"use client";

import {
  ChevronUpIcon,
  Maximize2Icon,
  Minimize2Icon,
  MinusIcon,
  SquarePenIcon,
  XIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { JSX, Ref } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useAiChatStore } from "../../state/ai-chat-store-provider";
import { useEditorStore } from "../../state/use-editor-store";
import { AI_RESTORE_ID } from "./ai-panel-ids";

type HeaderButtonProps = {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onClick: () => void;
  readonly buttonRef?: Ref<HTMLButtonElement>;
  readonly id?: string;
  // A dot for a state the label already names, so it is hidden from readers.
  readonly hasBadge?: boolean;
};

// Icon-only, named by aria-label. No tooltip: Escape on it would also close
// the window.
function HeaderButton({
  label,
  icon: Icon,
  onClick,
  buttonRef,
  id,
  hasBadge = false,
}: HeaderButtonProps): JSX.Element {
  return (
    <Button
      ref={buttonRef}
      id={id}
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={label}
      onClick={onClick}
    >
      <Icon aria-hidden />
      {hasBadge && (
        <span
          aria-hidden
          className="absolute top-1 right-1 size-2.5 rounded-full border-2 border-background bg-destructive"
        />
      )}
    </Button>
  );
}

export type AiPanelHeaderProps = {
  readonly titleId: string;
  // Below 640px the window is a full-screen sheet and cannot expand.
  readonly isNarrow: boolean;
  readonly minimizeRef: Ref<HTMLButtonElement>;
  readonly onClose: () => void;
};

export function AiPanelHeader({
  titleId,
  isNarrow,
  minimizeRef,
  onClose,
}: AiPanelHeaderProps): JSX.Element {
  const { t } = useTranslation("ai");
  const reset = useAiChatStore((state) => state.reset);
  const isMinimized = useEditorStore((state) => state.aiWindow.isMinimized);
  const hasUnreadReply = useEditorStore(
    (state) => state.aiWindow.hasUnreadReply,
  );
  const isExpanded = useEditorStore((state) => state.aiWindow.isExpanded);
  const toggleMinimized = useEditorStore(
    (state) => state.toggleAiWindowMinimized,
  );
  const toggleExpanded = useEditorStore(
    (state) => state.toggleAiWindowExpanded,
  );

  return (
    <div className="flex items-center gap-1 border-b border-border py-1 pr-1 pl-3">
      <h2 id={titleId} className="mr-auto text-sm font-semibold">
        {t("panel.title")}
      </h2>
      <HeaderButton
        label={t("panel.newConversation")}
        icon={SquarePenIcon}
        onClick={reset}
      />
      <HeaderButton
        id={AI_RESTORE_ID}
        label={
          isMinimized
            ? t(hasUnreadReply ? "panel.restoreUnread" : "panel.restore")
            : t("panel.minimize")
        }
        hasBadge={isMinimized && hasUnreadReply}
        icon={isMinimized ? ChevronUpIcon : MinusIcon}
        onClick={toggleMinimized}
        buttonRef={minimizeRef}
      />
      {!isNarrow && (
        <HeaderButton
          label={isExpanded ? t("panel.shrink") : t("panel.expand")}
          icon={isExpanded ? Minimize2Icon : Maximize2Icon}
          onClick={toggleExpanded}
        />
      )}
      <HeaderButton label={t("panel.close")} icon={XIcon} onClick={onClose} />
    </div>
  );
}
