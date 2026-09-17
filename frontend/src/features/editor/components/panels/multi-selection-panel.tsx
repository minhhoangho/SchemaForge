"use client";

import { Trash2Icon } from "lucide-react";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import type { Selection } from "../../lib/selection";

type MultiSelectionPanelProps = {
  readonly selection: Selection;
  // Deletes the whole current selection through the editor's delete path: one
  // batch, so a single undo restores everything, focus to the canvas (spec
  // section 12), and an undo toast.
  readonly onDelete: () => void;
};

/**
 * Summarises a selection of several elements and deletes them all. No
 * confirmation: it can be undone (spec section 3).
 */
export function MultiSelectionPanel({
  selection,
  onDelete,
}: MultiSelectionPanelProps): JSX.Element {
  const { t } = useTranslation("editor");
  const headingId = useId();
  const summaryId = useId();

  const summary = t("relationPanel.multiSelection.summary", {
    tables: t("relationPanel.multiSelection.tableCount", {
      count: selection.tableIds.length,
    }),
    relations: t("relationPanel.multiSelection.relationCount", {
      count: selection.relationIds.length,
    }),
  });

  return (
    <section aria-labelledby={headingId} className="grid gap-4 p-4">
      <h2 id={headingId} className="text-base font-semibold">
        {t("relationPanel.multiSelection.label")}
      </h2>
      <p id={summaryId} className="text-sm">
        {summary}
      </p>
      <Button
        variant="destructive"
        className="justify-self-start"
        aria-describedby={summaryId}
        onClick={onDelete}
      >
        <Trash2Icon aria-hidden />
        {t("relationPanel.multiSelection.deleteAll")}
      </Button>
    </section>
  );
}
