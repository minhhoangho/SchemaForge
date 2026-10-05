import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type {
  CoreDatabase,
  CoreEndpoint,
  CoreTable,
} from "../shared/dbml-core-adapter-types.js";
import { tokenizeSql } from "./sql-lexer.js";

// @dbml/core drops the quotes of a quoted name but keeps its doubled closing
// quote (`"a""b"` → `a""b`), and keeps the doubled quote of a PostgreSQL enum
// value. These are the quotes CG-01 and the dumps write in each dialect.
const IDENTIFIER_ESCAPES: Readonly<
  Record<SqlDialect, readonly [string, string]>
> = {
  postgresql: ['""', '"'],
  mysql: ["``", "`"],
  sqlserver: ["]]", "]"],
};
const STRING_ESCAPE = "''";
const STRING_QUOTE = "'";

// Whether `text` is the body of a bracketed name: every `]` doubled.
function isBracketBody(text: string): boolean {
  return !text.replaceAll("]]", "").includes("]");
}

export function unescapeParserName(name: string, dialect: SqlDialect): string {
  const [escaped, quote] = IDENTIFIER_ESCAPES[dialect];
  // The SQL Server parser keeps the brackets of some names (`[value]`). A real
  // name in brackets comes back with its closing `]` doubled, so its body
  // never passes isBracketBody.
  const body = name.slice(1, -1);
  const isStillQuoted =
    dialect === "sqlserver" &&
    name.length > 1 &&
    name.startsWith("[") &&
    name.endsWith("]") &&
    isBracketBody(body);
  return (isStillQuoted ? body : name).replaceAll(escaped, quote);
}

// The MySQL parser keeps a COMMENT string as written; the lexer resolves its
// escapes (`''`, backslashes). PostgreSQL COMMENT ON comes back resolved.
function unescapeNote(note: string | null, dialect: SqlDialect): string | null {
  if (note === null || dialect !== "mysql") {
    return note;
  }
  const tokens = tokenizeSql(`'${note}'`, dialect);
  const [token, extra] = tokens.isOk ? tokens.value : [];
  return token?.kind === "string" && extra === undefined ? token.value : note;
}

function normalizeTable(table: CoreTable, dialect: SqlDialect): CoreTable {
  const unescape = (name: string): string => unescapeParserName(name, dialect);
  return {
    ...table,
    name: unescape(table.name),
    note: unescapeNote(table.note, dialect),
    schemaName: table.schemaName === null ? null : unescape(table.schemaName),
    fields: table.fields.map((field) => ({
      ...field,
      name: unescape(field.name),
      note: unescapeNote(field.note, dialect),
    })),
    indexes: table.indexes.map((index) => ({
      ...index,
      name: index.name === null ? null : unescape(index.name),
      columns: index.columns.map((column) =>
        column.isExpression
          ? column
          : { ...column, value: unescape(column.value) },
      ),
    })),
  };
}

function normalizeEndpoint(
  endpoint: CoreEndpoint,
  dialect: SqlDialect,
): CoreEndpoint {
  return {
    ...endpoint,
    tableName: unescapeParserName(endpoint.tableName, dialect),
    columnNames: endpoint.columnNames.map((name) =>
      unescapeParserName(name, dialect),
    ),
  };
}

/** The parsed database with names and enum values as the source means them. */
export function normalizeParserNames(
  database: CoreDatabase,
  dialect: SqlDialect,
): CoreDatabase {
  return {
    ...database,
    tables: database.tables.map((table) => normalizeTable(table, dialect)),
    refs: database.refs.map((ref) => ({
      ...ref,
      endpoints: ref.endpoints.map((endpoint) =>
        normalizeEndpoint(endpoint, dialect),
      ),
    })),
    enums: database.enums.map((element) => ({
      ...element,
      name: unescapeParserName(element.name, dialect),
      values: element.values.map((value) => ({
        ...value,
        name: value.name.replaceAll(STRING_ESCAPE, STRING_QUOTE),
      })),
    })),
  };
}
