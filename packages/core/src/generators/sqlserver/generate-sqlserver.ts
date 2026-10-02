import type { SchemaDocument } from "../../model/schema-document.js";
import {
  createDiagnostic,
  finalizeDiagnostics,
} from "../shared/diagnostics.js";
import type {
  Generate,
  GenerateResult,
  GeneratorDiagnostic,
  GeneratorOptions,
} from "../shared/generator-types.js";
import { quoteSqlIdentifier } from "../shared/identifiers.js";
import { renderFileContent } from "../shared/render-file.js";
import type {
  SqlColumnModel,
  SqlEnumCheckModel,
  SqlForeignKeyModel,
  SqlIndexModel,
  SqlTableModel,
  SqlUniqueModel,
} from "../shared/sql-ddl-model.js";
import { buildSqlDdlModel } from "../shared/sql-ddl-model.js";
import { sqlStringLiteral } from "../shared/sql-literals.js";
import { REFERENTIAL_ACTION_SQL } from "../shared/sql-referential-actions.js";
import { sqlServerEnumLength } from "../shared/sqlserver-enum-length.js";
import { renderSqlServerType } from "./render-sqlserver-type.js";

export type SqlServerOptions = GeneratorOptions["sqlserver"];

const COLUMN_INDENT = "  ";

// One batch without GO, so the schema name is read once into a variable.
const DECLARE_SCHEMA_NAME = "DECLARE @schema_name sysname = SCHEMA_NAME();";

function quote(name: string): string {
  return quoteSqlIdentifier("sqlserver", name);
}

function literal(value: string): string {
  return sqlStringLiteral("sqlserver", value);
}

function quoteList(names: readonly string[]): string {
  return names.map(quote).join(", ");
}

// NULL is explicit: a column's default nullability depends on the session
// setting ANSI_NULL_DFLT_ON.
function renderColumn(
  column: SqlColumnModel,
  enums: SchemaDocument["enums"],
): string {
  return [
    `${COLUMN_INDENT}${quote(column.name)} ${renderSqlServerType(column.type, enums)}`,
    column.isAutoIncrement ? " IDENTITY(1, 1)" : "",
    column.isNullable ? " NULL" : " NOT NULL",
    column.defaultSql === null ? "" : ` DEFAULT ${column.defaultSql}`,
  ].join("");
}

function renderConstraint(constraint: SqlUniqueModel, kind: string): string {
  return `${COLUMN_INDENT}CONSTRAINT ${quote(constraint.name)} ${kind} (${quoteList(constraint.columnNames)})`;
}

function renderEnumCheck(check: SqlEnumCheckModel): string {
  const values = check.values.map(literal).join(", ");
  return `${COLUMN_INDENT}CONSTRAINT ${quote(check.name)} CHECK (${quote(check.columnName)} IN (${values}))`;
}

function renderTable(
  table: SqlTableModel,
  enums: SchemaDocument["enums"],
): readonly string[] {
  const elements = [
    ...table.columns.map((column) => renderColumn(column, enums)),
    ...(table.primaryKey === null
      ? []
      : [renderConstraint(table.primaryKey, "PRIMARY KEY")]),
    ...table.uniqueConstraints.map((unique) =>
      renderConstraint(unique, "UNIQUE"),
    ),
    ...table.enumChecks.map(renderEnumCheck),
  ];
  const header = `CREATE TABLE ${quote(table.name)} (`;
  if (elements.length === 0) {
    return [`${header});`];
  }
  return [header, elements.join(",\n"), ");"];
}

function renderIndex(index: SqlIndexModel): string {
  const unique = index.isUnique ? "UNIQUE " : "";
  const filter =
    index.filterColumnNames.length === 0
      ? ""
      : ` WHERE ${index.filterColumnNames.map((name) => `${quote(name)} IS NOT NULL`).join(" AND ")}`;
  return `CREATE ${unique}INDEX ${quote(index.name)} ON ${quote(index.tableName)} (${quoteList(index.columnNames)})${filter};`;
}

function renderForeignKey(foreignKey: SqlForeignKeyModel): string {
  return [
    `ALTER TABLE ${quote(foreignKey.tableName)}`,
    `ADD CONSTRAINT ${quote(foreignKey.name)}`,
    `FOREIGN KEY (${quoteList(foreignKey.columnNames)})`,
    `REFERENCES ${quote(foreignKey.referencedTableName)} (${quoteList(foreignKey.referencedColumnNames)})`,
    `ON DELETE ${REFERENTIAL_ACTION_SQL[foreignKey.onDelete]}`,
    `ON UPDATE ${REFERENTIAL_ACTION_SQL[foreignKey.onUpdate]};`,
  ].join(" ");
}

function renderDescription(
  comment: string,
  tableName: string,
  columnName: string | null,
): string {
  const levels = [
    `@name = N'MS_Description'`,
    `@value = ${literal(comment)}`,
    `@level0type = N'SCHEMA'`,
    `@level0name = @schema_name`,
    `@level1type = N'TABLE'`,
    `@level1name = ${literal(tableName)}`,
    ...(columnName === null
      ? []
      : [`@level2type = N'COLUMN'`, `@level2name = ${literal(columnName)}`]),
  ];
  return `EXEC sys.sp_addextendedproperty ${levels.join(", ")};`;
}

function renderTableDescriptions(table: SqlTableModel): readonly string[] {
  return [
    ...(table.comment === ""
      ? []
      : [renderDescription(table.comment, table.name, null)]),
    ...table.columns
      .filter((column) => column.comment !== "")
      .map((column) =>
        renderDescription(column.comment, table.name, column.name),
      ),
  ];
}

function renderDescriptions(
  tables: readonly SqlTableModel[],
): readonly string[] {
  const statements = tables.flatMap(renderTableDescriptions);
  return statements.length === 0 ? [] : [DECLARE_SCHEMA_NAME, ...statements];
}

// An enum value over 4000 UTF-16 code units makes the column nvarchar(max)
// (spec issue 6); the shared DDL model does not know nvarchar lengths.
function findUnboundedEnumColumns(
  tables: readonly SqlTableModel[],
  enums: SchemaDocument["enums"],
): readonly GeneratorDiagnostic[] {
  return tables.flatMap((table) =>
    table.columns.flatMap((column) => {
      const element =
        column.type.kind === "enum" ? enums[column.type.enumId] : undefined;
      return element !== undefined &&
        sqlServerEnumLength(element.values) === null
        ? [
            createDiagnostic("type-parameter-out-of-range", [
              "columns",
              column.columnId,
              "type",
            ]),
          ]
        : [];
    }),
  );
}

// CG-01 has no options, so the implementation leaves out the second parameter
// of `Generate` instead of declaring an unused one.
export const generateSqlServer: Generate<"sqlserver"> = (
  schema: SchemaDocument,
): GenerateResult => {
  const model = buildSqlDdlModel(schema, "sqlserver");
  const content = renderFileContent([
    ...model.tables.map((table) => renderTable(table, schema.enums)),
    model.indexes.map(renderIndex),
    model.foreignKeys.map(renderForeignKey),
    renderDescriptions(model.tables),
  ]);
  return {
    file: { fileName: "schema.sql", language: "sql", content },
    diagnostics: finalizeDiagnostics([
      ...model.diagnostics,
      ...findUnboundedEnumColumns(model.tables, schema.enums),
    ]),
  };
};
