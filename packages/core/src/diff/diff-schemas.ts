import type { Column } from "../model/column.js";
import type {
  ColumnId,
  EnumId,
  IndexId,
  RelationId,
  TableId,
} from "../model/ids.js";
import {
  sortEnums,
  sortIndexes,
  sortRelations,
  sortTables,
} from "../model/ordering.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import { isJsonEqual } from "../operations/json-equal.js";

export type ElementChanges<Id extends string> = {
  readonly added: readonly Id[];
  readonly removed: readonly Id[];
  readonly changed: readonly Id[];
};

export type SchemaDiff = {
  readonly isRenamed: boolean;
  readonly tables: ElementChanges<TableId>;
  readonly columns: ElementChanges<ColumnId>;
  readonly relations: ElementChanges<RelationId>;
  readonly indexes: ElementChanges<IndexId>;
  readonly enums: ElementChanges<EnumId>;
};

type IdentifiedElement = { readonly id: string };

// `before` and `after` are already in core order, so `added` and `changed`
// follow `after` and `removed` follows `before`.
function diffElements<Element extends IdentifiedElement>(
  before: readonly Element[],
  after: readonly Element[],
  isSame: (previous: Element, next: Element) => boolean,
): ElementChanges<Element["id"]> {
  const beforeById = new Map(before.map((element) => [element.id, element]));
  const afterIds = new Set(after.map((element) => element.id));
  const changed = after.filter((element) => {
    const previous = beforeById.get(element.id);
    return previous !== undefined && !isSame(previous, element);
  });
  return {
    added: after
      .filter((element) => !beforeById.has(element.id))
      .map((element) => element.id),
    removed: before
      .filter((element) => !afterIds.has(element.id))
      .map((element) => element.id),
    changed: changed.map((element) => element.id),
  };
}

// Added and removed columns already show up in the column diff, so only a
// reorder of the columns both sides share makes the table itself differ.
function hasSameKeptColumnOrder(previous: Table, next: Table): boolean {
  const previousIds = new Set(previous.columnIds);
  const nextIds = new Set(next.columnIds);
  return isJsonEqual(
    previous.columnIds.filter((id) => nextIds.has(id)),
    next.columnIds.filter((id) => previousIds.has(id)),
  );
}

// Position is canvas layout, not part of the schema.
function isSameTable(previous: Table, next: Table): boolean {
  return (
    isJsonEqual(
      { ...previous, position: null, columnIds: null },
      { ...next, position: null, columnIds: null },
    ) && hasSameKeptColumnOrder(previous, next)
  );
}

function sortColumns(schema: SchemaDocument): readonly Column[] {
  return sortTables(schema).flatMap((table) =>
    table.columnIds.flatMap((id) => {
      const column = schema.columns[id];
      return column === undefined ? [] : [column];
    }),
  );
}

/**
 * Compares two documents element by element, by id. Subject areas and notes
 * are not compared.
 */
export function diffSchemas(
  before: SchemaDocument,
  after: SchemaDocument,
): SchemaDiff {
  return {
    isRenamed: before.name !== after.name,
    tables: diffElements(sortTables(before), sortTables(after), isSameTable),
    columns: diffElements(sortColumns(before), sortColumns(after), isJsonEqual),
    relations: diffElements(
      sortRelations(before),
      sortRelations(after),
      isJsonEqual,
    ),
    indexes: diffElements(sortIndexes(before), sortIndexes(after), isJsonEqual),
    enums: diffElements(sortEnums(before), sortEnums(after), isJsonEqual),
  };
}
