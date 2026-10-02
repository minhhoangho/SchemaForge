import type { SchemaDocument } from "../../model/schema-document.js";
import type { DialectColumnType } from "../shared/dialect-types.js";
import { sqlServerEnumLength } from "../shared/sqlserver-enum-length.js";

const UNBOUNDED_TEXT = "nvarchar(max)";

// Code generators spec, section 3 "SQL", SQL Server column.
export function renderSqlServerType(
  type: DialectColumnType,
  enums: SchemaDocument["enums"],
): string {
  switch (type.kind) {
    case "smallint":
    case "bigint":
    case "real":
    case "date":
    case "time":
      return type.kind;
    case "integer":
      return "int";
    case "double":
      return "float(53)";
    case "boolean":
      return "bit";
    case "text":
    case "json":
      return UNBOUNDED_TEXT;
    case "uuid":
      return "uniqueidentifier";
    case "timestamp":
      return "datetime2";
    case "timestamptz":
      return "datetimeoffset";
    case "binary":
      return "varbinary(max)";
    case "decimal":
      return `decimal(${String(type.precision)}, ${String(type.scale)})`;
    case "char":
      return `nchar(${String(type.length)})`;
    case "varchar":
    case "keyText":
      return `nvarchar(${String(type.length)})`;
    case "enum": {
      const element = enums[type.enumId];
      const length =
        element === undefined ? null : sqlServerEnumLength(element.values);
      return length === null ? UNBOUNDED_TEXT : `nvarchar(${String(length)})`;
    }
    // The DDL model already replaced an unsafe custom type with nvarchar(max).
    case "custom":
      return type.name;
  }
}
