"use client";

import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/class-names";
import type { SchemaRowLabel } from "@/lib/sync/merge-schema-list";

type StatusLabel = Exclude<SchemaRowLabel, null>;

const LABEL_KEYS = {
  "not-downloaded": "schemaList.labels.notDownloaded",
  pending: "schemaList.labels.pending",
  conflict: "schemaList.labels.conflict",
  "deleted-in-cloud": "schemaList.labels.deletedInCloud",
} as const satisfies Record<StatusLabel, string>;

// Problems a user has to resolve stand out; the text alone still carries the
// meaning (WCAG 1.4.1).
const NEEDS_ATTENTION: ReadonlySet<StatusLabel> = new Set([
  "conflict",
  "deleted-in-cloud",
]);

type SchemaStatusLabelProps = {
  readonly label: StatusLabel;
};

export function SchemaStatusLabel({
  label,
}: SchemaStatusLabelProps): JSX.Element {
  const { t } = useTranslation("sync");

  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 text-xs font-medium",
        NEEDS_ATTENTION.has(label)
          ? "border-destructive text-destructive"
          : "border-border text-muted-foreground",
      )}
    >
      {t(LABEL_KEYS[label])}
    </span>
  );
}
