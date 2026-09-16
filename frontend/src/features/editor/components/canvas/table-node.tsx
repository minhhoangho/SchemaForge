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
      className="flex shrink-0 items-center gap-0.5 text-destructive"
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
        "max-w-80 min-w-48 rounded-md border border-border bg-card text-xs text-card-foreground shadow-sm in-focus-visible:ring-2 in-focus-visible:ring-foreground",
        selected && "border-primary",
      )}
    >
      <div className="relative flex items-center gap-1.5 border-b border-border px-3 py-2 font-semibold">
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
