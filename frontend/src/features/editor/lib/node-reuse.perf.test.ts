import type { SchemaDocument, Table } from "@schemaforge/core";
import { applyOperation } from "@schemaforge/core";
import { unwrapOk } from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { makeLargeSchema, STANDARD_LARGE_SCHEMA } from "@/testing/large-schema";

import { getIssueIndex } from "./issue-index";
import { EMPTY_SELECTION } from "./selection";
import type { RelationEdge } from "./to-relation-edges";
import { toRelationEdges } from "./to-relation-edges";
import type { TableNode } from "./to-table-nodes";
import { toTableNodes } from "./to-table-nodes";

// Far below every other table, so the edges of the moved table flip handle
// sides while the rest of the canvas stays put.
const MOVED_POSITION = { x: 5000, y: 5000 };

type Scenario = {
  readonly before: SchemaDocument;
  readonly after: SchemaDocument;
  readonly movedTable: Table;
};

function createScenario(): Scenario {
  const before = makeLargeSchema(STANDARD_LARGE_SCHEMA);
  const [movedTable] = Object.values(before.tables);
  if (movedTable === undefined) {
    throw new Error("The standard large schema has no table.");
  }
  const after = unwrapOk(
    applyOperation(before, {
      type: "moveElements",
      moves: [{ elementId: movedTable.id, position: MOVED_POSITION }],
    }),
  ).schema;
  return { before, after, movedTable };
}

function deriveNodes(
  document: SchemaDocument,
  previousNodes: readonly TableNode[],
): readonly TableNode[] {
  return toTableNodes({
    tables: document.tables,
    selection: EMPTY_SELECTION,
    dragPositions: {},
    previousNodes,
  });
}

function deriveEdges(
  document: SchemaDocument,
  previousEdges: readonly RelationEdge[],
): readonly RelationEdge[] {
  return toRelationEdges({
    relations: document.relations,
    tables: document.tables,
    selection: EMPTY_SELECTION,
    issueIndex: getIssueIndex(document),
    previousEdges,
  });
}

describe("node and edge reuse on the standard large schema", () => {
  it("keeps the node objects of the other tables after one table changed", () => {
    const { before, after, movedTable } = createScenario();
    const previousNodes = deriveNodes(before, []);

    const nextNodes = deriveNodes(after, previousNodes);
    const previousById = new Map(previousNodes.map((node) => [node.id, node]));
    const otherNodes = nextNodes.filter((node) => node.id !== movedTable.id);

    expect(otherNodes).toHaveLength(99);
    for (const node of otherNodes) {
      expect(node).toBe(previousById.get(node.id));
    }
    expect(
      nextNodes.find((node) => node.id === movedTable.id)?.position,
    ).toEqual(MOVED_POSITION);
  });

  it("keeps the edge objects that do not touch the changed table", () => {
    const { before, after, movedTable } = createScenario();
    const previousEdges = deriveEdges(before, []);

    const nextEdges = deriveEdges(after, previousEdges);
    const previousById = new Map(previousEdges.map((edge) => [edge.id, edge]));
    const untouchedEdges = nextEdges.filter(
      (edge) => edge.source !== movedTable.id && edge.target !== movedTable.id,
    );

    expect(nextEdges).toHaveLength(150);
    expect(untouchedEdges.length).toBeGreaterThan(0);
    for (const edge of untouchedEdges) {
      expect(edge).toBe(previousById.get(edge.id));
    }
  });
});
