import type { Column } from "../../model/column.js";
import type { ColumnId, TableId } from "../../model/ids.js";
import type { Table } from "../../model/table.js";
import { resolveSqlServerUnique } from "./dialect-constraints.js";
import type { DialectColumnType } from "./dialect-types.js";
import { createDiagnostic } from "./diagnostics.js";
import type { GeneratorDiagnostic } from "./generator-types.js";
import { resolveSqlComment } from "./sql-ddl-model-comments.js";
import type { Diagnosed, SqlDdlContext } from "./sql-ddl-model-context.js";
import { columnNamesOf } from "./sql-ddl-model-context.js";
import { formatSqlDefault } from "./sql-literals.js";

export type SqlColumnModel = {
  readonly columnId: ColumnId;
  readonly name: string;
  readonly type: DialectColumnType;
  readonly isNullable: boolean;
  readonly isAutoIncrement: boolean;
  // Already quoted and escaped for the dialect.
  readonly defaultSql: string | null;
  // "" when there is none.
  readonly comment: string;
};

export type SqlUniqueModel = {
  readonly name: string;
  readonly columnNames: readonly string[];
};

export type SqlEnumCheckModel = {
  readonly name: string;
  readonly columnName: string;
  readonly values: readonly string[];
};

export type SqlTableModel = {
  readonly tableId: TableId;
  readonly name: string;
  readonly comment: string;
  readonly columns: readonly SqlColumnModel[];
  readonly primaryKey: SqlUniqueModel | null;
  // Constraints written inside CREATE TABLE.
  readonly uniqueConstraints: readonly SqlUniqueModel[];
  // SQL Server only.
  readonly enumChecks: readonly SqlEnumCheckModel[];
};

export type SqlIndexModel = {
  readonly name: string;
  readonly tableName: string;
  readonly columnNames: readonly string[];
  readonly isUnique: boolean;
  // Not empty: SQL Server writes WHERE … IS NOT NULL for each of these columns.
  readonly filterColumnNames: readonly string[];
};

