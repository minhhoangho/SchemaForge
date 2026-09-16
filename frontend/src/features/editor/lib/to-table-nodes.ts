import type {
  Position,
  SchemaDocument,
  Table,
  TableId,
} from "@schemaforge/core";
import type { Node } from "@xyflow/react";

import type { Selection } from "./selection";

export const TABLE_NODE_TYPE = "table";

export type TableNodeData = { readonly tableId: TableId };

export type TableNode = Node<TableNodeData, typeof TABLE_NODE_TYPE>;

export type ToTableNodesInput = {
  readonly tables: SchemaDocument["tables"];
  readonly selection: Selection;
  readonly dragPositions: Readonly<Partial<Record<TableId, Position>>>;
  readonly previousNodes: readonly TableNode[];
};

// Code unit order, the same comparison core uses for ids.
function compareById(left: Table, right: Table): number {
  if (left.id < right.id) {
    return -1;
  }
  return left.id > right.id ? 1 : 0;
}

function isSameNode(
  node: TableNode,
  position: Position,
  isSelected: boolean,
): boolean {
  return (
    node.position.x === position.x &&
    node.position.y === position.y &&
    node.selected === isSelected
  );
}

/**
 * Derives one React Flow node per table. A node whose position and selection
 * did not change is the previous object, and the previous array comes back
 * when every node is reused, so React Flow skips re-rendering them.
 */
export function toTableNodes({
  tables,
  selection,
  dragPositions,
  previousNodes,
}: ToTableNodesInput): readonly TableNode[] {
  const previousById = new Map(previousNodes.map((node) => [node.id, node]));
  const nodes = Object.values(tables)
    .toSorted(compareById)
    .map((table): TableNode => {
      const position = dragPositions[table.id] ?? table.position;
      const isSelected = selection.tableIds.includes(table.id);
      const previous = previousById.get(table.id);
      if (
        previous !== undefined &&
        isSameNode(previous, position, isSelected)
      ) {
        return previous;
      }
      return {
        id: table.id,
        type: TABLE_NODE_TYPE,
        position,
        selected: isSelected,
        data: { tableId: table.id },
      };
    });

  const isEveryNodeReused =
    nodes.length === previousNodes.length &&
    nodes.every((node, index) => node === previousNodes[index]);
  return isEveryNodeReused ? previousNodes : nodes;
}
