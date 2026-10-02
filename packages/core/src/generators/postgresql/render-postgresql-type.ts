import type { SchemaDocument } from "../../model/schema-document.js";
import type { DialectColumnType } from "../shared/dialect-types.js";
import { quoteSqlIdentifier } from "../shared/identifiers.js";

const FALLBACK_TYPE = "text";

// Code generators spec, section 3 "SQL", PostgreSQL column.
export function renderPostgresqlType(
  type: DialectColumnType,
  enums: SchemaDocument["enums"],
): string {
  switch (type.kind) {
    case "smallint":
    case "integer":
    case "bigint":
    case "real":
    case "boolean":
    case "text":
    case "uuid":
    case "date":
    case "time":
    case "timestamp":
    case "timestamptz":
      return type.kind;
    case "double":
      return "double precision";
    case "json":
      return "jsonb";
    case "binary":
      return "bytea";
    case "decimal":
      return `numeric(${String(type.precision)}, ${String(type.scale)})`;
    case "char":
      return `char(${String(type.length)})`;
    // keyText is only produced for MySQL and SQL Server.
    case "varchar":
    case "keyText":
      return `varchar(${String(type.length)})`;
    case "enum": {
      const element = enums[type.enumId];
      return element === undefined
        ? FALLBACK_TYPE
        : quoteSqlIdentifier("postgresql", element.name);
    }
    // The DDL model already replaced an unsafe custom type with text.
    case "custom":
      return type.name;
  }
}
