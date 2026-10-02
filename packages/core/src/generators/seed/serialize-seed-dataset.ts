import type { Column } from "../../model/column.js";
import type { ColumnId, RelationId } from "../../model/ids.js";
import { sortRelations } from "../../model/ordering.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import type { GeneratedFile, SqlDialect } from "../shared/generator-types.js";
import { quoteSqlIdentifier } from "../shared/identifiers.js";
import { allocateMysqlNames } from "../shared/mysql-identifiers.js";
import { orderColumnPairsByReferencedKey } from "../shared/relation-graph.js";
import { renderFileContent } from "../shared/render-file.js";
import { sqlStringLiteral } from "../shared/sql-literals.js";
import type { SeedDataset, SeedRow } from "./seed-dataset.js";
import { formatSeedSqlValue } from "./seed-sql-values.js";
import {
  findDeferredSeedRelations,
  toSeedKey,
} from "./validate-seed-dataset.js";

// SQL Server accepts at most 1000 rows in one VALUES list; every dialect
// uses the same limit so the three files stay alike.
const MAX_ROWS_PER_INSERT = 1000;
const NULL_KEYWORD = "NULL";

type TableEntry = {
  readonly table: Table;
  readonly rows: readonly SeedRow[];
};

type SqlContext = {
  readonly schema: SchemaDocument;
  readonly dialect: SqlDialect;
  // Quoted, with the MySQL name the DDL uses.
  readonly columnName: (column: Column) => string;
  // Source columns of deferred relations that no other relation uses: they
  // are inserted as NULL and set by the UPDATE block.
  readonly deferredOnlyColumnIds: ReadonlySet<ColumnId>;
};

function resolveEntries(
  schema: SchemaDocument,
  dataset: SeedDataset,
): readonly TableEntry[] {
  return dataset.tables.flatMap((entry) => {
    const table = schema.tables[entry.tableId];
    return table === undefined ? [] : [{ table, rows: entry.rows }];
  });
}

function sourceColumnIds(relation: Relation): readonly ColumnId[] {
  return relation.columnPairs.map((pair) => pair.fromColumnId);
}

// A source column always belongs to its relation's fromTableId, so one set
// over every relation equals the per-table check of the spec.
function findDeferredOnlyColumnIds(
  schema: SchemaDocument,
  deferredIds: ReadonlySet<RelationId>,
): ReadonlySet<ColumnId> {
  const relations = sortRelations(schema);
  const sharedIds = new Set(
    relations
      .filter((relation) => !deferredIds.has(relation.id))
      .flatMap(sourceColumnIds),
  );
  return new Set(
    relations
      .filter((relation) => deferredIds.has(relation.id))
      .flatMap(sourceColumnIds)
      .filter((columnId) => !sharedIds.has(columnId)),
  );
}

function serializeJson(schema: SchemaDocument, dataset: SeedDataset): string {
  const tables = resolveEntries(schema, dataset).map(({ table, rows }) => ({
    table: table.name,
    rows: rows.map((row) =>
      Object.fromEntries(
        table.columnIds.flatMap((columnId) => {
          const column = schema.columns[columnId];
          const value = row[columnId];
          return column === undefined || value === undefined
            ? []
            : [[column.name, value]];
        }),
      ),
    ),
  }));
  return `${JSON.stringify(tables, null, 2)}\n`;
}

function formatRowValue(
  context: SqlContext,
  column: Column,
  row: SeedRow,
): string {
  const value = row[column.id];
  return context.deferredOnlyColumnIds.has(column.id) && value !== undefined
    ? NULL_KEYWORD
    : formatSeedSqlValue(context.dialect, column, value, context.schema.enums);
}

function chunkRows(rows: readonly SeedRow[]): readonly (readonly SeedRow[])[] {
  return Array.from(
    { length: Math.ceil(rows.length / MAX_ROWS_PER_INSERT) },
    (_chunk, index) =>
      rows.slice(
        index * MAX_ROWS_PER_INSERT,
        (index + 1) * MAX_ROWS_PER_INSERT,
      ),
  );
}

function renderInserts(
  context: SqlContext,
  tableName: string,
  columns: readonly Column[],
  rows: readonly SeedRow[],
): readonly string[] {
  if (columns.length === 0) {
    const statement =
      context.dialect === "mysql"
        ? `INSERT INTO ${tableName} () VALUES ();`
        : `INSERT INTO ${tableName} DEFAULT VALUES;`;
    return rows.map(() => statement);
  }
  const head = `INSERT INTO ${tableName} (${columns.map(context.columnName).join(", ")}) VALUES`;
  return chunkRows(rows).flatMap((chunk) => [
    head,
    ...chunk.map((row, index) => {
      const values = columns.map((column) =>
        formatRowValue(context, column, row),
      );
      const end = index === chunk.length - 1 ? ";" : ",";
      return `  (${values.join(", ")})${end}`;
    }),
  ]);
}

