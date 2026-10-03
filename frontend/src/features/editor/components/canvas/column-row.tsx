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
import { cn } from "@/lib/class-names";

import { getForeignKeyColumnIds } from "../../lib/foreign-key-columns";
import { formatColumnType } from "../../lib/format-column-type";
import { formatColumnHandleId } from "../../lib/handle-ids";
import { getIssueIndex } from "../../lib/issue-index";
import {
  selectCanvasDocument,
  selectDiffMark,
} from "../../state/create-editor-store";
import type { DiffMark } from "../../state/create-editor-store";
import { useEditorStore } from "../../state/use-editor-store";

// Schema notation, the same in every language; the translated meaning sits
// next to each mark in screen reader text.
const UNIQUE_MARK = "U";
const AUTO_INCREMENT_MARK = "AI";
const NULLABLE_MARK = "?";
const NOT_IN_PRIMARY_KEY = -1;
const COMPOSITE_KEY_SIZE = 2;

// Diff tokens reach 3:1 only as strokes and tints, never as text (plan
// issue 31): a left bar and a light background.
const DIFF_ROW_CLASS_NAMES = {
  added: "border-l-2 border-diff-added bg-diff-added/10",
  changed: "border-l-2 border-diff-changed bg-diff-changed/10",
  removed: "border-l-2 border-diff-removed bg-diff-removed/10",
} as const satisfies Record<DiffMark, string>;

// On a tinted row the muted text falls under 4.5:1 in dark theme.
const DIFF_TEXT_CLASS_NAME = "text-foreground";

// Diff notation, the same in every language; the translated meaning sits
// next to it in screen reader text.
const DIFF_SYMBOLS = {
  added: "+",
  changed: "~",
  removed: "\u2212",
} as const satisfies Record<DiffMark, string>;

const DIFF_LABEL_KEYS = {
  added: "diff.columnAdded",
  changed: "diff.columnChanged",
  removed: "diff.columnRemoved",
} as const satisfies Record<DiffMark, string>;

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
      selectCanvasDocument(state).tables[tableId]?.primaryKeyColumnIds.indexOf(
        columnId,
      ) ?? NOT_IN_PRIMARY_KEY,
  );
  const keySize = useEditorStore(
    (state) =>
      selectCanvasDocument(state).tables[tableId]?.primaryKeyColumnIds.length ??
      0,
  );
  const isForeignKey = useEditorStore((state) =>
    getForeignKeyColumnIds(selectCanvasDocument(state).relations).has(columnId),
  );
  const isPrimaryKey = keyIndex !== NOT_IN_PRIMARY_KEY;
  const isComposite = keySize >= COMPOSITE_KEY_SIZE;
  const position = keyIndex + 1;

  return (
    <span
      // Read by the row through CSS, so the row needs no key selectors of its
      // own: the name of a key column is bold, and a column that is both keys
      // needs a wider key cell.
      className="peer flex items-center gap-0.5"
      data-primary-key={isPrimaryKey ? true : undefined}
      data-both-keys={isPrimaryKey && isForeignKey ? true : undefined}
    >
      {isPrimaryKey ? (
        <span className="flex items-center text-canvas-key">
          <KeyRoundIcon aria-hidden className="size-3.5" />
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
      ) : null}
      {isForeignKey ? (
        <span className="flex items-center text-canvas-foreign-key">
          <Link2Icon aria-hidden className="size-3.5" />
          <span className="sr-only">{t("column.foreignKey")}</span>
        </span>
      ) : null}
    </span>
  );
}

type NotationMarkProps = {
  readonly mark: string;
  readonly label: string;
  readonly className?: string;
  readonly isDiff?: boolean;
};

// `U` and `AI` sit in small chips; `?` stays inline right after the type.
const CHIP_CLASS_NAME = "rounded-sm bg-muted px-1 text-xs font-medium";

