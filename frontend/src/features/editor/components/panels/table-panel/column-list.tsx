"use client";

import { createColumnId } from "@schemaforge/core";
import type { ColumnId, Table, TableId } from "@schemaforge/core";
import { PlusIcon } from "lucide-react";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { DEFAULT_VARCHAR_LENGTH } from "../../../lib/column-type-options";
import { suggestColumnName } from "../../../lib/name-suggestions";
import { useEditorStore } from "../../../state/use-editor-store";
import { usePendingFocus } from "../enum-pending-focus";
import { ColumnItem } from "./column-item";
import { hasIssueUnder, useFieldErrorMessage } from "./use-field-error-message";
import type { MoveDirection } from "./list-move-focus";
import { controlId, moveFocusControl, targetIndex } from "./list-move-focus";

type ColumnListProps = {
  readonly tableId: TableId;
};

const ADD_BUTTON_CONTROL = "add";
const NAME_CONTROL = "name";
// Fields shown only inside a column's details.
const DETAIL_FIELDS = ["type", "defaultValue", "comment"] as const;

// Same source of ids as the toolbar's add table command (use-schema-commands).
function generateId(): string {
  return crypto.randomUUID();
}

// After a removal, focus goes to the column that took the removed one's place,
// or the one before it, or the add button when the table has no column left.
function neighbourAfterRemoval(
  table: Table,
  columnId: ColumnId,
): ColumnId | undefined {
  const position = table.columnIds.indexOf(columnId);
  const remaining = table.columnIds.filter((id) => id !== columnId);
  return remaining[position] ?? remaining[position - 1];
}

/**
 * The ordered column rows of a table and the "Add column" button (spec
 * section 2 "Cột"). Moving or removing a column keeps keyboard focus on a
 * control that still exists.
 */
export function ColumnList({ tableId }: ColumnListProps): JSX.Element | null {
  const { t } = useTranslation("editor");
  const schema = useEditorStore((state) => state.document);
  const dispatch = useEditorStore((state) => state.dispatch);
  const errorMessageOf = useFieldErrorMessage(schema);
  const requestFocus = usePendingFocus();
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const tableIssueId = `${baseId}-table-issue`;
  const addButtonId = controlId(baseId, tableId, ADD_BUTTON_CONTROL);

  const table = schema.tables[tableId];
  if (table === undefined) {
    return null;
  }
  const tableIssue = errorMessageOf(tableId, "columnIds");

  function addColumn(currentTable: Table): void {
    const columnId = createColumnId(generateId);
    const result = dispatch({
      type: "addColumn",
      insertAt: currentTable.columnIds.length,
      column: {
        id: columnId,
        tableId,
        name: suggestColumnName(schema, tableId),
        type: { kind: "varchar", length: DEFAULT_VARCHAR_LENGTH },
        isNullable: false,
        defaultValue: null,
        isUnique: false,
        isAutoIncrement: false,
        comment: "",
      },
    });
    if (result.isOk) {
      requestFocus(controlId(baseId, columnId, NAME_CONTROL));
    }
  }

  function moveColumn(columnId: ColumnId, direction: MoveDirection): void {
    const count = table?.columnIds.length ?? 0;
    const position = table?.columnIds.indexOf(columnId) ?? 0;
    const toIndex = targetIndex(position, direction);
    if (!dispatch({ type: "moveColumn", columnId, toIndex }).isOk) {
      return;
    }
    const control = moveFocusControl(direction, toIndex, count);
    requestFocus(controlId(baseId, columnId, control));
  }

  function removeColumn(currentTable: Table, columnId: ColumnId): void {
    const neighbour = neighbourAfterRemoval(currentTable, columnId);
    if (!dispatch({ type: "removeColumn", columnId }).isOk) {
      return;
    }
    requestFocus(
      neighbour === undefined
        ? addButtonId
        : controlId(baseId, neighbour, NAME_CONTROL),
    );
  }

  return (
    <section className="grid gap-3" aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-semibold">
        {t("tablePanel.columns.title")}
      </h3>
      {tableIssue !== undefined && (
        <p id={tableIssueId} className="text-xs text-destructive">
          {tableIssue}
        </p>
      )}
      <ol className="grid gap-2">
        {table.columnIds.map((columnId, position) => (
          <ColumnItem
            key={columnId}
            columnId={columnId}
            baseId={baseId}
            isFirst={position === 0}
            isLast={position === table.columnIds.length - 1}
            isPrimaryKey={table.primaryKeyColumnIds.includes(columnId)}
            hasDetailIssues={hasIssueUnder(schema, columnId, DETAIL_FIELDS)}
            errorMessageOf={errorMessageOf}
            onTogglePrimaryKey={(isChecked) => {
              dispatch({
                type: "setPrimaryKey",
                tableId,
                columnIds: isChecked
                  ? [...table.primaryKeyColumnIds, columnId]
                  : table.primaryKeyColumnIds.filter((id) => id !== columnId),
              });
            }}
            onMove={(direction) => {
              moveColumn(columnId, direction);
            }}
            onRemove={() => {
              removeColumn(table, columnId);
            }}
          />
        ))}
      </ol>
      <Button
        id={addButtonId}
        type="button"
        variant="outline"
        className="justify-self-start"
        onClick={() => {
          addColumn(table);
        }}
      >
        <PlusIcon aria-hidden />
        {t("tablePanel.columns.add")}
      </Button>
    </section>
  );
}
