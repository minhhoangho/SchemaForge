import type { SqlDialect } from "../../generators/shared/generator-types.js";
import {
  mapSqlType,
  splitSqlServerIdentity,
} from "../shared/sql-type-mapping.js";
import type { SqlTableDefinition } from "./sql-column-definitions.js";
import type { SqlToken } from "./sql-lexer.js";
import { findAlterTableAction, wordAt } from "./sql-token-reading.js";
import type { SqlStatement } from "./statement-scanner.js";

// A type every parser grammar reads; no longer than any type it replaces.
const PLACEHOLDER_TYPE = "INT";
const NOT_LINE_BREAK = /[^\r\n]/g;

function isCustomType(rawType: string, dialect: SqlDialect): boolean {
  const { typeName } =
    dialect === "sqlserver"
      ? splitSqlServerIdentity(rawType)
      : { typeName: rawType };
  return (
    mapSqlType({
      rawType: typeName,
      dialect,
      enumNameKeys: new Set(),
      hasUuidDefault: false,
    }).type.kind === "custom"
  );
}

/**
 * The MySQL and SQL Server grammars of @dbml/core 10.2.0 reject custom types
 * such as `tsvector` or `geometry(Point, 4326)`, which CG-01 writes as they
 * are. The importer reads every column type from the scanner text (spec
 * section 5), so the parser gets a same-length placeholder instead, keeping
 * offsets, lines and columns. PostgreSQL reads any type name.
 */
export function hideCustomTypes(input: {
  readonly source: string;
  readonly definitions: readonly SqlTableDefinition[];
  readonly dialect: SqlDialect;
}): string {
  if (input.dialect === "postgresql") {
    return input.source;
  }
  const hidden = input.definitions
    .flatMap(({ columns }) => columns)
    .filter(
      ({ rawType }) =>
        rawType.length >= PLACEHOLDER_TYPE.length &&
        isCustomType(rawType, input.dialect),
    );
  // ponytail: a custom type shorter than the placeholder stays, so the
  // parser may still report it as a syntax error (never silent).
  // Definitions are in source order, so one pass builds the result.
  const parts: string[] = [];
  let offset = 0;
  for (const { rawType, typeStart } of hidden) {
    parts.push(
      input.source.slice(offset, typeStart),
      PLACEHOLDER_TYPE,
      rawType.slice(PLACEHOLDER_TYPE.length).replace(NOT_LINE_BREAK, " "),
    );
    offset = typeStart + rawType.length;
  }
  parts.push(input.source.slice(offset));
  return parts.join("");
}

// The `WITH {CHECK | NOCHECK}` tokens of `ALTER TABLE t WITH … ADD`, or null.
function findWithCheckClause(
  statement: SqlStatement,
): readonly [SqlToken, SqlToken] | null {
  const { tokens } = statement;
  if (wordAt(tokens, 0) !== "ALTER" || wordAt(tokens, 1) !== "TABLE") {
    return null;
  }
  const { index } = findAlterTableAction(tokens);
  const withToken = tokens[index - 2];
  const checkToken = tokens[index - 1];
  return wordAt(tokens, index - 2) === "WITH" &&
    wordAt(tokens, index) === "ADD" &&
    withToken !== undefined &&
    checkToken !== undefined
    ? [withToken, checkToken]
    : null;
}

/**
 * The SQL Server grammar of @dbml/core 10.2.0 drops `ALTER TABLE t WITH
 * {CHECK | NOCHECK} ADD … CHECK (…)` without an error, the form SSMS writes
 * every CHECK in, while it reads the statement without the clause. The clause
 * only says whether existing rows are checked, so the parser gets same-length
 * spaces instead, keeping offsets, lines and columns.
 */
export function hideWithCheckClauses(input: {
  readonly source: string;
  readonly statements: readonly SqlStatement[];
  readonly dialect: SqlDialect;
}): string {
  if (input.dialect !== "sqlserver") {
    return input.source;
  }
  const parts: string[] = [];
  let offset = 0;
  for (const clause of input.statements.map(findWithCheckClause)) {
    if (clause === null) {
      continue;
    }
    const [withToken, checkToken] = clause;
    const end = checkToken.start + checkToken.text.length;
    parts.push(
      input.source.slice(offset, withToken.start),
      " ".repeat(end - withToken.start),
    );
    offset = end;
  }
  parts.push(input.source.slice(offset));
  return parts.join("");
}
