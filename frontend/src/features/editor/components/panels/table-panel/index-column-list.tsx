"use client";

import type { Column, ColumnId, Index } from "@schemaforge/core";
import { ArrowDownIcon, ArrowUpIcon, XIcon } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useEditorStore } from "../../../state/use-editor-store";
import { IconActionButton } from "./icon-action-button";
import { useDisplayName } from "./use-display-name";
import type { MoveDirection } from "./list-move-focus";
import { controlId, moveFocusControl, targetIndex } from "./list-move-focus";

type IndexColumnListProps = {
  readonly index: Index;
  readonly baseId: string;
  readonly requestFocus: (elementId: string) => void;
};

// The select always shows its placeholder: picking a column adds it at once.
const NO_SELECTION = "";

function moveColumnId(
  columnIds: readonly ColumnId[],
  position: number,
  toIndex: number,
): readonly ColumnId[] {
  const moved = columnIds[position];
  if (moved === undefined) {
    return columnIds;
  }
  return columnIds.toSpliced(position, 1).toSpliced(toIndex, 0, moved);
}

/**
 * The ordered columns of an index with move and remove buttons, and a select
 * that adds a column not in the index yet (spec section 2 "Index"). The last
 * column cannot be removed: an index without columns is structurally invalid.
 */
export function IndexColumnList({
  index,
  baseId,
  requestFocus,
}: IndexColumnListProps): JSX.Element {
  const { t } = useTranslation("editor");
  const displayName = useDisplayName();
  const columns = useEditorStore((state) => state.document.columns);
  const tableColumnIds = useEditorStore(
    (state) => state.document.tables[index.tableId]?.columnIds,
  );
  const dispatch = useEditorStore((state) => state.dispatch);
  const indexId = index.id;
  const labelId = controlId(baseId, indexId, "columns-label");
  const selectId = controlId(baseId, indexId, "add-column");
  const count = index.columnIds.length;
  const available = (tableColumnIds ?? [])
    .filter((columnId) => !index.columnIds.includes(columnId))
    .map((columnId) => columns[columnId])
    .filter((column): column is Column => column !== undefined);

  function update(columnIds: readonly ColumnId[]): boolean {
    return dispatch({ type: "updateIndex", indexId, changes: { columnIds } })
      .isOk;
  }

  function move(columnId: ColumnId, direction: MoveDirection): void {
    const position = index.columnIds.indexOf(columnId);
    const toIndex = targetIndex(position, direction);
    if (update(moveColumnId(index.columnIds, position, toIndex))) {
      const control = moveFocusControl(direction, toIndex, count);
      requestFocus(controlId(baseId, `${indexId}-${columnId}`, control));
    }
  }

  function add(value: string): void {
    const column = available.find((candidate) => candidate.id === value);
    if (column === undefined || !update([...index.columnIds, column.id])) {
      return;
    }
    // With nothing left to add the select disappears, so focus moves to the
    // added column, whose move up button is enabled.
    requestFocus(
      available.length > 1
        ? selectId
        : controlId(baseId, `${indexId}-${column.id}`, "moveUp"),
    );
  }

  return (
    <div className="grid gap-2">
      <span id={labelId} className="text-sm font-medium">
        {t("tablePanel.indexes.columnsLabel")}
      </span>
      <ol aria-labelledby={labelId} className="grid gap-1">
        {index.columnIds.map((columnId, position) => {
          const itemId = `${indexId}-${columnId}`;
          const values = {
            column: displayName(columns[columnId]?.name ?? ""),
            index: displayName(index.name),
          };
          return (
            <li key={columnId} className="flex items-center gap-1">
              <span
                className="min-w-0 flex-1 truncate text-sm"
                title={values.column}
              >
                {values.column}
              </span>
              <IconActionButton
                id={controlId(baseId, itemId, "moveUp")}
                label={t("tablePanel.indexes.moveUp", values)}
                icon={<ArrowUpIcon aria-hidden />}
                isDisabled={position === 0}
                onClick={() => {
                  move(columnId, "up");
                }}
              />
              <IconActionButton
                id={controlId(baseId, itemId, "moveDown")}
                label={t("tablePanel.indexes.moveDown", values)}
                icon={<ArrowDownIcon aria-hidden />}
                isDisabled={position === count - 1}
                onClick={() => {
                  move(columnId, "down");
                }}
              />
              <IconActionButton
                id={controlId(baseId, itemId, "remove")}
                label={t("tablePanel.indexes.removeColumn", values)}
                icon={<XIcon aria-hidden />}
                isDisabled={count === 1}
                onClick={() => {
                  if (update(index.columnIds.filter((id) => id !== columnId))) {
                    requestFocus(selectId);
                  }
                }}
              />
            </li>
          );
        })}
      </ol>
      {count === 1 && (
        <p className="text-xs text-muted-foreground">
          {t("tablePanel.indexes.lastColumn")}
        </p>
      )}
      {available.length > 0 && (
        <div className="grid gap-1">
          <Label htmlFor={selectId}>{t("tablePanel.indexes.addColumn")}</Label>
          <Select value={NO_SELECTION} onValueChange={add}>
            <SelectTrigger id={selectId} className="w-full">
              <SelectValue placeholder={t("tablePanel.indexes.chooseColumn")} />
            </SelectTrigger>
            <SelectContent position="popper">
              {available.map((column) => (
                <SelectItem key={column.id} value={column.id}>
                  {column.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
