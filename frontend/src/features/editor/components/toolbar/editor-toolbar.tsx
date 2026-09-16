"use client";

import {
  ArrowLeftIcon,
  MaximizeIcon,
  PlusIcon,
  Redo2Icon,
  Undo2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { LanguageSwitch } from "@/components/language-switch";
import { ThemeSwitch } from "@/components/theme-switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useSchemaCommands } from "../../hooks/use-schema-commands";
import { useViewportControls } from "../../lib/viewport-controls";
import { useEditorStore } from "../../state/use-editor-store";
import { IssueCountButton } from "./issue-count-button";
import { SaveStatusBadge } from "./save-status-badge";
import { SchemaNameButton } from "./schema-name-button";

type IconButtonProps = {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly onClick: () => void;
  readonly isDisabled?: boolean;
};

// Icon-only, so aria-label carries the whole name and the tooltip shows the
// same text to pointer users.
function IconButton({
  label,
  icon: Icon,
  onClick,
  isDisabled = false,
}: IconButtonProps): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={isDisabled}
          onClick={onClick}
        >
          <Icon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ToolbarSeparator(): JSX.Element {
  return <Separator orientation="vertical" aria-hidden className="mx-1 h-6" />;
}

function HistoryButtons(): JSX.Element {
  const { t } = useTranslation("editor");
  const canUndo = useEditorStore((state) => state.history.past.length > 0);
  const canRedo = useEditorStore((state) => state.history.future.length > 0);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  return (
    <>
      <IconButton
        label={t("toolbar.undo")}
        icon={Undo2Icon}
        isDisabled={!canUndo}
        onClick={undo}
      />
      <IconButton
        label={t("toolbar.redo")}
        icon={Redo2Icon}
        isDisabled={!canRedo}
        onClick={redo}
      />
    </>
  );
}

function ViewportButtons(): JSX.Element {
  const { t } = useTranslation("editor");
  const viewport = useViewportControls();

  return (
    <>
      <IconButton
        label={t("toolbar.zoomOut")}
        icon={ZoomOutIcon}
        onClick={() => {
          viewport.zoomOut();
        }}
      />
      <IconButton
        label={t("toolbar.zoomIn")}
        icon={ZoomInIcon}
        onClick={() => {
          viewport.zoomIn();
        }}
      />
      <IconButton
        label={t("toolbar.fitView")}
        icon={MaximizeIcon}
        onClick={() => {
          viewport.fitView();
        }}
      />
    </>
  );
}

function AddButtons(): JSX.Element {
  const { t } = useTranslation("editor");
  const { addTable, addEnum } = useSchemaCommands();

  return (
    <>
      <Button variant="ghost" onClick={addTable}>
        <PlusIcon aria-hidden />
        {t("toolbar.addTable")}
      </Button>
      <Button variant="ghost" onClick={addEnum}>
        <PlusIcon aria-hidden />
        {t("toolbar.addEnum")}
      </Button>
    </>
  );
}

function BackToListLink(): JSX.Element {
  const { t } = useTranslation("editor");
  const label = t("toolbar.backToList");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/" aria-label={label}>
            <ArrowLeftIcon aria-hidden />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export type EditorToolbarProps = { readonly onRetrySave: () => void };

/**
 * The editor's top bar, in the order of spec section 2. Its controls are
 * plain buttons in the tab order, without `role="toolbar"`, which would
 * require arrow-key navigation (spec section 12).
 */
export function EditorToolbar({
  onRetrySave,
}: EditorToolbarProps): JSX.Element {
  return (
    <div className="flex h-12 items-center gap-1 overflow-x-auto border-b border-border bg-background px-2">
      <BackToListLink />
      <SchemaNameButton />
      <ToolbarSeparator />
      <AddButtons />
      <ToolbarSeparator />
      <HistoryButtons />
      <ToolbarSeparator />
      <ViewportButtons />
      <ToolbarSeparator />
      <IssueCountButton />
      <SaveStatusBadge onRetrySave={onRetrySave} />
      <div className="ml-auto flex items-center gap-1">
        <ThemeSwitch />
        <LanguageSwitch />
      </div>
    </div>
  );
}
