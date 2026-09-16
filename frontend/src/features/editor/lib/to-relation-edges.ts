import type {
  Relation,
  RelationId,
  RelationKind,
  SchemaDocument,
} from "@schemaforge/core";
import type { Edge } from "@xyflow/react";

import { chooseHandleSides, formatColumnHandleId } from "./handle-ids";
import type { IssueIndex } from "./issue-index";
import type { Selection } from "./selection";

export const RELATION_EDGE_TYPE = "relation";

export type RelationEdgeData = {
  readonly relationId: RelationId;
  readonly kind: RelationKind;
  readonly columnPairCount: number;
  readonly hasIssue: boolean;
};

export type RelationEdge = Edge<RelationEdgeData, typeof RELATION_EDGE_TYPE>;

export type ToRelationEdgesInput = {
  readonly relations: SchemaDocument["relations"];
  readonly tables: SchemaDocument["tables"];
  readonly selection: Selection;
  readonly issueIndex: IssueIndex;
  readonly previousEdges: readonly RelationEdge[];
};

// Code unit order, the same comparison core uses for ids.
function compareById(left: Relation, right: Relation): number {
  if (left.id < right.id) {
    return -1;
  }
  return left.id > right.id ? 1 : 0;
}

function isSameEdge(previous: RelationEdge, next: RelationEdge): boolean {
  return (
    previous.source === next.source &&
    previous.target === next.target &&
    previous.sourceHandle === next.sourceHandle &&
    previous.targetHandle === next.targetHandle &&
    previous.selected === next.selected &&
    previous.data?.kind === next.data?.kind &&
    previous.data?.columnPairCount === next.data?.columnPairCount &&
    previous.data?.hasIssue === next.data?.hasIssue
  );
}

function buildEdge(
  relation: Relation,
  { tables, selection, issueIndex }: ToRelationEdgesInput,
): RelationEdge | null {
  const fromTable = tables[relation.fromTableId];
  const toTable = tables[relation.toTableId];
  const firstPair = relation.columnPairs[0];
  // A broken document can reference a missing table or have no column pair;
  // skip the relation, never throw.
  if (
    fromTable === undefined ||
    toTable === undefined ||
    firstPair === undefined
  ) {
    return null;
  }
  const isSelfReference = fromTable.id === toTable.id;
  const sides = chooseHandleSides(fromTable.position, toTable.position);
  const targetSide = isSelfReference ? "right" : sides.target;
  return {
    id: relation.id,
    type: RELATION_EDGE_TYPE,
    source: fromTable.id,
    target: toTable.id,
    sourceHandle: formatColumnHandleId(firstPair.fromColumnId, sides.source),
    targetHandle: formatColumnHandleId(firstPair.toColumnId, targetSide),
    selected: selection.relationIds.includes(relation.id),
    data: {
      relationId: relation.id,
      kind: relation.kind,
      columnPairCount: relation.columnPairs.length,
      hasIssue: issueIndex.countOfElement(relation.id) > 0,
    },
  };
}

/**
 * Derives one React Flow edge per relation. An edge whose ends, handles,
 * selection and data did not change is the previous object, so dragging a
 * table only recreates the edges whose handles flipped side.
 */
export function toRelationEdges(
  input: ToRelationEdgesInput,
): readonly RelationEdge[] {
  const previousById = new Map(
    input.previousEdges.map((edge) => [edge.id, edge]),
  );
  const edges = Object.values(input.relations)
    .toSorted(compareById)
    .flatMap((relation): readonly RelationEdge[] => {
      const edge = buildEdge(relation, input);
      if (edge === null) {
        return [];
      }
      const previous = previousById.get(edge.id);
      return [
        previous !== undefined && isSameEdge(previous, edge) ? previous : edge,
      ];
    });

  const isEveryEdgeReused =
    edges.length === input.previousEdges.length &&
    edges.every((edge, index) => edge === input.previousEdges[index]);
  return isEveryEdgeReused ? input.previousEdges : edges;
}
