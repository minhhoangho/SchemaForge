"use client";

import { Trash2Icon } from "lucide-react";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { buildDeleteSelectionOperation } from "../../lib/build-delete-selection-operation";
import { EMPTY_SELECTION } from "../../lib/selection";
import type { Selection } from "../../lib/selection";
import { useEditorStore } from "../../state/use-editor-store";

type MultiSelectionPanelProps = {
  readonly selection: Selection;
  // Called after deleting and clearing the selection. The panel unmounts with
  // the selection, so the caller moves focus (to the canvas, spec section 12).
  readonly onDeleted: () => void;
};

/**
 * Summarises a selection of several elements and deletes them all as one
 * batch, so a single undo restores everything. No confirmation: it can be
 * undone (spec section 3).
 */
export function MultiSelectionPanel({
  selection,
  onDeleted,
}: MultiSelectionPanelProps): JSX.Element {
  const { t } = useTranslation("editor");
  const headingId = useId();
  const summaryId = useId();
  const dispatch = useEditorStore((state) => state.dispatch);
  const setSelection = useEditorStore((state) => state.setSelection);

  function deleteAll(): void {
    const operation = buildDeleteSelectionOperation(selection);
    // A rejected batch already reported its error and changed nothing, so the
    // selection and the panel stay.
    if (operation === null || !dispatch(operation).isOk) {
      return;
    }
    setSelection(EMPTY_SELECTION);
    onDeleted();
  }

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
        onClick={deleteAll}
      >
        <Trash2Icon aria-hidden />
        {t("relationPanel.multiSelection.deleteAll")}
      </Button>
    </section>
  );
}
