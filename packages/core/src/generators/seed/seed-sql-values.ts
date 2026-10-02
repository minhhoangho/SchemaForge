import type { Column } from "../../model/column.js";
import type { ColumnType } from "../../model/column-type.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { SqlDialect } from "../shared/generator-types.js";
import { isValidJsonValue } from "../shared/json-representation.js";
import type { JsonValue } from "../shared/json-representation.js";
import {
  formatSqlLiteral,
  removeNullCharacters,
} from "../shared/sql-literals.js";

const DEFAULT_KEYWORD = "DEFAULT";
const NULL_KEYWORD = "NULL";

// Strings stay as they are; other values (numbers, custom and json values)
// are written in their JSON form.
function toText(value: JsonValue): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function formatText(
  dialect: SqlDialect,
  type: ColumnType,
  text: string,
): string {
  const cleaned =
    dialect === "postgresql" ? removeNullCharacters(text).text : text;
  return formatSqlLiteral(dialect, type, cleaned);
}

// The value already matched BASE64_PATTERN, so it holds only A-Za-z0-9+/= and
// needs no escaping inside the quotes.
function formatBase64(dialect: SqlDialect, base64: string): string {
  switch (dialect) {
    case "postgresql":
      return `decode('${base64}', 'base64')`;
    case "mysql":
      return `FROM_BASE64('${base64}')`;
    case "sqlserver":
      return `CAST(N'' AS XML).value('xs:base64Binary("${base64}")', 'varbinary(max)')`;
    default: {
      const unreachable: never = dialect;
      return unreachable;
    }
  }
}

function formatValidValue(
  dialect: SqlDialect,
  type: ColumnType,
  value: JsonValue,
): string {
  switch (type.kind) {
    case "smallint":
    case "integer":
    case "real":
    case "double":
      return toText(value);
    case "boolean":
      return formatSqlLiteral(dialect, type, value === true ? "true" : "false");
    case "binary":
      return formatBase64(dialect, toText(value));
    case "json":
      return formatText(dialect, type, JSON.stringify(value));
    case "bigint":
    case "decimal":
    case "char":
    case "varchar":
    case "text":
    case "uuid":
    case "date":
    case "time":
    case "timestamp":
    case "timestamptz":
    case "enum":
    case "custom":
      return formatText(dialect, type, toText(value));
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}

/**
 * One seed value as a SQL expression: DEFAULT for a missing key, NULL for
 * null or a value that does not fit the column type, so any dataset gives
 * safe SQL. Literals go through the same function as CG-01 defaults.
 */
export function formatSeedSqlValue(
  dialect: SqlDialect,
  column: Column,
  value: JsonValue | undefined,
  enums: SchemaDocument["enums"],
): string {
  if (value === undefined) {
    return DEFAULT_KEYWORD;
  }
  if (value === null || !isValidJsonValue(column.type, value, enums)) {
    return NULL_KEYWORD;
  }
  return formatValidValue(dialect, column.type, value);
}
