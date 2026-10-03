"use client";

import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export type AiQuickActionsProps = {
  readonly isDisabled: boolean;
  readonly onSend: (text: string) => void;
};

const ACTIONS = ["improve", "explain", "findIssues", "sampleData"] as const;

export function AiQuickActions({
  isDisabled,
  onSend,
}: AiQuickActionsProps): JSX.Element {
  const { t } = useTranslation("ai");
  const labelId = useId();

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-wrap gap-2"
    >
      <span id={labelId} className="sr-only">
        {t("quickActions.label")}
      </span>
      {ACTIONS.map((action) => (
        <Button
          key={action}
          variant="outline"
          size="sm"
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
