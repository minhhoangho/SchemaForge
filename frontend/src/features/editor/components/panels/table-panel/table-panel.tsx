"use client";

import type { TableId } from "@schemaforge/core";
import { LinkIcon, Trash2Icon } from "lucide-react";
import type { JSX } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useEditorStore } from "../../../state/use-editor-store";
import { CommittedTextArea } from "../../committed-text-area";
import { CommittedTextField } from "../../committed-text-field";
import { ColumnList } from "./column-list";
import { IndexList } from "./index-list";
import { TablePositionFields } from "./table-position-fields";
import { useFieldErrorMessage } from "./use-field-error-message";

// The issue field of the table name, as `useFieldErrorMessage` names it.
const NAME_FIELD = "name";
const COMMENT_FIELD = "comment";
const TABLES_SEGMENT = "tables";

export type TablePanelProps = {
  readonly tableId: TableId;
  readonly onCreateRelation: (tableId: TableId) => void;
  // Deletes the table, which is the whole current selection, through the
  // editor's delete path: one dispatch, focus to the canvas, an undo toast.
  readonly onDelete: () => void;
};

/**
 * The properties panel of one selected table (spec section 2): name, comment,
 * position, columns, indexes, and the table actions. Every edit is exactly one
 * operation sent through the store's `dispatch`.
 */
export function TablePanel({
  tableId,
  onCreateRelation,
  onDelete,
}: TablePanelProps): JSX.Element | null {
  const { t } = useTranslation("editor");
  const schema = useEditorStore((state) => state.document);
  const dispatch = useEditorStore((state) => state.dispatch);
  const errorMessageOf = useFieldErrorMessage(schema);
  const baseId = useId();

  const table = schema.tables[tableId];
  if (table === undefined) {
    return null;
  }

  return (
    <div className="grid gap-5">
      <h2 className="text-sm font-semibold">{t("tablePanel.label")}</h2>
      <CommittedTextField
        id={`${baseId}-name`}
        label={t("tablePanel.nameLabel")}
        value={table.name}
        focusPath={[TABLES_SEGMENT, tableId, NAME_FIELD]}
        errorMessage={errorMessageOf(tableId, NAME_FIELD)}
        onCommit={(name) => {
          dispatch({ type: "updateTable", tableId, changes: { name } });
        }}
      />
      <CommittedTextArea
        id={`${baseId}-comment`}
        label={t("tablePanel.commentLabel")}
        value={table.comment}
        focusPath={[TABLES_SEGMENT, tableId, COMMENT_FIELD]}
        onCommit={(comment) => {
          dispatch({ type: "updateTable", tableId, changes: { comment } });
        }}
      />
      <TablePositionFields tableId={tableId} position={table.position} />
      <ColumnList tableId={tableId} />
      <IndexList tableId={tableId} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            onCreateRelation(tableId);
          }}
        >
          <LinkIcon aria-hidden />
          {t("tablePanel.addRelation")}
        </Button>
        <Button type="button" variant="destructive" onClick={onDelete}>
          <Trash2Icon aria-hidden />
          {t("tablePanel.removeTable")}
        </Button>
      </div>
    </div>
  );
}
