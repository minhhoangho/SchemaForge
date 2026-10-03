import type { Column } from "../model/column.js";
import type { Enum } from "../model/enum.js";
import { toNameKey } from "../model/name-limits.js";
import { sortRelations } from "../model/ordering.js";
import type { Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";
import type { Table } from "../model/table.js";

/**
 * Exact name first, then case-insensitive (AI-R9). Only a single match is
 * accepted: two or more is ambiguous and treated as not found (plan issue 13).
 * Candidates are scanned as an array, never indexed by name (AI-R63).
 */
function findSingleByName<Element extends { readonly name: string }>(
  candidates: readonly Element[],
  name: string,
): Element | null {
  const exact = candidates.filter((candidate) => candidate.name === name);
  const key = toNameKey(name);
  const matches =
    exact.length > 0
      ? exact
      : candidates.filter((candidate) => toNameKey(candidate.name) === key);
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

export function findTableByName(
  schema: SchemaDocument,
  name: string,
): Table | null {
  return findSingleByName(Object.values(schema.tables), name);
}

export function findColumnByName(
  schema: SchemaDocument,
  table: Table,
  name: string,
): Column | null {
  const columns = Object.values(schema.columns).filter(
    (column) => column.tableId === table.id,
  );
  return findSingleByName(columns, name);
}

export function findEnumByName(
  schema: SchemaDocument,
  name: string,
): Enum | null {
  return findSingleByName(Object.values(schema.enums), name);
}

export function findIndexByName(
  schema: SchemaDocument,
  table: Table,
  name: string,
): Index | null {
  const indexes = Object.values(schema.indexes).filter(
    (index) => index.tableId === table.id,
  );
  return findSingleByName(indexes, name);
}

function hasSourceColumns(
  relation: Relation,
  fromColumns: readonly Column[],
): boolean {
  return (
    relation.columnPairs.length === fromColumns.length &&
    relation.columnPairs.every(
      (pair, position) => pair.fromColumnId === fromColumns[position]?.id,
    )
  );
}

/**
 * Relations from `fromTable` to `toTable` in `sortRelations` order. A non-null
 * `fromColumns` keeps only relations whose source columns are exactly that
 * list, in that order.
 */
export function findRelationsBetween(
  schema: SchemaDocument,
  fromTable: Table,
  toTable: Table,
  fromColumns: readonly Column[] | null,
): readonly Relation[] {
  return sortRelations(schema).filter(
    (relation) =>
      relation.fromTableId === fromTable.id &&
      relation.toTableId === toTable.id &&
      (fromColumns === null || hasSourceColumns(relation, fromColumns)),
  );
}
