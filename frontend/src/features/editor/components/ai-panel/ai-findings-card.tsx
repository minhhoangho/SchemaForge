"use client";

import type { AiFindingsData } from "@schemaforge/api-contract";
import type { ColumnId, TableId } from "@schemaforge/core";
import { LightbulbIcon, TriangleAlertIcon } from "lucide-react";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/features/editor/state/use-editor-store";
import { cn } from "@/lib/class-names";

import { AI_SMALL_TEXT_CLASS_NAME } from "./ai-text-styles";

type Finding = AiFindingsData["findings"][number];
type Target = { readonly tableId: TableId; readonly columnId: ColumnId | null };

export type AiFindingsCardProps = {
  readonly findings: AiFindingsData["findings"];
  // A turn is running.
  readonly isDisabled: boolean;
  readonly onApply: (message: string) => void;
  readonly onRevealTarget: (target: Target) => void;
};

type TargetButtonProps = {
  // The contract carries plain strings; the branded ids come from the document.
  readonly target: Finding["targets"][number];
  readonly onReveal: AiFindingsCardProps["onRevealTarget"];
};

function TargetButton({ target, onReveal }: TargetButtonProps): JSX.Element {
  const { t } = useTranslation("ai");
  const table = useEditorStore((state) =>
    Object.values(state.document.tables).find(
      (candidate) => candidate.id === target.tableId,
    ),
  );
  const column = useEditorStore((state) =>
    Object.values(state.document.columns).find(
      (candidate) => candidate.id === target.columnId,
    ),
  );

  if (
    table === undefined ||
    (target.columnId !== null && column === undefined)
  ) {
    return (
      <Button variant="outline" size="sm" disabled>
        {t("findings.targetUnavailable")}
      </Button>
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        onReveal({ tableId: table.id, columnId: column?.id ?? null });
      }}
    >
      {column === undefined ? table.name : `${table.name}.${column.name}`}
    </Button>
  );
}

type FindingItemProps = Omit<AiFindingsCardProps, "findings"> & {
  readonly finding: Finding;
};

function FindingItem({
  finding,
  isDisabled,
  onApply,
  onRevealTarget,
}: FindingItemProps): JSX.Element {
  const { t } = useTranslation("ai");
  const { title, detail } = finding;
  const isIssue = finding.kind === "issue";

  return (
    <li className="flex flex-col items-start gap-1.5 rounded-lg border border-border bg-background p-2 text-foreground">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1 font-semibold">
          {isIssue ? (
            <TriangleAlertIcon
              aria-hidden
              className="size-3.5 text-destructive"
            />
          ) : (
            <LightbulbIcon aria-hidden className="size-3.5 text-warning" />
          )}
          {t(`findings.kinds.${finding.kind}`)}
        </span>
        <span className="rounded-full border border-border bg-secondary px-2 text-secondary-foreground">
          {t(`findings.categories.${finding.category}`)}
        </span>
      </p>
      <p className="text-sm font-semibold">{title}</p>
      <p
        className={cn(
          AI_SMALL_TEXT_CLASS_NAME,
          "whitespace-pre-wrap text-muted-foreground",
        )}
      >
        {detail}
      </p>
      {finding.targets.length === 0 ? null : (
        <div className="flex flex-wrap gap-2">
          {finding.targets.map((target) => (
            <TargetButton
              key={`${target.tableId}/${target.columnId ?? ""}`}
              target={target}
              onReveal={onRevealTarget}
            />
          ))}
        </div>
      )}
      <div>
        <Button
          disabled={isDisabled}
          onClick={() => {
            onApply(
              isIssue
                ? t("findings.fixMessage", { title, detail })
                : t("findings.applyMessage", { title, detail }),
            );
          }}
        >
          {isIssue ? t("findings.fixForMe") : t("findings.apply")}
        </Button>
      </div>
    </li>
  );
}

export function AiFindingsCard({
  findings,
  ...handlers
}: AiFindingsCardProps): JSX.Element {
  const { t } = useTranslation("ai");
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="flex w-full flex-col gap-2.5 rounded-xl border border-border bg-card p-2.5 text-card-foreground shadow-sm"
    >
      <h3 id={titleId} className="text-sm font-semibold">
        {t("findings.title")}
      </h3>
      <ul className="flex flex-col gap-2">
        {findings.map((finding) => (
          <FindingItem
            key={`${finding.kind}/${finding.title}/${finding.detail}`}
            finding={finding}
            {...handlers}
          />
        ))}
      </ul>
    </section>
  );
}