function NotationMark({
  mark,
  label,
  className,
  isDiff = false,
}: NotationMarkProps): JSX.Element {
  return (
    <span
      className={cn(
        isDiff ? DIFF_TEXT_CLASS_NAME : "text-muted-foreground",
        className,
      )}
    >
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
            className="size-3.5 text-muted-foreground"
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{comment}</TooltipContent>
    </Tooltip>
  );
}

type DiffSymbolProps = {
  readonly mark: DiffMark;
};

function DiffSymbol({ mark }: DiffSymbolProps): JSX.Element {
  const { t } = useTranslation("ai");

  return (
    <span className="shrink-0 font-mono font-semibold">
      <span aria-hidden>{DIFF_SYMBOLS[mark]}</span>
      <span className="sr-only">{t(DIFF_LABEL_KEYS[mark])}</span>
    </span>
  );
}

/** One column of a table node, with its marks and connection handles. */
export const ColumnRow = memo(function ColumnRow({
  columnId,
  tableId,
}: ColumnRowProps): JSX.Element | null {
  const { t } = useTranslation("canvas");
  const column = useEditorStore(
    (state) => selectCanvasDocument(state).columns[columnId],
  );
  const typeLabel = useEditorStore((state) => {
    const document = selectCanvasDocument(state);
    const type = document.columns[columnId]?.type;
    return type === undefined ? "" : formatColumnType(type, document.enums);
  });
  const diffMark = useEditorStore((state) => selectDiffMark(state, columnId));
  const isRemoved = diffMark === "removed";
  // Issues stay those of the document the user has (plan issue 30).
  const issueCount = useEditorStore((state) =>
    getIssueIndex(state.document).countOfElement(columnId),
  );

  if (column === undefined) {
    return null;
  }

  return (
    <li
      className={cn(
        "relative grid h-7 grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 px-3 has-data-both-keys:grid-cols-[2.25rem_minmax(0,1fr)_auto]",
        diffMark === null ? null : DIFF_ROW_CLASS_NAMES[diffMark],
      )}
    >
      <Handle
        type="source"
        position={Position.Left}
        id={formatColumnHandleId(columnId, "left")}
      />
      <KeyMarks columnId={columnId} tableId={tableId} />
      <span className="flex min-w-0 items-center gap-1 peer-data-primary-key:font-semibold">
        {diffMark === null ? null : <DiffSymbol mark={diffMark} />}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn("min-w-0 truncate", isRemoved && "line-through")}
            >
              {column.name}
            </span>
          </TooltipTrigger>
          <TooltipContent>{column.name}</TooltipContent>
        </Tooltip>
      </span>
      <span className="flex items-center gap-1">
        <span
          className={cn(
            "font-mono",
            diffMark === null ? "text-muted-foreground" : DIFF_TEXT_CLASS_NAME,
            isRemoved && "line-through",
          )}
        >
          {typeLabel}
          {column.isNullable ? (
            <NotationMark
              mark={NULLABLE_MARK}
              label={t("column.nullable")}
              isDiff={diffMark !== null}
            />
          ) : null}
        </span>
        {column.isUnique ? (
          <NotationMark
            mark={UNIQUE_MARK}
            label={t("column.unique")}
            className={CHIP_CLASS_NAME}
            isDiff={diffMark !== null}
          />
        ) : null}
        {column.isAutoIncrement ? (
          <NotationMark
            mark={AUTO_INCREMENT_MARK}
            label={t("column.autoIncrement")}
            className={CHIP_CLASS_NAME}
            isDiff={diffMark !== null}
          />
        ) : null}
        {column.comment === "" ? null : (
          <CommentMark comment={column.comment} />
        )}
        {issueCount > 0 ? (
          <span className="flex items-center text-destructive">
            <TriangleAlertIcon aria-hidden className="size-3.5" />
            <span className="sr-only">
              {t("column.issue", { count: issueCount })}
            </span>
          </span>
        ) : null}
      </span>
      <Handle
        type="source"
        position={Position.Right}
        id={formatColumnHandleId(columnId, "right")}
      />
    </li>
  );
});
