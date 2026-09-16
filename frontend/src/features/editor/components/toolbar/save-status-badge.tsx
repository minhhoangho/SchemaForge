"use client";

import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useEditorStore } from "../../state/use-editor-store";

export type SaveStatusBadgeProps = { readonly onRetrySave: () => void };

export function SaveStatusBadge({
  onRetrySave,
}: SaveStatusBadgeProps): JSX.Element {
  const { t } = useTranslation("common");
  const kind = useEditorStore((state) => state.saveStatus.kind);
  const isFailed = kind === "failed";

  return (
    <div className="flex items-center gap-1.5">
      <p
        className={
          isFailed
            ? "text-sm text-destructive"
            : "text-sm text-muted-foreground"
        }
      >
        {t(`saveStatus.${kind}`)}
      </p>
      {/* Always mounted, so screen readers announce a failure when the text
          appears (WCAG 4.1.3). "Saving" and "saved" stay out of it: they
          change on every autosave and would interrupt constantly. */}
      <span role="status" className="sr-only">
        {isFailed ? t("saveStatus.failed") : ""}
      </span>
      {isFailed && (
        <Button variant="outline" size="sm" onClick={onRetrySave}>
          {t("actions.retry")}
        </Button>
      )}
    </div>
  );
}
