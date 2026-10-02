import type { Column } from "../../model/column.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { DialectColumnType } from "../shared/dialect-types.js";
import { formatSqlDefault } from "../shared/sql-literals.js";
import type { DrizzleDialect } from "./drizzle-names.js";

export type DrizzleDefaultInput = {
  readonly dialect: DrizzleDialect;
  readonly column: Column;
  // The resolved dialect type, so a varchar widened to LONGTEXT counts as text.
  readonly type: DialectColumnType;
  readonly enums: SchemaDocument["enums"];
};

// MySQL accepts only parenthesized expression defaults on LONGTEXT, JSON and
// LONGBLOB (spec R19, same rule as the SQL DDL model).
const MYSQL_EXPRESSION_DEFAULT_KINDS: ReadonlySet<DialectColumnType["kind"]> =
  new Set(["text", "json", "binary"]);

export type DrizzleDefault = {
  readonly call: string;
  readonly isSqlRaw: boolean;
};

function sqlRawDefault(input: DrizzleDefaultInput): DrizzleDefault | null {
  const sqlDefault = formatSqlDefault({
    dialect: input.dialect,
    column: input.column,
    enums: input.enums,
    shouldParenthesizeLiteral:
      input.dialect === "mysql" &&
      MYSQL_EXPRESSION_DEFAULT_KINDS.has(input.type.kind),
  });
  return sqlDefault.kind === "value"
    ? {
        call: `.default(sql.raw(${JSON.stringify(sqlDefault.sql)}))`,
        isSqlRaw: true,
      }
    : null;
}

// Literal defaults with a typed Drizzle API, chosen by the resolved type.
function typedLiteralDefault(
  input: DrizzleDefaultInput,
  value: string,
): string | null {
  switch (input.type.kind) {
    case "smallint":
    case "integer":
      return `.default(${String(Number(value))})`;
    case "boolean":
      return `.default(${value === "true" ? "true" : "false"})`;
    case "char":
    case "varchar":
    case "keyText":
    case "uuid":
    case "decimal":
    case "enum":
      return `.default(${JSON.stringify(value)})`;
    case "text":
      return input.dialect === "postgresql"
        ? `.default(${JSON.stringify(value)})`
        : null;
    case "bigint":
    case "real":
    case "double":
    case "date":
    case "time":
    case "timestamp":
    case "timestamptz":
    case "json":
    case "binary":
    case "custom":
      return null;
    default: {
      const unreachable: never = input.type;
      return unreachable;
    }
  }
}

/**
 * The default call chained after a column builder (plan Task 18, "Giá trị mặc
 * định"); the caller has already left out auto-increment columns and invalid
 * defaults.
 */
export function renderDrizzleDefault(
  input: DrizzleDefaultInput,
): DrizzleDefault | null {
  const { dialect, column } = input;
  const defaultValue = column.defaultValue;
  if (defaultValue === null) {
    return null;
  }
  if (dialect === "postgresql" && defaultValue.kind === "currentTimestamp") {
    return { call: ".defaultNow()", isSqlRaw: false };
  }
  if (dialect === "postgresql" && defaultValue.kind === "generateUuid") {
    return { call: ".defaultRandom()", isSqlRaw: false };
  }
  const typed =
    defaultValue.kind === "literal"
      ? typedLiteralDefault(input, defaultValue.value)
      : null;
  return typed === null
    ? sqlRawDefault(input)
    : { call: typed, isSqlRaw: false };
}
