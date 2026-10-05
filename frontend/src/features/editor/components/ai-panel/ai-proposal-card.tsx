"use client";

import type { TFunction } from "i18next";
import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { ProposalChangeCounts } from "@/features/editor/lib/proposal-display";
import { cn } from "@/lib/class-names";

import { AI_SMALL_TEXT_CLASS_NAME } from "./ai-text-styles";
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

export function buildCountLines(
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
    <ul className="flex flex-wrap gap-1.5 text-xs">
      {buildCountLines(counts, t).map((line) => (
        <li
          key={line.text}
          // Destructive lines are bold as well as barred, so the difference
          // does not rest on the color of the bar alone.
          className={cn(
            "rounded-full border bg-background px-2 py-0.5",
            line.isDestructive
              ? "border-diff-removed font-bold text-foreground"
              : "border-border text-muted-foreground",
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
          <div className="flex items-start gap-2 rounded-lg border border-l-[3px] border-border border-l-warning bg-background p-2">
            <TriangleAlertIcon
              aria-hidden
              className="mt-0.5 size-4 text-warning"
            />
            <p id={stateId} role="status" className={AI_SMALL_TEXT_CLASS_NAME}>
              {t(`proposal.${status}`)}
            </p>
          </div>
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
        <p
          id={stateId}
          className="inline-flex items-center gap-1 self-start rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-semibold"
        >
          {status === "accepted" ? (
            <CheckIcon aria-hidden className="size-3.5 text-success" />
          ) : (
            <XIcon aria-hidden className="size-3.5 text-muted-foreground" />
          )}
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
      className={cn(
        "flex w-full flex-col gap-2.5 rounded-xl border bg-card p-2.5 text-card-foreground shadow-sm",
        body.status === "preview" ? "border-primary" : "border-border",
        (body.status === "stale" ||
          body.status === "invalid" ||
          body.status === "discarded") &&
          "bg-muted shadow-none",
      )}
    >
      <p id={titleId} className="text-sm font-semibold">
        {t("proposal.title")}
      </p>
      <StatusBody stateId={stateId} {...body} />
      {hasStoppedEarly ? (
        <p
          className={cn(
            "flex items-start gap-2 rounded-lg border border-l-[3px] border-border border-l-warning bg-background p-2",
            AI_SMALL_TEXT_CLASS_NAME,
          )}
        >
          <TriangleAlertIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
          {t("proposal.stoppedEarly")}
        </p>
      ) : null}
    </div>
  );
}
