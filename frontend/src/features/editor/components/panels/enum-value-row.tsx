"use client";

import type { DocumentPath } from "@schemaforge/core";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { CommittedTextField } from "../committed-text-field";

type IconButtonProps = {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly isDisabled: boolean;
  readonly onClick: () => void;
};

// Icon-only, so aria-label carries the name and the tooltip repeats it.
function IconButton({
  id,
  label,
  icon: Icon,
  isDisabled,
  onClick,
}: IconButtonProps): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="ghost"
          size="icon-xs"
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

export type EnumValueRowIds = {
  readonly field: string;
  readonly up: string;
  readonly down: string;
  readonly remove: string;
};

export type EnumValueRowProps = {
  readonly ids: EnumValueRowIds;
  readonly position: number;
  readonly value: string;
  readonly focusPath: DocumentPath;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly errorMessage: string | undefined;
  readonly onCommit: (value: string) => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onRemove: () => void;
};

/** One enum value: its field and the move up, move down and remove buttons. */
export function EnumValueRow({
  ids,
  position,
  value,
  focusPath,
  isFirst,
  isLast,
  errorMessage,
  onCommit,
  onMoveUp,
  onMoveDown,
  onRemove,
}: EnumValueRowProps): JSX.Element {
  const { t } = useTranslation("editor");
  // The value tells apart buttons of the same position in different enums;
  // an empty value gets a word, so the name never ends in "()".
  const nameValues = {
    position,
    value: value === "" ? t("leftPanel.enums.emptyValue") : value,
  };

  return (
    <li className="flex items-start gap-0.5">
      <div className="min-w-0 flex-1">
        <CommittedTextField
          id={ids.field}
          label={t("leftPanel.enums.valueLabel", { position })}
          value={value}
          focusPath={focusPath}
          isLabelHidden
          errorMessage={errorMessage}
          onCommit={onCommit}
        />
      </div>
      <IconButton
        id={ids.up}
        label={t("leftPanel.enums.moveValueUp", nameValues)}
        icon={ArrowUpIcon}
        isDisabled={isFirst}
        onClick={onMoveUp}
      />
      <IconButton
        id={ids.down}
        label={t("leftPanel.enums.moveValueDown", nameValues)}
        icon={ArrowDownIcon}
        isDisabled={isLast}
        onClick={onMoveDown}
      />
      <IconButton
        id={ids.remove}
        label={t("leftPanel.enums.removeValue", nameValues)}
        icon={XIcon}
        isDisabled={false}
        onClick={onRemove}
      />
    </li>
  );
}
