"use client";

import type { ColumnId, ColumnPair } from "@schemaforge/core";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { changePairedColumn, lookup } from "../../lib/to-relation-draft";
import { DialogSelectField } from "./dialog-select-field";
import { FieldErrorMessage } from "./field-error-message";
import {
  columnOptions,
  describedByOf,
  joinIds,
} from "./relation-dialog-fields";
import type { RelationSectionProps } from "./relation-dialog-fields";

// A row is invalid when its referenced column is unpaired or its foreign key
// column is also chosen by another row.
function isRowInvalid(
  columnPairs: readonly ColumnPair[],
  pair: ColumnPair | undefined,
): boolean {
  if (pair === undefined) {
    return true;
  }
  const fromColumnIds: readonly ColumnId[] = columnPairs.map(
    (candidate) => candidate.fromColumnId,
  );
  return (
    fromColumnIds.filter((columnId) => columnId === pair.fromColumnId).length >
    1
  );
}

/** "Use existing columns": a foreign key column for every referenced column. */
export function ColumnPairsField({
  document,
  draft,
  onChange,
  errorView,
}: RelationSectionProps): JSX.Element {
  const { t } = useTranslation("editor");
  const hintBaseId = useId();
  const options = columnOptions(document, draft.fromTableId);
  const errorIds = describedByOf(errorView);

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">
        {t("relationDialog.columnPairs.title")}
      </legend>
      {draft.referencedColumnIds.map((referencedId, index) => {
        const pair = draft.columnPairs.find(
          (candidate) => candidate.toColumnId === referencedId,
        );
        const isInvalid =
          errorIds !== undefined && isRowInvalid(draft.columnPairs, pair);
        const hintId = `${hintBaseId}-${String(index)}`;
        return (
          // Rows are positional and never reorder, and the same referenced
          // column may appear twice, so the position is the only unique key.
          <div key={`pair-${String(index)}`} className="grid gap-1">
            <DialogSelectField
              label={t("relationDialog.columnPairs.fromLabel", {
                number: index + 1,
              })}
              // An empty value shows the placeholder of an unpaired column.
              value={pair?.fromColumnId ?? ""}
              options={options}
              placeholder={t("relationDialog.columnPairs.placeholder")}
              onChange={(value) => {
                const column = lookup(document.columns, value);
                if (column !== undefined) {
                  onChange(changePairedColumn(draft, referencedId, column.id));
                }
              }}
              describedBy={joinIds([hintId, isInvalid ? errorIds : undefined])}
              isInvalid={isInvalid}
            />
            <p id={hintId} className="text-xs text-muted-foreground">
              {t("relationDialog.columnPairs.toLabel", {
                column: document.columns[referencedId]?.name ?? "",
              })}
            </p>
          </div>
        );
      })}
      <FieldErrorMessage view={errorView} />
    </fieldset>
  );
}
