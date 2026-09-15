import type { StructuralError } from "../error-codes.js";
import { findColumnListErrors } from "../model/column-list-errors.js";
import type { Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";

function checkIndex(
  schema: SchemaDocument,
  index: Index,
): readonly StructuralError[] {
  if (schema.tables[index.tableId] === undefined) {
    return [
      { code: "table-not-found", path: ["indexes", index.id, "tableId"] },
    ];
  }
  return findColumnListErrors(
    schema.columns,
    index.tableId,
    index.columnIds,
  ).map((error) => ({
    code: error.code,
    path: ["indexes", index.id, "columnIds", error.index],
  }));
}

export function checkIndexInvariants(
  schema: SchemaDocument,
): readonly StructuralError[] {
  return Object.values(schema.indexes).flatMap((index) =>
    checkIndex(schema, index),
  );
}

type RelationTableSide = "fromTableId" | "toTableId";
type RelationColumnSide = "fromColumnId" | "toColumnId";

function checkRelationTable(
  schema: SchemaDocument,
  relation: Relation,
  side: RelationTableSide,
): readonly StructuralError[] {
  if (schema.tables[relation[side]] !== undefined) {
    return [];
  }
  return [{ code: "table-not-found", path: ["relations", relation.id, side] }];
}

function checkRelationColumns(
  schema: SchemaDocument,
  relation: Relation,
  tableSide: RelationTableSide,
  columnSide: RelationColumnSide,
): readonly StructuralError[] {
  const tableId = relation[tableSide];
  if (schema.tables[tableId] === undefined) {
    return [];
  }
  const columnIds = relation.columnPairs.map((pair) => pair[columnSide]);
  return findColumnListErrors(schema.columns, tableId, columnIds).map(
    (error) => ({
      code: error.code,
      path: ["relations", relation.id, "columnPairs", error.index, columnSide],
    }),
  );
}

function checkRelation(
  schema: SchemaDocument,
  relation: Relation,
): readonly StructuralError[] {
  return [
    ...checkRelationTable(schema, relation, "fromTableId"),
    ...checkRelationTable(schema, relation, "toTableId"),
    ...checkRelationColumns(schema, relation, "fromTableId", "fromColumnId"),
    ...checkRelationColumns(schema, relation, "toTableId", "toColumnId"),
  ];
}

export function checkRelationInvariants(
  schema: SchemaDocument,
): readonly StructuralError[] {
  return Object.values(schema.relations).flatMap((relation) =>
    checkRelation(schema, relation),
  );
}
