import { toNameKey } from "../../model/name-limits.js";
import type {
  CoreIndex,
  CoreTable,
} from "../shared/dbml-core-adapter-types.js";
import {
  createImplicitForeignKeyIndexCheck,
  type ImplicitForeignKeyIndexCheck,
} from "../shared/implicit-foreign-key-index.js";
import {
  createColumnSetLookup,
  type ColumnSetLookup,
} from "./sql-column-set-lookup.js";
import type { SqlDraftContext } from "./sql-draft-context.js";
import type { SqlIndexDefinition } from "./sql-index-definitions.js";
import type {
  SqlAddedUniqueConstraint,
  SqlTableKey,
  SqlUniqueConstraint,
} from "./sql-table-keys.js";

/** The first read that is the parsed index, or null. */
export type IndexReadLookup<Read> = (
  index: CoreIndex,
  columnNames: readonly string[],
) => Read | null;

/**
 * What the scanner read again of one table, built once per table so each of
 * its indexes is matched in constant time instead of by a scan of the
 * table's reads (import / export spec, section 1).
 */
export type TableIndexLookup = {
  // The CREATE INDEX of the table.
  readonly definition: IndexReadLookup<SqlIndexDefinition>;
  // The MySQL key inside the CREATE TABLE of the table.
  readonly tableKey: IndexReadLookup<SqlTableKey>;
  readonly uniqueConstraint: ColumnSetLookup<SqlUniqueConstraint>;
  readonly addedUniqueConstraint: ColumnSetLookup<SqlAddedUniqueConstraint>;
  readonly autoIncrementColumnNames: ReadonlySet<string>;
  // The parsed indexes by the name key of their first column.
  readonly indexesByFirstColumn: ReadonlyMap<string, readonly CoreIndex[]>;
  // Name keys of the unique columns, and of the primary key columns when no
  // primary key index lists them.
  readonly keyColumnKeys: ReadonlySet<string>;
  readonly isImplicitForeignKeyIndex: ImplicitForeignKeyIndexCheck;
};

type IndexRead = {
  readonly name: string | null;
  readonly columnNames: readonly (string | null)[];
};

// A read is the parsed index by name, or by its columns in order when the
// index has no name; the first such read wins.
function createIndexReadLookup<Read>(
  reads: readonly Read[],
  toIndexRead: (read: Read) => IndexRead,
): IndexReadLookup<Read> {
  const byName = new Map<string, Read>();
  const byColumns = new Map<string, Read>();
  reads.forEach((read) => {
    const { name, columnNames } = toIndexRead(read);
    const [found, key] =
      name === null
        ? [byColumns, JSON.stringify(columnNames)]
        : [byName, toNameKey(name)];
    if (!found.has(key)) {
      found.set(key, read);
    }
  });
  return (index, columnNames) =>
    (index.name === null
      ? byColumns.get(JSON.stringify(columnNames))
      : byName.get(toNameKey(index.name))) ?? null;
}

function groupByFirstColumn(
  indexes: readonly CoreIndex[],
): ReadonlyMap<string, readonly CoreIndex[]> {
  const groups = new Map<string, CoreIndex[]>();
  indexes.forEach((index) => {
    const firstColumn = index.columns[0]?.value;
    if (firstColumn !== undefined) {
      const key = toNameKey(firstColumn);
      const group = groups.get(key) ?? [];
      group.push(index);
      groups.set(key, group);
    }
  });
  return groups;
}

// Every key of the table: its indexes (the primary key index among them),
// else the primary key columns, and its unique columns.
function listKeys(table: CoreTable): readonly (readonly string[])[] {
  const primaryKeyFields = table.indexes.some((key) => key.isPrimaryKey)
    ? []
    : table.fields.filter(({ isPrimaryKey }) => isPrimaryKey);
  return [
    ...table.indexes.map(({ columns }) => columns.map(({ value }) => value)),
    primaryKeyFields.map(({ name }) => name),
    ...table.fields
      .filter(({ isUnique }) => isUnique)
      .map(({ name }) => [name]),
  ];
}

export function createTableIndexLookup(
  table: CoreTable,
  context: SqlDraftContext,
): TableIndexLookup {
  const tableKey = toNameKey(table.name);
  const created = context.locations.tableDefinition(table.name);
  const hasPrimaryKeyIndex = table.indexes.some((key) => key.isPrimaryKey);
  return {
    definition: createIndexReadLookup(
      context.indexDefinitions.get(tableKey) ?? [],
      ({ indexName, columnNames }) => ({ name: indexName, columnNames }),
    ),
    tableKey: createIndexReadLookup(created?.keys ?? [], (key) => key),
    uniqueConstraint: createColumnSetLookup(
      created?.uniqueConstraints ?? [],
      ({ columnNames }) => columnNames,
    ),
    addedUniqueConstraint: createColumnSetLookup(
      context.addedUniqueConstraints.get(tableKey) ?? [],
      ({ constraint }) => constraint.columnNames,
    ),
    autoIncrementColumnNames: new Set(
      table.fields
        .filter(({ isIncrement }) => isIncrement)
        .map(({ name }) => name),
    ),
    indexesByFirstColumn: groupByFirstColumn(table.indexes),
    keyColumnKeys: new Set(
      table.fields
        .filter(
          ({ isUnique, isPrimaryKey }) =>
            isUnique || (isPrimaryKey && !hasPrimaryKeyIndex),
        )
        .map(({ name }) => toNameKey(name)),
    ),
    isImplicitForeignKeyIndex: createImplicitForeignKeyIndexCheck(
      context.foreignKeys.get(tableKey) ?? [],
      () => listKeys(table),
    ),
  };
}