export type SqlTableModels = {
  readonly tables: readonly SqlTableModel[];
  // Unique columns SQL Server writes as filtered unique indexes.
  readonly filteredIndexes: readonly SqlIndexModel[];
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

// MySQL accepts only expression defaults on LONGTEXT, JSON and LONGBLOB.
const MYSQL_EXPRESSION_DEFAULT_KINDS: ReadonlySet<DialectColumnType["kind"]> =
  new Set(["text", "json", "binary"]);

function resolveSafeType(
  column: Column,
  type: DialectColumnType,
): Diagnosed<DialectColumnType> {
  if (type.kind !== "custom" || type.isSafe) {
    return { value: type, diagnostics: [] };
  }
  return {
    value: { kind: "text" },
    diagnostics: [
      createDiagnostic("custom-type-unsafe", ["columns", column.id, "type"]),
    ],
  };
}

function resolveDefault(
  context: SqlDdlContext,
  column: Column,
  type: DialectColumnType,
): Diagnosed<string | null> {
  const { dialect, schema } = context;
  const sqlDefault = formatSqlDefault({
    dialect,
    column,
    enums: schema.enums,
    shouldParenthesizeLiteral:
      dialect === "mysql" && MYSQL_EXPRESSION_DEFAULT_KINDS.has(type.kind),
  });
  const path = ["columns", column.id, "defaultValue"];
  switch (sqlDefault.kind) {
    case "none":
      return { value: null, diagnostics: [] };
    case "omitted":
      return {
        value: null,
        diagnostics: [createDiagnostic("default-omitted", path)],
      };
    case "value":
      return {
        value: sqlDefault.sql,
        diagnostics: sqlDefault.hasRemovedNullCharacter
          ? [createDiagnostic("null-character-removed", path)]
          : [],
      };
    default: {
      const unreachable: never = sqlDefault;
      return unreachable;
    }
  }
}

function buildColumn(
  context: SqlDdlContext,
  column: Column,
  resolvedType: DialectColumnType,
): Diagnosed<SqlColumnModel> {
  const type = resolveSafeType(column, resolvedType);
  const defaultSql = resolveDefault(context, column, type.value);
  const comment = resolveSqlComment(context.dialect, "column", column.comment, [
    "columns",
    column.id,
    "comment",
  ]);
  return {
    value: {
      columnId: column.id,
      name: context.columnName(column.id) ?? column.name,
      type: type.value,
      isNullable: column.isNullable,
      isAutoIncrement: column.isAutoIncrement,
      defaultSql: defaultSql.value,
      comment: comment.text,
    },
    diagnostics: [
      ...type.diagnostics,
      ...defaultSql.diagnostics,
      ...comment.diagnostics,
    ],
  };
}

function buildPrimaryKey(
  context: SqlDdlContext,
  table: Table,
): SqlUniqueModel | null {
  const name = context.names.primaryKeys.get(table.id);
  if (name === undefined || context.dropped.primaryKeyTableIds.has(table.id)) {
    return null;
  }
  return {
    name,
    columnNames: columnNamesOf(context, table.primaryKeyColumnIds),
  };
}

type UniqueColumnPlacement =
  | { readonly kind: "constraint"; readonly constraint: SqlUniqueModel }
  | { readonly kind: "filteredIndex"; readonly index: SqlIndexModel };

function placeUniqueColumn(
  context: SqlDdlContext,
  table: Table,
  column: Column,
  constraint: SqlUniqueModel,
): Diagnosed<UniqueColumnPlacement> {
  const asConstraint = { kind: "constraint", constraint } as const;
  if (context.dialect !== "sqlserver") {
    return { value: asConstraint, diagnostics: [] };
  }
  const unique = resolveSqlServerUnique(context.schema, table.id, [column.id]);
  if (unique.mode === "filtered") {
    const index: SqlIndexModel = {
      name: constraint.name,
      tableName: table.name,
      columnNames: constraint.columnNames,
      isUnique: true,
      filterColumnNames: constraint.columnNames,
    };
    return { value: { kind: "filteredIndex", index }, diagnostics: [] };
  }
  const path = ["columns", column.id, "isUnique"];
  return {
    value: asConstraint,
    diagnostics: unique.isNullsRestricted
      ? [createDiagnostic("unique-nulls-restricted", path)]
      : [],
  };
}

function placeUniqueColumns(
  context: SqlDdlContext,
  table: Table,
  columns: readonly Column[],
): readonly Diagnosed<UniqueColumnPlacement>[] {
  return columns.flatMap((column) => {
    const name = context.names.uniqueColumns.get(column.id);
    const columnName = context.columnName(column.id);
    if (
      !column.isUnique ||
      context.dropped.uniqueColumnIds.has(column.id) ||
      name === undefined ||
      columnName === undefined
    ) {
      return [];
    }
    const constraint = { name, columnNames: [columnName] };
    return [placeUniqueColumn(context, table, column, constraint)];
  });
}

function buildEnumChecks(
  context: SqlDdlContext,
  columns: readonly Column[],
): readonly SqlEnumCheckModel[] {
  if (context.dialect !== "sqlserver") {
    return [];
  }
  return columns.flatMap((column) => {
    const name = context.names.enumChecks.get(column.id);
    const columnName = context.columnName(column.id);
    const values =
      column.type.kind === "enum"
        ? context.schema.enums[column.type.enumId]?.values
        : undefined;
    return name === undefined ||
      columnName === undefined ||
      values === undefined
      ? []
      : [{ name, columnName, values }];
  });
}

function buildTable(
  context: SqlDdlContext,
  table: Table,
): Diagnosed<SqlTableModel> & {
  readonly filteredIndexes: readonly SqlIndexModel[];
} {
  const columns = table.columnIds.flatMap(
    (columnId) => context.schema.columns[columnId] ?? [],
  );
  const columnModels = columns.flatMap((column) => {
    const type = context.types.get(column.id);
    return type === undefined ? [] : [buildColumn(context, column, type)];
  });
  const placements = placeUniqueColumns(context, table, columns);
  const comment = resolveSqlComment(context.dialect, "table", table.comment, [
    "tables",
    table.id,
    "comment",
  ]);
  return {
    value: {
      tableId: table.id,
      name: table.name,
      comment: comment.text,
      columns: columnModels.map((column) => column.value),
      primaryKey: buildPrimaryKey(context, table),
      uniqueConstraints: placements.flatMap(({ value }) =>
        value.kind === "constraint" ? [value.constraint] : [],
      ),
      enumChecks: buildEnumChecks(context, columns),
    },
    filteredIndexes: placements.flatMap(({ value }) =>
      value.kind === "filteredIndex" ? [value.index] : [],
    ),
    diagnostics: [
      ...comment.diagnostics,
      ...columnModels.flatMap((column) => column.diagnostics),
      ...placements.flatMap((placement) => placement.diagnostics),
    ],
  };
}

/** Every table in `tables` order, with the filtered unique indexes its columns need. */
export function buildTableModels(
  context: SqlDdlContext,
  tables: readonly Table[],
): SqlTableModels {
  const built = tables.map((table) => buildTable(context, table));
  return {
    tables: built.map((table) => table.value),
    filteredIndexes: built.flatMap((table) => table.filteredIndexes),
    diagnostics: built.flatMap((table) => table.diagnostics),
  };
}
