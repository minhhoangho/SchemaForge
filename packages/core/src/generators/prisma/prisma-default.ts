import type { Column } from "../../model/column.js";
import type { EnumId } from "../../model/ids.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { findDefaultValueProblem } from "../../validation/rules/default-literals.js";
import type { DialectColumnType } from "../shared/dialect-types.js";
import { createDiagnostic } from "../shared/diagnostics.js";
import type { SqlDialect } from "../shared/generator-types.js";
import type { Diagnosed } from "../shared/sql-ddl-model-context.js";
import { formatSqlDefault, formatSqlLiteral } from "../shared/sql-literals.js";
import { formatPrismaString } from "./prisma-field-type.js";

export type PrismaDefaultInput = {
  readonly provider: SqlDialect;
  readonly column: Column;
  // The resolved dialect type, so a varchar widened to LONGTEXT counts as text.
  readonly type: DialectColumnType;
  readonly enums: SchemaDocument["enums"];
  // Allocated Prisma value names, parallel to each enum's `values`.
  readonly enumValueNames: ReadonlyMap<EnumId, readonly string[]>;
};

// MySQL accepts only parenthesized expression defaults on LONGTEXT, JSON and
// LONGBLOB, and `prisma validate` does not catch it (spec R19).
const MYSQL_EXPRESSION_DEFAULT_KINDS: ReadonlySet<DialectColumnType["kind"]> =
  new Set(["text", "json", "binary"]);

// `prisma validate` rejects `@default(1e10)` (P1012).
const EXPONENT_PATTERN = /[eE]/;

function dbgenerated(sql: string): string {
  return `dbgenerated(${formatPrismaString(sql)})`;
}

function sqlLiteral(input: PrismaDefaultInput, value: string): string {
  return dbgenerated(
    formatSqlLiteral(input.provider, input.column.type, value),
  );
}

function enumValueName(
  input: PrismaDefaultInput,
  enumId: EnumId,
  value: string,
): string {
  if (input.provider === "sqlserver") {
    return formatPrismaString(value);
  }
  const valueIndex = input.enums[enumId]?.values.indexOf(value) ?? -1;
  return (
    input.enumValueNames.get(enumId)?.[valueIndex] ?? formatPrismaString(value)
  );
}

function mysqlExpressionDefault(input: PrismaDefaultInput): string | null {
  const sqlDefault = formatSqlDefault({
    dialect: "mysql",
    column: input.column,
    enums: input.enums,
    shouldParenthesizeLiteral: true,
  });
  return sqlDefault.kind === "value" ? dbgenerated(sqlDefault.sql) : null;
}

// Rules in order, the first match wins (plan Task 17, "Giá trị mặc định").
function literalDefault(
  input: PrismaDefaultInput,
  value: string,
): string | null {
  const { type } = input.column;
  if (
    input.provider === "mysql" &&
    MYSQL_EXPRESSION_DEFAULT_KINDS.has(input.type.kind)
  ) {
    return mysqlExpressionDefault(input);
  }
  switch (type.kind) {
    case "real":
    case "double":
      return EXPONENT_PATTERN.test(value) ? sqlLiteral(input, value) : value;
    case "smallint":
    case "integer":
    case "bigint":
    case "decimal":
    case "boolean":
      return value;
    case "char":
    case "varchar":
    case "text":
    case "uuid":
    case "json":
      return formatPrismaString(value);
    case "enum":
      return enumValueName(input, type.enumId, value);
    // Prisma has no literal for these; binary never gets here because
    // findDefaultValueProblem rejects every binary literal.
    case "date":
    case "time":
    case "timestamp":
    case "timestamptz":
    case "custom":
    case "binary":
      return sqlLiteral(input, value);
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}

/** The argument of `@default(…)` for a column field, or null when it has none. */
export function renderPrismaDefault(
  input: PrismaDefaultInput,
): Diagnosed<string | null> {
  const { column } = input;
  if (column.isAutoIncrement) {
    return { value: "autoincrement()", diagnostics: [] };
  }
  const defaultValue = column.defaultValue;
  if (defaultValue === null) {
    return { value: null, diagnostics: [] };
  }
  if (
    findDefaultValueProblem(column.type, defaultValue, input.enums) !== null
  ) {
    return {
      value: null,
      diagnostics: [
        createDiagnostic("default-omitted", [
          "columns",
          column.id,
          "defaultValue",
        ]),
      ],
    };
  }
  switch (defaultValue.kind) {
    case "currentTimestamp":
      return { value: "now()", diagnostics: [] };
    case "generateUuid":
      return { value: "uuid()", diagnostics: [] };
    case "literal":
      return {
        value: literalDefault(input, defaultValue.value),
        diagnostics: [],
      };
    default: {
      const unreachable: never = defaultValue;
      return unreachable;
    }
  }
}
