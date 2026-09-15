import { sortByPathThenCode } from "../document-path.js";
import type { StructuralError } from "../error-codes.js";
import type { Column } from "../model/column.js";
import { findColumnListErrors } from "../model/column-list-errors.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";

import {
  checkIndexInvariants,
  checkRelationInvariants,
} from "./relation-index-invariants.js";

// A map key that differs from its element's own id, checked separately for
// each of the seven maps: the id inside the element stays authoritative for
// every other check below.
function findIdMismatches(
  mapName: string,
  entries: readonly (readonly [string, { readonly id: string }])[],
): readonly StructuralError[] {
  return entries
    .filter(([key, element]) => key !== element.id)
    .map(([key]) => ({
      code: "id-mismatch" as const,
      path: [mapName, key, "id"],
    }));
}

function checkIdMismatches(schema: SchemaDocument): readonly StructuralError[] {
  return [
    ...findIdMismatches("tables", Object.entries(schema.tables)),
    ...findIdMismatches("columns", Object.entries(schema.columns)),
    ...findIdMismatches("relations", Object.entries(schema.relations)),
    ...findIdMismatches("indexes", Object.entries(schema.indexes)),
    ...findIdMismatches("enums", Object.entries(schema.enums)),
    ...findIdMismatches("subjectAreas", Object.entries(schema.subjectAreas)),
    ...findIdMismatches("notes", Object.entries(schema.notes)),
  ];
}

// A table's columnIds, once ids that do not exist are dropped, must equal
// (as a set, no repeats) the set of columns whose tableId is this table.
function hasOwnershipMismatch(
  existingColumnIds: readonly string[],
  ownedColumnIds: readonly string[],
): boolean {
  const existingIdSet = new Set(existingColumnIds);
  if (existingIdSet.size !== existingColumnIds.length) {
    return true;
  }
  const ownedIdSet = new Set(ownedColumnIds);
  if (existingIdSet.size !== ownedIdSet.size) {
    return true;
  }
  return [...existingIdSet].some((columnId) => !ownedIdSet.has(columnId));
}

function checkTableColumnIds(
  schema: SchemaDocument,
  table: Table,
): readonly StructuralError[] {
  const errors: StructuralError[] = [];
  const existingColumnIds: string[] = [];
  table.columnIds.forEach((columnId, index) => {
    if (schema.columns[columnId] === undefined) {
      errors.push({
        code: "column-not-found",
        path: ["tables", table.id, "columnIds", index],
      });
      return;
    }
    existingColumnIds.push(columnId);
  });
  const ownedColumnIds = Object.values(schema.columns)
    .filter((column) => column.tableId === table.id)
    .map((column) => column.id);
  if (hasOwnershipMismatch(existingColumnIds, ownedColumnIds)) {
    errors.push({
      code: "column-ownership-mismatch",
      path: ["tables", table.id, "columnIds"],
    });
  }
  return errors;
}

function checkTablePrimaryKey(
  schema: SchemaDocument,
  table: Table,
): readonly StructuralError[] {
  return findColumnListErrors(
    schema.columns,
    table.id,
    table.primaryKeyColumnIds,
  ).map((error) => ({
    code: error.code,
    path: ["tables", table.id, "primaryKeyColumnIds", error.index],
  }));
}

function checkTableSubjectArea(
  schema: SchemaDocument,
  table: Table,
): readonly StructuralError[] {
  if (table.subjectAreaId === null) {
    return [];
  }
  if (schema.subjectAreas[table.subjectAreaId] !== undefined) {
    return [];
  }
  return [
    {
      code: "subject-area-not-found",
      path: ["tables", table.id, "subjectAreaId"],
    },
  ];
}

function checkTableInvariants(
  schema: SchemaDocument,
): readonly StructuralError[] {
  return Object.values(schema.tables).flatMap((table) => [
    ...checkTableColumnIds(schema, table),
    ...checkTablePrimaryKey(schema, table),
    ...checkTableSubjectArea(schema, table),
  ]);
}

function checkColumnTable(
  schema: SchemaDocument,
  column: Column,
): readonly StructuralError[] {
  if (schema.tables[column.tableId] !== undefined) {
    return [];
  }
  return [{ code: "table-not-found", path: ["columns", column.id, "tableId"] }];
}

function checkColumnEnum(
  schema: SchemaDocument,
  column: Column,
): readonly StructuralError[] {
  if (column.type.kind !== "enum") {
    return [];
  }
  if (schema.enums[column.type.enumId] !== undefined) {
    return [];
  }
  return [
    { code: "enum-not-found", path: ["columns", column.id, "type", "enumId"] },
  ];
}

function checkColumnInvariants(
  schema: SchemaDocument,
): readonly StructuralError[] {
  return Object.values(schema.columns).flatMap((column) => [
    ...checkColumnTable(schema, column),
    ...checkColumnEnum(schema, column),
  ]);
}

export function checkStructuralInvariants(
  schema: SchemaDocument,
): readonly StructuralError[] {
  return sortByPathThenCode([
    ...checkIdMismatches(schema),
    ...checkTableInvariants(schema),
    ...checkColumnInvariants(schema),
    ...checkIndexInvariants(schema),
    ...checkRelationInvariants(schema),
  ]);
}
