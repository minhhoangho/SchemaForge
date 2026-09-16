import type { ColumnId, TableId } from "@schemaforge/core";
import { Handle, Position } from "@xyflow/react";
import {
  KeyRoundIcon,
  Link2Icon,
  MessageSquareTextIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { JSX } from "react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { getForeignKeyColumnIds } from "../../lib/foreign-key-columns";
import { formatColumnType } from "../../lib/format-column-type";
import { formatColumnHandleId } from "../../lib/handle-ids";
import { getIssueIndex } from "../../lib/issue-index";
import { useEditorStore } from "../../state/use-editor-store";

// Schema notation, the same in every language; the translated meaning sits
// next to each mark in screen reader text.
const UNIQUE_MARK = "U";
const AUTO_INCREMENT_MARK = "AI";
const NULLABLE_MARK = "?";
const NOT_IN_PRIMARY_KEY = -1;
const COMPOSITE_KEY_SIZE = 2;

export type ColumnRowProps = {
  readonly columnId: ColumnId;
  readonly tableId: TableId;
};

type KeyMarksProps = {
  readonly columnId: ColumnId;
  readonly tableId: TableId;
};

function KeyMarks({ columnId, tableId }: KeyMarksProps): JSX.Element {
  const { t } = useTranslation("canvas");
  const keyIndex = useEditorStore(
    (state) =>
      state.document.tables[tableId]?.primaryKeyColumnIds.indexOf(columnId) ??
      NOT_IN_PRIMARY_KEY,
  );
  const keySize = useEditorStore(
    (state) => state.document.tables[tableId]?.primaryKeyColumnIds.length ?? 0,
  );
  const isForeignKey = useEditorStore((state) =>
    getForeignKeyColumnIds(state.document.relations).has(columnId),
  );
  const isComposite = keySize >= COMPOSITE_KEY_SIZE;
  const position = keyIndex + 1;

  return (
    <span className="flex w-9 shrink-0 items-center gap-0.5">
      {keyIndex === NOT_IN_PRIMARY_KEY ? null : (
        <span className="flex items-center text-canvas-key">
          <KeyRoundIcon aria-hidden className="size-3" />
          {isComposite ? (
            // The amber key color is too light for text (WCAG 1.4.3), so the
            // digit uses the regular text color.
            <span aria-hidden className="text-foreground">
              {position}
            </span>
          ) : null}
          <span className="sr-only">
            {isComposite
              ? t("column.primaryKeyPosition", { position })
              : t("column.primaryKey")}
          </span>
        </span>
      )}
      {isForeignKey ? (
        <span className="flex items-center text-canvas-foreign-key">
          <Link2Icon aria-hidden className="size-3" />
          <span className="sr-only">{t("column.foreignKey")}</span>
        </span>
      ) : null}
    </span>
  );
}

type NotationMarkProps = {
  readonly mark: string;
  readonly label: string;
};

function NotationMark({ mark, label }: NotationMarkProps): JSX.Element {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden>{mark}</span>
      {/* The space keeps the mark a separate word after the type name, so a
          screen reader does not read "varchar(255)Nullable". */}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

type CommentMarkProps = {
  readonly comment: string;
};

function CommentMark({ comment }: CommentMarkProps): JSX.Element {
  const { t } = useTranslation("canvas");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="img" aria-label={t("node.comment", { comment })}>
          <MessageSquareTextIcon
            aria-hidden
            className="size-3 text-muted-foreground"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{comment}</TooltipContent>
    </Tooltip>
  );
}

/** One column of a table node, with its marks and connection handles. */
export const ColumnRow = memo(function ColumnRow({
  columnId,
  tableId,
}: ColumnRowProps): JSX.Element | null {
  const { t } = useTranslation("canvas");
  const column = useEditorStore((state) => state.document.columns[columnId]);
  const typeLabel = useEditorStore((state) => {
    const type = state.document.columns[columnId]?.type;
    return type === undefined
      ? ""
      : formatColumnType(type, state.document.enums);
  });
  const issueCount = useEditorStore((state) =>
    getIssueIndex(state.document).countOfElement(columnId),
  );

  if (column === undefined) {
    return null;
  }

  return (
    <li className="relative flex items-center gap-2 px-3 py-1">
      <Handle
        type="source"
        position={Position.Left}
        id={formatColumnHandleId(columnId, "left")}
      />
      <KeyMarks columnId={columnId} tableId={tableId} />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 flex-1 truncate">{column.name}</span>
        </TooltipTrigger>
        <TooltipContent>{column.name}</TooltipContent>
      </Tooltip>
      <span className="shrink-0 font-mono text-muted-foreground">
        {typeLabel}
        {column.isNullable ? (
          <NotationMark mark={NULLABLE_MARK} label={t("column.nullable")} />
        ) : null}
      </span>
      {column.isUnique ? (
        <NotationMark mark={UNIQUE_MARK} label={t("column.unique")} />
      ) : null}
      {column.isAutoIncrement ? (
        <NotationMark
          mark={AUTO_INCREMENT_MARK}
          label={t("column.autoIncrement")}
        />
      ) : null}
      {column.comment === "" ? null : <CommentMark comment={column.comment} />}
      {issueCount > 0 ? (
        <span className="flex items-center text-destructive">
          <TriangleAlertIcon aria-hidden className="size-3" />
          <span className="sr-only">
            {t("column.issue", { count: issueCount })}
          </span>
        </span>
      ) : null}
      <Handle
        type="source"
        position={Position.Right}
        id={formatColumnHandleId(columnId, "right")}
      />
    </li>
  );
});
