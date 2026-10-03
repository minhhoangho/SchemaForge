import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { MessageSquareTextIcon, TriangleAlertIcon } from "lucide-react";
import type { JSX } from "react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/class-names";

import { formatTableHandleId } from "../../lib/handle-ids";
import { getIssueIndex } from "../../lib/issue-index";
import { getTableAccentColor } from "../../lib/table-accent";
import type { TableNode as TableFlowNode } from "../../lib/to-table-nodes";
import {
  selectCanvasDocument,
  selectDiffMark,
} from "../../state/create-editor-store";
import type { DiffMark } from "../../state/create-editor-store";
import { useEditorStore } from "../../state/use-editor-store";
import { ColumnRow } from "./column-row";

type IssueBadgeProps = {
  readonly count: number;
};

function IssueBadge({ count }: IssueBadgeProps): JSX.Element {
  const { t } = useTranslation("canvas");

  return (
    <span
      role="img"
      aria-label={t("node.issueCount", { count })}
      className="flex shrink-0 items-center gap-0.5 rounded-sm bg-card px-1 text-destructive"
    >
      <TriangleAlertIcon aria-hidden className="size-3.5" />
      <span aria-hidden>{count}</span>
    </span>
  );
}

type TableCommentProps = {
  readonly comment: string;
};

function TableComment({ comment }: TableCommentProps): JSX.Element {
  const { t } = useTranslation("canvas");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="img" aria-label={t("node.comment", { comment })}>
          <MessageSquareTextIcon aria-hidden className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{comment}</TooltipContent>
    </Tooltip>
  );
}

// Diff tokens reach 3:1 only as borders and tints, never as text (plan
// issue 31); the label text keeps the card colors. A removed table is dashed
// with a tinted background instead of faded (AI-R34 "node mờ"): opacity on the
// card would drop its text below 4.5:1.
const DIFF_CARD_CLASS_NAMES = {
  added: "border-2 border-diff-added",
  changed: "border-2 border-diff-changed",
  removed: "border-2 border-dashed border-diff-removed bg-diff-removed/10",
} as const satisfies Record<DiffMark, string>;

const DIFF_LABEL_CLASS_NAMES = {
  added: "border-diff-added",
  changed: "border-diff-changed",
  removed: "border-diff-removed",
} as const satisfies Record<DiffMark, string>;

type DiffLabelProps = {
  readonly mark: DiffMark;
};

// The text says the state, so color is never the only cue (WCAG 1.4.1).
function DiffLabel({ mark }: DiffLabelProps): JSX.Element {
  const { t } = useTranslation("ai");

  return (
    <span
      className={cn(
        "shrink-0 rounded-sm border bg-card px-1 text-xs font-medium text-foreground",
        DIFF_LABEL_CLASS_NAMES[mark],
      )}
    >
      {t(`diff.${mark}`)}
    </span>
  );
}

// React Flow passes props that change on every drag frame (`dragging`,
// `positionAbsoluteX`, sizes, `zIndex`); the node reads only these two, so it
// re-renders only when one of them changes.
function isSameTableNodeProps(
  previous: NodeProps<TableFlowNode>,
  next: NodeProps<TableFlowNode>,
): boolean {
  return (
    previous.data.tableId === next.data.tableId &&
    previous.selected === next.selected
  );
}

/**
 * A table on the canvas. Its accessible name is set on the React Flow node
 * itself (`ariaLabel`), which is the element that takes keyboard focus.
 */
export const TableNode = memo(function TableNode({
  data,
  selected,
}: NodeProps<TableFlowNode>): JSX.Element | null {
  const table = useEditorStore(
    (state) => selectCanvasDocument(state).tables[data.tableId],
  );
  const diffMark = useEditorStore((state) =>
    selectDiffMark(state, data.tableId),
  );
  // Issues stay those of the document the user has (plan issue 30).
  const issueCount = useEditorStore((state) =>
    getIssueIndex(state.document).countOfTable(data.tableId),
  );

  if (table === undefined) {
    return null;
  }

  return (
    <div
      className={cn(
        "table-node-card max-w-80 min-w-56 rounded-lg border border-canvas-node-border bg-card text-xs text-card-foreground shadow-sm transition-[border-color,box-shadow] duration-150 hover:shadow-md",
        selected && "border-primary shadow-md ring-1 ring-primary",
        diffMark === null ? null : DIFF_CARD_CLASS_NAMES[diffMark],
      )}
    >
      <div
        className="relative flex h-9 items-center gap-1.5 rounded-t-[calc(var(--radius-lg)-1px)] px-3 text-[0.8125rem] font-semibold text-canvas-node-header-foreground"
        style={{ backgroundColor: getTableAccentColor(table.id) }}
      >
        <Handle
          type="source"
          position={Position.Left}
          id={formatTableHandleId(table.id, "left")}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="min-w-0 flex-1 truncate">{table.name}</span>
          </TooltipTrigger>
          <TooltipContent>{table.name}</TooltipContent>
        </Tooltip>
        {diffMark === null ? null : <DiffLabel mark={diffMark} />}
        {table.comment === "" ? null : <TableComment comment={table.comment} />}
        {issueCount > 0 ? <IssueBadge count={issueCount} /> : null}
        <Handle
          type="source"
          position={Position.Right}
          id={formatTableHandleId(table.id, "right")}
        />
      </div>
      <ul>
        {table.columnIds.map((columnId) => (
          <ColumnRow key={columnId} columnId={columnId} tableId={table.id} />
        ))}
      </ul>
    </div>
  );
}, isSameTableNodeProps);