function renderSetval(
  context: SqlContext,
  table: Table,
  column: Column,
): string {
  const tableName = quoteSqlIdentifier("postgresql", table.name);
  // pg_get_serial_sequence parses its first argument as an SQL identifier.
  const sequence = `pg_get_serial_sequence(${sqlStringLiteral("postgresql", tableName)}, ${sqlStringLiteral("postgresql", column.name)})`;
  return `SELECT setval(${sequence}, (SELECT max(${context.columnName(column)}) FROM ${tableName}));`;
}

function renderTableBlock(
  context: SqlContext,
  { table, rows }: TableEntry,
): readonly string[] {
  if (rows.length === 0) {
    return [];
  }
  const tableName = quoteSqlIdentifier(context.dialect, table.name);
  const columns = table.columnIds.flatMap((columnId) => {
    const column = context.schema.columns[columnId];
    const isPresent = rows.some((row) => row[columnId] !== undefined);
    return column !== undefined && isPresent ? [column] : [];
  });
  const identityColumns = columns.filter((column) => column.isAutoIncrement);
  const inserts = renderInserts(context, tableName, columns, rows);
  switch (context.dialect) {
    case "postgresql":
      return [
        ...inserts,
        ...identityColumns.map((column) =>
          renderSetval(context, table, column),
        ),
      ];
    case "mysql":
      return inserts;
    case "sqlserver":
      return identityColumns.length === 0
        ? inserts
        : [
            `SET IDENTITY_INSERT ${tableName} ON;`,
            ...inserts,
            `SET IDENTITY_INSERT ${tableName} OFF;`,
          ];
    default: {
      const unreachable: never = context.dialect;
      return unreachable;
    }
  }
}

function renderAssignments(
  context: SqlContext,
  row: SeedRow,
  columnIds: readonly ColumnId[],
  separator: string,
): string {
  return columnIds
    .flatMap((columnId) => {
      const column = context.schema.columns[columnId];
      return column === undefined
        ? []
        : [
            `${context.columnName(column)} = ${formatSeedSqlValue(context.dialect, column, row[columnId], context.schema.enums)}`,
          ];
    })
    .join(separator);
}

function renderRelationUpdates(
  context: SqlContext,
  entries: readonly TableEntry[],
  relation: Relation,
): readonly string[] {
  const table = context.schema.tables[relation.fromTableId];
  const setColumnIds = orderColumnPairsByReferencedKey(context.schema, relation)
    .map((pair) => pair.fromColumnId)
    .filter((columnId) => context.deferredOnlyColumnIds.has(columnId));
  if (table === undefined || setColumnIds.length === 0) {
    return [];
  }
  const keyColumnIds = table.primaryKeyColumnIds;
  const tableName = quoteSqlIdentifier(context.dialect, table.name);
  return entries
    .filter((entry) => entry.table.id === table.id)
    .flatMap((entry) => entry.rows)
    .filter(
      (row) =>
        keyColumnIds.length > 0 &&
        toSeedKey(row, sourceColumnIds(relation)) !== null &&
        toSeedKey(row, keyColumnIds) !== null,
    )
    .map(
      (row) =>
        `UPDATE ${tableName} SET ${renderAssignments(context, row, setColumnIds, ", ")} WHERE ${renderAssignments(context, row, keyColumnIds, " AND ")};`,
    );
}

function serializeSql(
  schema: SchemaDocument,
  dataset: SeedDataset,
  dialect: SqlDialect,
): string {
  const deferredIds = findDeferredSeedRelations(schema, dataset);
  const mysqlNames = dialect === "mysql" ? allocateMysqlNames(schema) : null;
  const context: SqlContext = {
    schema,
    dialect,
    columnName: (column) =>
      quoteSqlIdentifier(
        dialect,
        mysqlNames?.columnNames.get(column.id) ?? column.name,
      ),
    deferredOnlyColumnIds: findDeferredOnlyColumnIds(
      schema,
      new Set(deferredIds),
    ),
  };
  const entries = resolveEntries(schema, dataset);
  const updates = deferredIds.flatMap((relationId) => {
    const relation = schema.relations[relationId];
    return relation === undefined
      ? []
      : renderRelationUpdates(context, entries, relation);
  });
  return renderFileContent([
    ...entries.map((entry) => renderTableBlock(context, entry)),
    updates,
  ]);
}

/**
 * Writes any dataset as `seed.sql` for one dialect or as `seed.json`
 * (spec CG-08 "Xuất"); shared with AI-06. Never throws.
 */
export function serializeSeedDataset(
  schema: SchemaDocument,
  dataset: SeedDataset,
  format: SqlDialect | "json",
): GeneratedFile {
  return format === "json"
    ? {
        fileName: "seed.json",
        language: "json",
        content: serializeJson(schema, dataset),
      }
    : {
        fileName: "seed.sql",
        language: "sql",
        content: serializeSql(schema, dataset, format),
      };
}
