import type { Column } from "../../model/column.js";
import type { Enum } from "../../model/enum.js";
import type { EnumId } from "../../model/ids.js";
import { sortEnums } from "../../model/ordering.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import { createDiagnostic } from "../shared/diagnostics.js";
import type { GeneratorDiagnostic } from "../shared/generator-types.js";
import {
  BIGINT_STRING_PATTERN,
  LOCAL_DATE_TIME_PATTERN,
  SMALLINT_MAXIMUM,
  SMALLINT_MINIMUM,
  TIME_PATTERN,
  decimalStringPattern,
  toJsonFieldType,
} from "../shared/json-representation.js";
import type {
  JsonFieldType,
  JsonValue,
} from "../shared/json-representation.js";
import type { RestApiNames } from "../shared/rest-resources.js";

export type JsonObject = Readonly<Record<string, JsonValue>>;

export type ComponentSchemas = {
  readonly schemas: JsonObject;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

const COMPONENT_REF_PREFIX = "#/components/schemas/";

export function componentRef(typeName: string): JsonObject {
  return { $ref: `${COMPONENT_REF_PREFIX}${typeName}` };
}

function buildFieldSchema(
  fieldType: JsonFieldType,
  enumTypeNames: ReadonlyMap<EnumId, string>,
): JsonObject {
  switch (fieldType.kind) {
    case "smallint":
      return {
        type: "integer",
        minimum: SMALLINT_MINIMUM,
        maximum: SMALLINT_MAXIMUM,
      };
    case "int32":
      return { type: "integer", format: "int32" };
    case "bigintString":
      return { type: "string", pattern: BIGINT_STRING_PATTERN };
    case "decimalString":
      return {
        type: "string",
        pattern: decimalStringPattern(fieldType.precision, fieldType.scale),
      };
    case "float":
    case "double":
      return { type: "number", format: fieldType.kind };
    case "boolean":
      return { type: "boolean" };
    case "string":
      return fieldType.maxLength === null
        ? { type: "string" }
        : { type: "string", maxLength: fieldType.maxLength };
    case "uuid":
    case "date":
      return { type: "string", format: fieldType.kind };
    case "time":
      return { type: "string", pattern: TIME_PATTERN };
    case "localDateTime":
      return { type: "string", pattern: LOCAL_DATE_TIME_PATTERN };
    case "offsetDateTime":
      return { type: "string", format: "date-time" };
    case "base64":
      return { type: "string", contentEncoding: "base64" };
    case "enum": {
      const typeName = enumTypeNames.get(fieldType.enumId);
      return typeName === undefined
        ? { type: "string" }
        : componentRef(typeName);
    }
    case "json":
    case "unknown":
      return {};
  }
}

// `{}` already accepts null, so it stays as is.
function withNull(schema: JsonObject): JsonObject {
  const { type } = schema;
  if (typeof type === "string") {
    return { ...schema, type: [type, "null"] };
  }
  if (Object.hasOwn(schema, "$ref")) {
    return { anyOf: [schema, { type: "null" }] };
  }
  return schema;
}

export function buildPropertySchema(
  column: Column,
  enumTypeNames: ReadonlyMap<EnumId, string>,
): JsonObject {
  const base = buildFieldSchema(toJsonFieldType(column.type), enumTypeNames);
  const schema = column.isNullable ? withNull(base) : base;
  return column.comment === ""
    ? schema
    : { ...schema, description: column.comment };
}

function tableColumns(schema: SchemaDocument, table: Table): readonly Column[] {
  return table.columnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    return column === undefined ? [] : [column];
  });
}

function buildEnumSchema(element: Enum): JsonObject {
  return { type: "string", enum: element.values };
}

function buildTableSchema(
  table: Table,
  columns: readonly Column[],
  enumTypeNames: ReadonlyMap<EnumId, string>,
): JsonObject {
  return {
    type: "object",
    ...(table.comment === "" ? {} : { description: table.comment }),
    properties: Object.fromEntries(
      columns.map((column) => [
        column.name,
        buildPropertySchema(column, enumTypeNames),
      ]),
    ),
    // JSON Schema requires unique items; a repeated column name is a semantic issue.
    required: [...new Set(columns.map((column) => column.name))],
  };
}

/** Enum components, then table components, in the order of `names`. */
export function buildComponentSchemas(
  schema: SchemaDocument,
  names: RestApiNames,
): ComponentSchemas {
  const enumEntries = sortEnums(schema).map((element): [string, JsonValue] => [
    names.enumTypeNames.get(element.id) ?? "",
    buildEnumSchema(element),
  ]);
  const tables = names.resources.flatMap((resource) => {
    const table = schema.tables[resource.tableId];
    return table === undefined
      ? []
      : [{ resource, table, columns: tableColumns(schema, table) }];
  });
  const tableEntries = tables.map(
    ({ resource, table, columns }): [string, JsonValue] => [
      resource.typeName,
      buildTableSchema(table, columns, names.enumTypeNames),
    ],
  );
  const diagnostics = tables
    .flatMap(({ columns }) => columns)
    .filter((column) => column.type.kind === "custom")
    .map((column) =>
      createDiagnostic("custom-type-unmapped", ["columns", column.id, "type"]),
    );
  return {
    schemas: Object.fromEntries([...enumEntries, ...tableEntries]),
    diagnostics,
  };
}
