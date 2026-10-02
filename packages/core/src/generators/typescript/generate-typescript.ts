import type { Column } from "../../model/column.js";
import type { Enum } from "../../model/enum.js";
import type { EnumId } from "../../model/ids.js";
import { sortEnums, sortTables } from "../../model/ordering.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import {
  createDiagnostic,
  finalizeDiagnostics,
} from "../shared/diagnostics.js";
import type {
  Generate,
  GenerateResult,
  GeneratorDiagnostic,
  GeneratorOptions,
} from "../shared/generator-types.js";
import { formatJsDocLines, formatPropertyKey } from "../shared/identifiers.js";
import { toJsonFieldType } from "../shared/json-representation.js";
import type { JsonFieldType } from "../shared/json-representation.js";
import { allocateModelNames } from "../shared/relation-field-names.js";
import { renderFileContent } from "../shared/render-file.js";

export type TypeScriptOptions = GeneratorOptions["typescript"];

// Always reserved, even when unused, so type names stay stable as the schema
// changes: a user type `Record` would shadow `Record<string, never>`.
const RESERVED_TYPE_NAMES: readonly string[] = ["JsonValue", "Record"];
const JSON_VALUE_DECLARATION =
  "export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };";
const EMPTY_OBJECT_TYPE = "Record<string, never>";
const EMPTY_UNION_TYPE = "never";
const PROPERTY_INDENT = "  ";

export function renderJsonFieldTypeScript(
  fieldType: JsonFieldType,
  enumTypeNames: ReadonlyMap<EnumId, string>,
): string {
  switch (fieldType.kind) {
    case "smallint":
    case "int32":
    case "float":
    case "double":
      return "number";
    case "bigintString":
    case "decimalString":
    case "string":
    case "uuid":
    case "date":
    case "time":
    case "localDateTime":
    case "offsetDateTime":
    case "base64":
      return "string";
    case "boolean":
      return "boolean";
    case "json":
      return "JsonValue";
    case "enum":
      return enumTypeNames.get(fieldType.enumId) ?? "string";
    case "unknown":
      return "unknown";
  }
}

function tableColumns(schema: SchemaDocument, table: Table): readonly Column[] {
  return table.columnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    return column === undefined ? [] : [column];
  });
}

function renderEnum(element: Enum, typeName: string): readonly string[] {
  const union =
    element.values.length === 0
      ? EMPTY_UNION_TYPE
      : element.values.map((value) => JSON.stringify(value)).join(" | ");
  return [`export type ${typeName} = ${union};`];
}

function renderProperty(
  column: Column,
  enumTypeNames: ReadonlyMap<EnumId, string>,
): readonly string[] {
  const fieldType = renderJsonFieldTypeScript(
    toJsonFieldType(column.type),
    enumTypeNames,
  );
  const type = column.isNullable ? `${fieldType} | null` : fieldType;
  return [
    ...formatJsDocLines(column.comment, PROPERTY_INDENT),
    `${PROPERTY_INDENT}${formatPropertyKey(column.name)}: ${type};`,
  ];
}

function renderTable(
  table: Table,
  columns: readonly Column[],
  typeName: string,
  enumTypeNames: ReadonlyMap<EnumId, string>,
): readonly string[] {
  const comment = formatJsDocLines(table.comment, "");
  if (columns.length === 0) {
    return [...comment, `export type ${typeName} = ${EMPTY_OBJECT_TYPE};`];
  }
  return [
    ...comment,
    `export type ${typeName} = {`,
    ...columns.flatMap((column) => renderProperty(column, enumTypeNames)),
    "};",
  ];
}

// CG-04 has no options, so the implementation leaves out the second parameter
// of `Generate` instead of declaring an unused one.
export const generateTypeScript: Generate<"typescript"> = (
  schema: SchemaDocument,
): GenerateResult => {
  const { enumNames, tableNames } = allocateModelNames(
    schema,
    RESERVED_TYPE_NAMES,
  );
  const tables = sortTables(schema).map((table) => ({
    table,
    columns: tableColumns(schema, table),
  }));
  const allColumns = tables.flatMap(({ columns }) => columns);
  const hasJsonColumn = allColumns.some(
    (column) => column.type.kind === "json",
  );
  const diagnostics: readonly GeneratorDiagnostic[] = allColumns
    .filter((column) => column.type.kind === "custom")
    .map((column) =>
      createDiagnostic("custom-type-unmapped", ["columns", column.id, "type"]),
    );
  const content = renderFileContent([
    hasJsonColumn ? [JSON_VALUE_DECLARATION] : [],
    ...sortEnums(schema).map((element) =>
      renderEnum(element, enumNames.get(element.id) ?? ""),
    ),
    ...tables.map(({ table, columns }) =>
      renderTable(table, columns, tableNames.get(table.id) ?? "", enumNames),
    ),
  ]);
  return {
    file: { fileName: "types.ts", language: "typescript", content },
    diagnostics: finalizeDiagnostics(diagnostics),
  };
};
