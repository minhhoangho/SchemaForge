"use client";

import type { TFunction } from "i18next";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { ProposalChangeCounts } from "@/features/editor/lib/proposal-display";
import { cn } from "@/lib/class-names";

import { AcceptProposalButton } from "./confirm-destructive-proposal-dialog";

export type ProposalCardStatus =
  "preview" | "accepted" | "discarded" | "stale" | "invalid";

export type AiProposalCardProps = {
  readonly messageId: string;
  readonly status: ProposalCardStatus;
  readonly hasStoppedEarly: boolean;
  // Not null only when status is "preview".
  readonly counts: ProposalChangeCounts | null;
  readonly onAccept: () => void;
  readonly onDiscard: () => void;
  readonly onRetry: () => void;
};

export function aiProposalCardId(messageId: string): string {
  return `ai-proposal-${messageId}`;
}

type CountLine = {
  readonly count: number;
  readonly text: string;
  readonly isDestructive: boolean;
};

function buildCountLines(
  counts: ProposalChangeCounts,
  t: TFunction<"ai">,
): readonly CountLine[] {
  const lines: readonly CountLine[] = [
    {
      count: counts.addedTables,
      text: t("proposal.counts.addedTables", { count: counts.addedTables }),
      isDestructive: false,
    },
    {
      count: counts.addedColumns,
      text: t("proposal.counts.addedColumns", { count: counts.addedColumns }),
      isDestructive: false,
    },
    {
      count: counts.changedTables,
      text: t("proposal.counts.changedTables", {
        count: counts.changedTables,
      }),
      isDestructive: false,
    },
    {
      count: counts.changedColumns,
      text: t("proposal.counts.changedColumns", {
        count: counts.changedColumns,
      }),
      isDestructive: false,
    },
    {
      count: counts.removedTables,
      text: t("proposal.counts.removedTables", {
        count: counts.removedTables,
      }),
      isDestructive: true,
    },
    {
      count: counts.removedColumns,
      text: t("proposal.counts.removedColumns", {
        count: counts.removedColumns,
      }),
      isDestructive: true,
    },
    {
      count: counts.cascadeRelations,
      text: t("proposal.counts.cascadeRelations", {
        count: counts.cascadeRelations,
      }),
      isDestructive: true,
    },
    {
      count: counts.retypedColumns,
      text: t("proposal.counts.retypedColumns", {
        count: counts.retypedColumns,
      }),
      isDestructive: true,
    },
  ];
  return lines.filter((line) => line.count > 0);
}

function CountList({
  counts,
}: {
  readonly counts: ProposalChangeCounts;
}): JSX.Element {
  const { t } = useTranslation("ai");

  return (
    <ul className="flex flex-col gap-1 text-sm">
      {buildCountLines(counts, t).map((line) => (
        <li
          key={line.text}
          // Destructive lines are bold as well as barred, so the difference
          // does not rest on the color of the bar alone.
          className={cn(
            line.isDestructive
              ? "border-l-2 border-diff-removed pl-2 font-bold text-foreground"
              : "text-muted-foreground",
          )}
        >
          {line.text}
        </li>
      ))}
    </ul>
  );
}

type StatusBodyProps = Omit<
  AiProposalCardProps,
  "messageId" | "hasStoppedEarly"
> & { readonly stateId: string };

function StatusBody({
  stateId,
  status,
  counts,
  onAccept,
  onDiscard,
  onRetry,
}: StatusBodyProps): JSX.Element {
  const { t } = useTranslation("ai");

  switch (status) {
    case "preview":
      return (
        <>
          {counts === null ? null : <CountList counts={counts} />}
          <div className="flex flex-wrap gap-2">
            {counts === null ? null : (
              <AcceptProposalButton counts={counts} onAccept={onAccept} />
            )}
            <Button variant="outline" onClick={onDiscard}>
              {t("proposal.discard")}
            </Button>
          </div>
        </>
      );
    case "stale":
    case "invalid":
      return (
        <>
          <p id={stateId} role="status" className="text-sm">
            {t(`proposal.${status}`)}
          </p>
          <div>
            <Button variant="outline" onClick={onRetry}>
              {t("proposal.retry")}
            </Button>
          </div>
        </>
      );
    case "accepted":
    case "discarded":
      return (
        <p id={stateId} className="text-sm font-medium">
          {t(`proposal.${status}`)}
        </p>
      );
  }
}

export function AiProposalCard({
  messageId,
  hasStoppedEarly,
  ...body
}: AiProposalCardProps): JSX.Element {
  const { t } = useTranslation("ai");
  const titleId = useId();
  const stateId = useId();

  return (
    <div
      id={aiProposalCardId(messageId)}
      tabIndex={-1}
      role="group"
      aria-labelledby={titleId}
      aria-describedby={body.status === "preview" ? undefined : stateId}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground"
    >
      <p id={titleId} className="text-sm font-semibold">
        {t("proposal.title")}
      </p>
      <StatusBody stateId={stateId} {...body} />
      {hasStoppedEarly ? (
        <p className="text-sm text-muted-foreground">
          {t("proposal.stoppedEarly")}
        </p>
      ) : null}
    </div>
  );
}
