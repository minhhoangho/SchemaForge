import type { SchemaDocument } from "../../model/schema-document.js";
import type {
  Generate,
  GenerateResult,
  GeneratorOptions,
} from "../shared/generator-types.js";
import { quoteSqlIdentifier } from "../shared/identifiers.js";
import { renderFileContent } from "../shared/render-file.js";
import type {
  SqlColumnModel,
  SqlForeignKeyModel,
  SqlIndexModel,
  SqlTableModel,
} from "../shared/sql-ddl-model.js";
import { buildSqlDdlModel } from "../shared/sql-ddl-model.js";
import { sqlStringLiteral } from "../shared/sql-literals.js";
import { REFERENTIAL_ACTION_SQL } from "../shared/sql-referential-actions.js";
import { renderMysqlType } from "./render-mysql-type.js";

export type MysqlOptions = GeneratorOptions["mysql"];

const COLUMN_INDENT = "  ";

// utf8mb4_0900_as_ci is case-insensitive but accent-sensitive, like part 2's
// duplicate checks (code generators spec, CG-01).
const TABLE_OPTIONS =
  "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_ci";

function quote(name: string): string {
  return quoteSqlIdentifier("mysql", name);
}

function literal(value: string): string {
  return sqlStringLiteral("mysql", value);
}

function quoteList(names: readonly string[]): string {
  return names.map(quote).join(", ");
}

function renderColumn(
  column: SqlColumnModel,
  enums: SchemaDocument["enums"],
): string {
  return [
    `${COLUMN_INDENT}${quote(column.name)} ${renderMysqlType(column.type, enums)}`,
    column.isAutoIncrement ? " AUTO_INCREMENT" : "",
    column.isNullable ? "" : " NOT NULL",
    column.defaultSql === null ? "" : ` DEFAULT ${column.defaultSql}`,
    column.comment === "" ? "" : ` COMMENT ${literal(column.comment)}`,
  ].join("");
}

// MySQL always names the primary key PRIMARY, so it is written unnamed.
function renderTableElements(
  table: SqlTableModel,
  enums: SchemaDocument["enums"],
): readonly string[] {
  return [
    ...table.columns.map((column) => renderColumn(column, enums)),
    ...(table.primaryKey === null
      ? []
      : [
          `${COLUMN_INDENT}PRIMARY KEY (${quoteList(table.primaryKey.columnNames)})`,
        ]),
    ...table.uniqueConstraints.map(
      (unique) =>
        `${COLUMN_INDENT}CONSTRAINT ${quote(unique.name)} UNIQUE (${quoteList(unique.columnNames)})`,
    ),
  ];
}

function renderTable(
  table: SqlTableModel,
  enums: SchemaDocument["enums"],
): readonly string[] {
  const elements = renderTableElements(table, enums);
  const comment =
    table.comment === "" ? "" : ` COMMENT=${literal(table.comment)}`;
  const footer = `${TABLE_OPTIONS}${comment};`;
  const header = `CREATE TABLE ${quote(table.name)} (`;
  if (elements.length === 0) {
    return [`${header}) ${footer}`];
  }
  return [header, elements.join(",\n"), `) ${footer}`];
}

function renderIndex(index: SqlIndexModel): string {
  const unique = index.isUnique ? "UNIQUE " : "";
  return `CREATE ${unique}INDEX ${quote(index.name)} ON ${quote(index.tableName)} (${quoteList(index.columnNames)});`;
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

// CG-01 has no options, so the implementation leaves out the second parameter
// of `Generate` instead of declaring an unused one. Comments are written in
// CREATE TABLE, so no statement follows the foreign keys.
export const generateMysql: Generate<"mysql"> = (
  schema: SchemaDocument,
): GenerateResult => {
  const model = buildSqlDdlModel(schema, "mysql");
  const content = renderFileContent([
    ...model.tables.map((table) => renderTable(table, schema.enums)),
    model.indexes.map(renderIndex),
    model.foreignKeys.map(renderForeignKey),
  ]);
  return {
    file: { fileName: "schema.sql", language: "sql", content },
    diagnostics: model.diagnostics,
  };
};
