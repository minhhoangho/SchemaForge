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
  const table = useEditorStore((state) => state.document.tables[data.tableId]);
  const issueCount = useEditorStore((state) =>
    getIssueIndex(state.document).countOfTable(data.tableId),
  );

  if (table === undefined) {
    return null;
  }

  return (
    <div
      className={cn(
        "table-node-card max-w-80 min-w-56 overflow-hidden rounded-lg border border-canvas-node-border bg-card text-xs text-card-foreground shadow-sm transition-[border-color,box-shadow] duration-150 hover:shadow-md",
        selected && "border-primary shadow-md ring-1 ring-primary",
      )}
    >
      <div
        className="relative flex h-9 items-center gap-1.5 px-3 text-[0.8125rem] font-semibold text-canvas-node-header-foreground"
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
