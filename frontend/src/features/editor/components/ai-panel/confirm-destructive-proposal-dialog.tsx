"use client";

import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ProposalChangeCounts } from "@/features/editor/lib/proposal-display";

export type AcceptProposalButtonProps = {
  readonly counts: ProposalChangeCounts;
  readonly onAccept: () => void;
};

/**
 * The Accept button of a proposal. A proposal that removes tables or columns
 * asks first; Radix puts initial focus on the cancel button, the safe choice.
 */
export function AcceptProposalButton({
  counts,
  onAccept,
}: AcceptProposalButtonProps): JSX.Element {
  const { t } = useTranslation("ai");

  if (counts.removedTables + counts.removedColumns === 0) {
    return <Button onClick={onAccept}>{t("proposal.accept")}</Button>;
  }
  const tables = t("proposal.confirmDelete.tables", {
    count: counts.removedTables,
  });
  const columns = t("proposal.confirmDelete.columns", {
    count: counts.removedColumns,
  });
  const description =
    counts.removedColumns === 0
      ? t("proposal.confirmDelete.bodyTables", { tables })
      : counts.removedTables === 0
        ? t("proposal.confirmDelete.bodyColumns", { columns })
        : t("proposal.confirmDelete.bodyTablesAndColumns", { tables, columns });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>{t("proposal.accept")}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("proposal.confirmDelete.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t("proposal.confirmDelete.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onAccept}>
            {t("proposal.confirmDelete.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
