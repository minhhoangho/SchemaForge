"use client";

import type { JSX, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type IconActionButtonProps = {
  readonly id: string;
  readonly label: string;
  readonly icon: ReactNode;
  readonly onClick: () => void;
  readonly isDisabled?: boolean;
};

/**
 * An icon-only panel button (24 px, the smallest target WCAG 2.5.8 allows):
 * it has no visible text, so its name is `aria-label`, and a tooltip shows
 * the same text to pointer users.
 */
export function IconActionButton({
  id,
  label,
  icon,
  onClick,
  isDisabled = false,
}: IconActionButtonProps): JSX.Element {
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
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
