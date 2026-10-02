import type { Column } from "../../model/column.js";
import type { ColumnType } from "../../model/column-type.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { findDefaultValueProblem } from "../../validation/rules/default-literals.js";
import type { SqlDialect } from "./generator-types.js";

const SINGLE_QUOTE = "'";
const ESCAPED_SINGLE_QUOTE = "''";
const BACKSLASH = "\\";
const ESCAPED_BACKSLASH = "\\\\";
const NULL_CHARACTER = "\u0000";

/**
 * Quotes a string as a SQL string literal (code generators spec, section 5).
 * MySQL also escapes backslashes because its default SQL mode lacks
 * NO_BACKSLASH_ESCAPES; PostgreSQL has standard_conforming_strings on.
 */
export function sqlStringLiteral(dialect: SqlDialect, value: string): string {
  const escaped =
    dialect === "mysql"
      ? value.replaceAll(BACKSLASH, ESCAPED_BACKSLASH)
      : value;
  const quoted = escaped.replaceAll(SINGLE_QUOTE, ESCAPED_SINGLE_QUOTE);
  return dialect === "sqlserver" ? `N'${quoted}'` : `'${quoted}'`;
}

/** PostgreSQL cannot store U+0000 in text, so callers strip it and report it. */
export function removeNullCharacters(value: string): {
  readonly text: string;
  readonly hasRemoved: boolean;
} {
  const text = value.replaceAll(NULL_CHARACTER, "");
  return { text, hasRemoved: text.length !== value.length };
}

// Digits right after the seconds' "."; part 2 literals allow any count.
const FRACTIONAL_SECONDS_PATTERN = /(?<=:[0-9]{2}\.)[0-9]+/;

// Truncated, not rounded, so a carry never spills into the next second, day
// or year (spec section 3, issue 8 and R15). PostgreSQL rounds to its column
// precision itself, so it keeps the literal as is.
const MAX_FRACTIONAL_SECOND_DIGITS: Readonly<
  Record<SqlDialect, number | null>
> = {
  postgresql: null,
  mysql: 6,
  sqlserver: 7,
};

function truncateFractionalSeconds(dialect: SqlDialect, value: string): string {
  const maxDigits = MAX_FRACTIONAL_SECOND_DIGITS[dialect];
  if (maxDigits === null) {
    return value;
  }
  return value.replace(FRACTIONAL_SECONDS_PATTERN, (digits) =>
    digits.slice(0, maxDigits),
  );
}

// MySQL 8.4 rejects a UTC offset written as "Z" or "-00:00" (error 1067) but
// accepts "+00:00" (Task 8 probe).
const MYSQL_REJECTED_UTC_OFFSET_PATTERN = /(?:Z|-00:00)$/;
const MYSQL_UTC_OFFSET = "+00:00";

const BOOLEAN_LITERALS: Readonly<
  Record<SqlDialect, { readonly true: string; readonly false: string }>
> = {
  postgresql: { true: "true", false: "false" },
  mysql: { true: "TRUE", false: "FALSE" },
  sqlserver: { true: "1", false: "0" },
};

/**
 * Writes a literal that is already valid for `type` (callers check it with
 * `findDefaultValueProblem` or produce it themselves). This is the only path
 * that writes SQL literals, so defaults, Prisma `dbgenerated` and seed SQL agree.
 */
export function formatSqlLiteral(
  dialect: SqlDialect,
  type: ColumnType,
  value: string,
): string {
  switch (type.kind) {
    case "smallint":
    case "integer":
    case "bigint":
    case "decimal":
    case "real":
    case "double":
      return value;
    case "boolean":
      return value === "true"
        ? BOOLEAN_LITERALS[dialect].true
        : BOOLEAN_LITERALS[dialect].false;
    case "timestamptz":
      return sqlStringLiteral(
        dialect,
        truncateFractionalSeconds(
          dialect,
          dialect === "mysql"
            ? value.replace(MYSQL_REJECTED_UTC_OFFSET_PATTERN, MYSQL_UTC_OFFSET)
            : value,
        ),
      );
    case "time":
    case "timestamp":
      return sqlStringLiteral(
        dialect,
        truncateFractionalSeconds(dialect, value),
      );
    case "binary":
      throw new Error("binary literals have no SQL string form");
    case "char":
    case "varchar":
    case "text":
    case "custom":
    case "uuid":
    case "date":
    case "json":
    case "enum":
      return sqlStringLiteral(dialect, value);
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}

export type SqlDefault =
  | { readonly kind: "none" }
  | { readonly kind: "omitted" }
  | {
      readonly kind: "value";
      readonly sql: string;
      readonly hasRemovedNullCharacter: boolean;
    };

export type FormatSqlDefaultInput = {
  readonly dialect: SqlDialect;
  readonly column: Column;
  readonly enums: SchemaDocument["enums"];
  // MySQL only accepts expression defaults on LONGTEXT, JSON and LONGBLOB.
  readonly shouldParenthesizeLiteral: boolean;
};

const UUID_FUNCTIONS: Readonly<Record<SqlDialect, string>> = {
  postgresql: "gen_random_uuid()",
  mysql: "(UUID())",
  sqlserver: "newid()",
};

function currentTimestampFunction(
  dialect: SqlDialect,
  typeKind: ColumnType["kind"],
): string {
  switch (dialect) {
    case "postgresql":
      return "now()";
    case "mysql":
      return "CURRENT_TIMESTAMP(6)";
    case "sqlserver":
      return typeKind === "timestamptz"
        ? "sysdatetimeoffset()"
        : "sysdatetime()";
    default: {
      const unreachable: never = dialect;
      return unreachable;
    }
  }
}

function formatLiteralDefault(
  input: FormatSqlDefaultInput,
  value: string,
): SqlDefault {
  const { dialect, column } = input;
  const { text, hasRemoved } =
    dialect === "postgresql"
      ? removeNullCharacters(value)
      : { text: value, hasRemoved: false };
  const literal = formatSqlLiteral(dialect, column.type, text);
  const sql =
    dialect === "mysql" && input.shouldParenthesizeLiteral
      ? `(${literal})`
      : literal;
  return { kind: "value", sql, hasRemovedNullCharacter: hasRemoved };
}

/**
 * Formats a column's default value, or reports `omitted` when part 2
 * validation rejects it, so the caller adds `default-omitted` instead of
 * writing an unchecked literal (spec section 2).
 */
export function formatSqlDefault(input: FormatSqlDefaultInput): SqlDefault {
  const { dialect, column, enums } = input;
  const defaultValue = column.defaultValue;
  if (defaultValue === null) {
    return { kind: "none" };
  }
  if (findDefaultValueProblem(column.type, defaultValue, enums) !== null) {
    return { kind: "omitted" };
  }
  switch (defaultValue.kind) {
    case "currentTimestamp":
      return {
        kind: "value",
        sql: currentTimestampFunction(dialect, column.type.kind),
        hasRemovedNullCharacter: false,
      };
    case "generateUuid":
      return {
        kind: "value",
        sql: UUID_FUNCTIONS[dialect],
        hasRemovedNullCharacter: false,
      };
    case "literal":
      return formatLiteralDefault(input, defaultValue.value);
    default: {
      const unreachable: never = defaultValue;
      return unreachable;
    }
  }
}
