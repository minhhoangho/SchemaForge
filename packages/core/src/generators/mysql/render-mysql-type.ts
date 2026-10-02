import type { SchemaDocument } from "../../model/schema-document.js";
import type { DialectColumnType } from "../shared/dialect-types.js";
import { sqlStringLiteral } from "../shared/sql-literals.js";

const UNBOUNDED_TEXT = "LONGTEXT";

// Code generators spec, section 3 "SQL", MySQL column.
export function renderMysqlType(
  type: DialectColumnType,
  enums: SchemaDocument["enums"],
): string {
  switch (type.kind) {
    case "smallint":
    case "bigint":
    case "double":
    case "boolean":
    case "date":
    case "json":
      return type.kind.toUpperCase();
    case "integer":
      return "INT";
    case "real":
      return "FLOAT";
    case "text":
      return UNBOUNDED_TEXT;
    case "uuid":
      return "CHAR(36)";
    case "time":
      return "TIME(6)";
    case "timestamp":
      return "DATETIME(6)";
    case "timestamptz":
      return "TIMESTAMP(6)";
    case "binary":
      return "LONGBLOB";
    case "decimal":
      return `DECIMAL(${String(type.precision)}, ${String(type.scale)})`;
    case "char":
      return `CHAR(${String(type.length)})`;
    case "varchar":
    case "keyText":
      return `VARCHAR(${String(type.length)})`;
    case "enum": {
      const element = enums[type.enumId];
      if (element === undefined) {
        return UNBOUNDED_TEXT;
      }
      const values = element.values.map((value) =>
        sqlStringLiteral("mysql", value),
      );
      return `ENUM(${values.join(", ")})`;
    }
    // The DDL model already replaced an unsafe custom type with LONGTEXT.
    case "custom":
      return type.name;
  }
}
