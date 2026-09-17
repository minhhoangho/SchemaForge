"use client";

import type { ColumnId, OperationError } from "@schemaforge/core";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { changeReferencedColumn, lookup } from "../../lib/to-relation-draft";
import { DialogSelectField } from "./dialog-select-field";
import { FieldErrorMessage } from "./field-error-message";
import { columnOptions, describedByOf } from "./relation-dialog-fields";
import type { RelationSectionProps } from "./relation-dialog-fields";

// The row core pointed at, as in `["referencedColumnIds", 1]`.
function rejectedRowOf(buildError: OperationError | null): number | undefined {
  const rowIndex = buildError?.path[1];
  return buildError?.path[0] === "referencedColumnIds" &&
    typeof rowIndex === "number"
    ? rowIndex
    : undefined;
}

function isChosenTwice(
  columnIds: readonly ColumnId[],
  columnId: ColumnId,
): boolean {
  return columnIds.filter((candidate) => candidate === columnId).length > 1;
}

/** One select per referenced column of the referenced table. */
export function ReferencedColumnsField({
  document,
  draft,
  buildError,
  onChange,
  errorView,
}: RelationSectionProps): JSX.Element {
  const { t } = useTranslation("editor");
  const options = columnOptions(document, draft.toTableId);
  const describedBy = describedByOf(errorView);
  const rejectedRow = rejectedRowOf(buildError);

  return (
    <fieldset className="grid gap-2" aria-describedby={describedBy}>
      <legend className="mb-2 text-sm font-medium">
        {t("relationDialog.referencedColumns")}
      </legend>
      {draft.referencedColumnIds.map((columnId, index) => {
        const isInvalid =
          isChosenTwice(draft.referencedColumnIds, columnId) ||
          rejectedRow === index;
        return (
          <DialogSelectField
            // Rows are positional and never reorder, and the same column may
            // be chosen twice, so the position is the only unique key.
            key={`referenced-${String(index)}`}
            label={t("relationDialog.referencedColumnLabel", {
              number: index + 1,
            })}
            value={columnId}
            options={options}
            onChange={(value) => {
              const column = lookup(document.columns, value);
              if (column !== undefined) {
                onChange(changeReferencedColumn(draft, index, column.id));
              }
            }}
            describedBy={isInvalid ? describedBy : undefined}
            isInvalid={isInvalid}
          />
        );
      })}
      <FieldErrorMessage view={errorView} />
    </fieldset>
  );
}
