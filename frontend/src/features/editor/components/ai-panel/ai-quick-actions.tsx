"use client";

import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/class-names";

export type AiQuickActionsProps = {
  readonly isDisabled: boolean;
  readonly onSend: (text: string) => void;
  // "large": chips that wrap, for an empty conversation. "compact": one row
  // that scrolls sideways above the composer once a conversation exists.
  readonly variant?: "large" | "compact";
};

const ACTIONS = ["improve", "explain", "findIssues", "sampleData"] as const;

export function AiQuickActions({
  isDisabled,
  onSend,
  variant = "large",
}: AiQuickActionsProps): JSX.Element {
  const { t } = useTranslation("ai");
  const labelId = useId();
  const isCompact = variant === "compact";

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn(
        "flex gap-2",
        // The padding (offset by the margin) keeps the buttons' focus ring
        // and its offset inside the scroller, which clips them otherwise.
        isCompact ? "-m-1 overflow-x-auto p-1" : "flex-wrap justify-center",
      )}
    >
      <span id={labelId} className="sr-only">
        {t("quickActions.label")}
      </span>
      {ACTIONS.map((action) => (
        <Button
          key={action}
          variant="outline"
          size={isCompact ? "sm" : "default"}
          className={cn("rounded-full", isCompact ? "px-3" : "px-3.5")}
          disabled={isDisabled}
          onClick={() => {
            onSend(t(`quickActions.${action}Message`));
          }}
        >
          {t(`quickActions.${action}`)}
        </Button>
      ))}
    </div>
  );
}
