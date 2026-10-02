import type { Column } from "../../model/column.js";
import type { ColumnId } from "../../model/ids.js";
import { sortRelations, sortTables } from "../../model/ordering.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import type { ColumnTypes } from "./dialect-constraints.js";
import {
  collectKeyColumnIds,
  listKeyConstraints,
  sqlServerKeyLimit,
  sumBytes,
} from "./dialect-constraints.js";
import type { DialectColumnType } from "./dialect-types.js";
import {
  MYSQL_BYTES_PER_CHARACTER,
  MYSQL_OTHER_TYPE_BYTES,
  resolveDialectColumnType,
  sqlServerFixedKeyBytes,
} from "./dialect-types.js";
import { createDiagnostic, finalizeDiagnostics } from "./diagnostics.js";
import type { GeneratorDiagnostic, SqlDialect } from "./generator-types.js";

export const MYSQL_MAX_ROW_BYTES = 65_535;

const MYSQL_VARCHAR_LENGTH_BYTES = 2;
// LONGTEXT, JSON and LONGBLOB count their in-row pointer only.
const MYSQL_LONG_TYPE_ROW_BYTES = 12;
const NULL_BITS_PER_BYTE = 8;

export type SchemaColumnTypes = {
  // Every column of the schema, in sortTables then columnIds order.
  readonly types: ReadonlyMap<ColumnId, DialectColumnType>;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

const MYSQL_LONG_KINDS: ReadonlySet<DialectColumnType["kind"]> = new Set([
  "text",
  "json",
  "binary",
]);

function mysqlColumnRowBytes(type: DialectColumnType): number {
  if (type.kind === "char") {
    return MYSQL_BYTES_PER_CHARACTER * type.length;
  }
  if (type.kind === "varchar" || type.kind === "keyText") {
    return MYSQL_BYTES_PER_CHARACTER * type.length + MYSQL_VARCHAR_LENGTH_BYTES;
  }
  if (MYSQL_LONG_KINDS.has(type.kind)) {
    return MYSQL_LONG_TYPE_ROW_BYTES;
  }
  return type.kind === "custom" ? 0 : MYSQL_OTHER_TYPE_BYTES;
}

/** Row size of a MySQL table (spec section 4, "Kích thước dòng trên MySQL"). */
export function mysqlRowBytes(
  types: readonly DialectColumnType[],
  nullableCount: number,
): number {
  const columnBytes = types.reduce(
    (total, type) => total + mysqlColumnRowBytes(type),
    0,
  );
  return columnBytes + Math.ceil(nullableCount / NULL_BITS_PER_BYTE);
}

function pairedColumns(
  schema: SchemaDocument,
): ReadonlyMap<ColumnId, readonly ColumnId[]> {
  const partners = new Map<ColumnId, ColumnId[]>();
  const link = (from: ColumnId, to: ColumnId): void => {
    partners.set(from, [...(partners.get(from) ?? []), to]);
  };
  for (const pair of sortRelations(schema).flatMap((r) => r.columnPairs)) {
    link(pair.fromColumnId, pair.toColumnId);
    link(pair.toColumnId, pair.fromColumnId);
  }
  return partners;
}

// Msg 1944, then Msg 1778 and 1753: every nchar of an over-long key, spread
// transitively to nchar columns paired with it through relations (spec R1, R10).
function findSqlServerNarrowedColumnIds(
  schema: SchemaDocument,
  types: ColumnTypes,
): ReadonlySet<ColumnId> {
  const isChar = (columnId: ColumnId): boolean =>
    types.get(columnId)?.kind === "char";
  const overLimitKeys = listKeyConstraints(schema).filter(
    (key) =>
      sumBytes(key.columnIds, types, sqlServerFixedKeyBytes) >
      sqlServerKeyLimit(key),
  );
  const queue = overLimitKeys.flatMap((key) => key.columnIds.filter(isChar));
  const narrowed = new Set(queue);
  const partners = pairedColumns(schema);
  // The array iterator also visits columns pushed during the loop.
  for (const columnId of queue) {
    const unvisited = (partners.get(columnId) ?? []).filter(
      (partner) => isChar(partner) && !narrowed.has(partner),
    );
    for (const partner of unvisited) {
      narrowed.add(partner);
      queue.push(partner);
    }
  }
  return narrowed;
}

function largestNonKeyTextColumn(
  table: Table,
  types: ColumnTypes,
  keyColumnIds: ReadonlySet<ColumnId>,
): ColumnId | undefined {
  let largest: { readonly id: ColumnId; readonly length: number } | undefined;
  for (const columnId of table.columnIds) {
    const type = types.get(columnId);
    const isCandidate =
      (type?.kind === "char" || type?.kind === "varchar") &&
      !keyColumnIds.has(columnId);
    if (isCandidate && type.length > (largest?.length ?? 0)) {
      largest = { id: columnId, length: type.length };
    }
  }
  return largest?.id;
}

// MySQL error 1118 (spec R13): converts the largest non-key CHAR or VARCHAR to
// LONGTEXT until the row fits; a row over the limit with key columns only stays.
function fitMysqlRow(
  schema: SchemaDocument,
  table: Table,
  types: Map<ColumnId, DialectColumnType>,
  keyColumnIds: ReadonlySet<ColumnId>,
): readonly GeneratorDiagnostic[] {
  const nullableCount = table.columnIds.filter(
    (columnId) => schema.columns[columnId]?.isNullable === true,
  ).length;
  const rowBytes = (): number =>
    mysqlRowBytes(
      table.columnIds.flatMap((columnId) => types.get(columnId) ?? []),
      nullableCount,
    );
  const diagnostics: GeneratorDiagnostic[] = [];
  while (rowBytes() > MYSQL_MAX_ROW_BYTES) {
    const columnId = largestNonKeyTextColumn(table, types, keyColumnIds);
    if (columnId === undefined) {
      break;
    }
    types.set(columnId, { kind: "text" });
    diagnostics.push(
      createDiagnostic("type-parameter-out-of-range", [
        "columns",
        columnId,
        "type",
      ]),
    );
  }
  return diagnostics;
}

type ResolvedColumn = ReturnType<typeof resolveDialectColumnType> & {
  readonly id: ColumnId;
};

function resolveColumns(
  schema: SchemaDocument,
  dialect: SqlDialect,
  keyColumnIds: ReadonlySet<ColumnId>,
): readonly ResolvedColumn[] {
  const columns = sortTables(schema).flatMap((table) =>
    table.columnIds.flatMap((columnId) => schema.columns[columnId] ?? []),
  );
  const resolveAll = (
    narrowed: ReadonlySet<ColumnId>,
  ): readonly ResolvedColumn[] =>
    columns.map((column: Column) => ({
      id: column.id,
      ...resolveDialectColumnType({
        dialect,
        column,
        isKeyColumn: keyColumnIds.has(column.id),
        isFixedLengthNarrowed: narrowed.has(column.id),
      }),
    }));
  const initial = resolveAll(new Set());
  if (dialect !== "sqlserver") {
    return initial;
  }
  const initialTypes = new Map(initial.map(({ id, type }) => [id, type]));
  return resolveAll(findSqlServerNarrowedColumnIds(schema, initialTypes));
}

/** The single entry point for the type of every column on a SQL dialect (SQL, Prisma, Drizzle). */
export function resolveSchemaColumnTypes(
  schema: SchemaDocument,
  dialect: SqlDialect,
): SchemaColumnTypes {
  const keyColumnIds = collectKeyColumnIds(schema);
  const resolved = resolveColumns(schema, dialect, keyColumnIds);
  const types = new Map(resolved.map(({ id, type }) => [id, type]));
  const rowDiagnostics =
    dialect === "mysql"
      ? sortTables(schema).flatMap((table) =>
          fitMysqlRow(schema, table, types, keyColumnIds),
        )
      : [];
  return {
    types,
    diagnostics: finalizeDiagnostics([
      ...resolved.flatMap((column) => column.diagnostics),
      ...rowDiagnostics,
    ]),
  };
}
