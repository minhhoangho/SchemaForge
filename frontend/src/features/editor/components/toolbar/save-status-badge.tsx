"use client";

import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/class-names";

import type { SaveStatus } from "../../state/create-editor-store";
import { useEditorStore } from "../../state/use-editor-store";

type Tone = { readonly text: string; readonly dot: string };

const PILL_CLASS_NAME =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-xs font-medium";

function toTone(kind: SaveStatus["kind"]): Tone {
  switch (kind) {
    case "saved":
      return { text: "text-success", dot: "bg-success" };
    case "failed":
      return { text: "text-destructive", dot: "bg-destructive" };
    case "saving":
      return { text: "text-muted-foreground", dot: "bg-muted-foreground" };
    default: {
      const unhandledKind: never = kind;
      return unhandledKind;
    }
  }
}

export type SaveStatusBadgeProps = { readonly onRetrySave: () => void };

export function SaveStatusBadge({
  onRetrySave,
}: SaveStatusBadgeProps): JSX.Element {
  const { t } = useTranslation("common");
  const kind = useEditorStore((state) => state.saveStatus.kind);
  const isFailed = kind === "failed";
  const tone = toTone(kind);

  return (
    <div className="flex items-center gap-1.5">
      <p className={cn(PILL_CLASS_NAME, tone.text)}>
        <span aria-hidden className={cn("size-1.5 rounded-full", tone.dot)} />
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
