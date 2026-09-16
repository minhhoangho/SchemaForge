import type { ColumnType, SchemaDocument } from "@schemaforge/core";

// Shown in place of an enum name when the column points at a deleted enum;
// the issue badge on the column explains the problem.
const MISSING_ENUM_NAME = "?";

/**
 * Returns the short type shown on a column row, such as `varchar(255)`. Type
 * names are schema syntax, not interface text, so they are never translated.
 */
export function formatColumnType(
  type: ColumnType,
  enums: SchemaDocument["enums"],
): string {
  switch (type.kind) {
    case "decimal":
      return `decimal(${String(type.precision)},${String(type.scale)})`;
    case "char":
    case "varchar":
      return `${type.kind}(${String(type.length)})`;
    case "enum":
      return enums[type.enumId]?.name ?? MISSING_ENUM_NAME;
    case "custom":
      return type.name;
    case "smallint":
    case "integer":
    case "bigint":
    case "real":
    case "double":
    case "boolean":
    case "text":
    case "uuid":
    case "date":
    case "time":
    case "timestamp":
    case "timestamptz":
    case "json":
    case "binary":
      return type.kind;
    default: {
      const unhandledType: never = type;
      return unhandledType;
    }
  }
}
