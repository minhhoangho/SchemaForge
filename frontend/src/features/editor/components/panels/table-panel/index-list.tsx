"use client";

import {
  createIndexId,
  sortIndexes,
  suggestIndexName,
} from "@schemaforge/core";
import type {
  ColumnId,
  IndexId,
  SchemaDocument,
  Table,
  TableId,
} from "@schemaforge/core";
import { PlusIcon } from "lucide-react";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useEditorStore } from "../../../state/use-editor-store";
import { usePendingFocus } from "../enum-pending-focus";
import { IndexItem } from "./index-item";
import { useFieldErrorMessage } from "./use-field-error-message";
import { controlId } from "./list-move-focus";

type IndexListProps = {
  readonly tableId: TableId;
};

const ADD_BUTTON_CONTROL = "add-index";
const NAME_CONTROL = "name";

// Same source of ids as the toolbar's add table command (use-schema-commands).
function generateId(): string {
  return crypto.randomUUID();
}

// A new index covers the primary key, or the first column when the table has
// no primary key yet (spec section 2 "Index").
function initialIndexColumns(table: Table): readonly ColumnId[] {
  if (table.primaryKeyColumnIds.length > 0) {
    return table.primaryKeyColumnIds;
  }
  const firstColumnId = table.columnIds[0];
  return firstColumnId === undefined ? [] : [firstColumnId];
}

function columnNamesOf(
  schema: SchemaDocument,
  columnIds: readonly ColumnId[],
): readonly string[] {
  return columnIds.map((columnId) => schema.columns[columnId]?.name ?? "");
}

/**
 * The indexes of a table, in `sortIndexes` order, and the "Add index" button,
 * which is disabled while the table has no column to index.
 */
export function IndexList({ tableId }: IndexListProps): JSX.Element | null {
  const { t } = useTranslation("editor");
  const schema = useEditorStore((state) => state.document);
  const dispatch = useEditorStore((state) => state.dispatch);
  const errorMessageOf = useFieldErrorMessage(schema);
  const requestFocus = usePendingFocus();
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const addButtonId = controlId(baseId, tableId, ADD_BUTTON_CONTROL);

  const table = schema.tables[tableId];
  if (table === undefined) {
    return null;
  }
  const indexes = sortIndexes(schema).filter(
    (index) => index.tableId === tableId,
  );

  function addIndex(currentTable: Table): void {
    const columnIds = initialIndexColumns(currentTable);
    const indexId = createIndexId(generateId);
    const name = suggestIndexName(schema, {
      tableName: currentTable.name,
      columnNames: columnNamesOf(schema, columnIds),
      isUnique: false,
    });
    const result = dispatch({
      type: "addIndex",
      index: { id: indexId, tableId, name, columnIds, isUnique: false },
    });
    if (result.isOk) {
      requestFocus(controlId(baseId, indexId, NAME_CONTROL));
    }
  }

  function removeIndex(indexId: IndexId): void {
    if (dispatch({ type: "removeIndex", indexId }).isOk) {
      requestFocus(addButtonId);
    }
  }

  return (
    <section className="grid gap-3" aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-semibold">
        {t("tablePanel.indexes.title")}
      </h3>
      {indexes.length > 0 && (
        <ul className="grid gap-2">
          {indexes.map((index) => (
            <IndexItem
              key={index.id}
              index={index}
              baseId={baseId}
              errorMessage={errorMessageOf(index.id, NAME_CONTROL)}
              requestFocus={requestFocus}
              onRemove={() => {
                removeIndex(index.id);
              }}
            />
          ))}
        </ul>
      )}
      <Button
        id={addButtonId}
        type="button"
        variant="outline"
        className="justify-self-start"
        disabled={table.columnIds.length === 0}
        onClick={() => {
          addIndex(table);
        }}
      >
        <PlusIcon aria-hidden />
        {t("tablePanel.indexes.add")}
      </Button>
    </section>
  );
}
