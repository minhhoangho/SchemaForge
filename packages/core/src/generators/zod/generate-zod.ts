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
import {
  formatJsDocLines,
  formatPropertyKey,
  toCamelCaseIdentifier,
} from "../shared/identifiers.js";
import type { JsonFieldType } from "../shared/json-representation.js";
import {
  BIGINT_STRING_PATTERN,
  SMALLINT_MAXIMUM,
  SMALLINT_MINIMUM,
  decimalStringPattern,
  toJsonFieldType,
} from "../shared/json-representation.js";
import { createNameAllocator } from "../shared/name-allocator.js";
import { renderFileContent } from "../shared/render-file.js";

export type ZodOptions = GeneratorOptions["zod"];

const FILE_NAME = "schemas.ts";
const IMPORT_LINE = 'import { z } from "zod";';
const SCHEMA_SUFFIX = "Schema";

// A regex literal would need "/" escaped; a JSON string is always a valid
// JavaScript string literal, so the pattern is written through new RegExp.
function regexString(pattern: string): string {
  return `z.string().regex(new RegExp(${JSON.stringify(pattern)}))`;
}

export function renderJsonFieldZod(
  fieldType: JsonFieldType,
  enumSchemaNames: ReadonlyMap<EnumId, string>,
): string {
  switch (fieldType.kind) {
    case "smallint":
      return `z.int().min(${String(SMALLINT_MINIMUM)}).max(${String(SMALLINT_MAXIMUM)})`;
    case "int32":
      return "z.int32()";
    case "bigintString":
      return regexString(BIGINT_STRING_PATTERN);
    case "decimalString":
      return regexString(
        decimalStringPattern(fieldType.precision, fieldType.scale),
      );
    case "float":
    case "double":
      return "z.number()";
    case "boolean":
      return "z.boolean()";
    case "string":
      return fieldType.maxLength === null
        ? "z.string()"
        : `z.string().max(${String(fieldType.maxLength)})`;
    case "uuid":
      return "z.guid()";
    case "date":
      return "z.iso.date()";
    case "time":
      return "z.iso.time()";
    case "localDateTime":
      return "z.iso.datetime({ local: true })";
    case "offsetDateTime":
      return "z.iso.datetime({ offset: true })";
    case "json":
      return "z.json()";
    case "base64":
      return "z.base64()";
    case "enum":
      return enumSchemaNames.get(fieldType.enumId) ?? "z.string()";
    case "unknown":
      return "z.unknown()";
    default: {
      const unreachable: never = fieldType;
      return unreachable;
    }
  }
}

function renderEnum(enumElement: Enum, schemaName: string): readonly string[] {
  const schema =
    enumElement.values.length === 0
      ? "z.never()"
      : `z.enum([${enumElement.values.map((value) => JSON.stringify(value)).join(", ")}])`;
  return [`export const ${schemaName} = ${schema};`];
}

function renderColumn(
  column: Column,
  enumSchemaNames: ReadonlyMap<EnumId, string>,
): readonly string[] {
  const schema = renderJsonFieldZod(
    toJsonFieldType(column.type),
    enumSchemaNames,
  );
  const nullable = column.isNullable ? ".nullable()" : "";
  return [
    ...formatJsDocLines(column.comment, "  "),
    `  ${formatPropertyKey(column.name)}: ${schema}${nullable},`,
  ];
}

function tableColumns(schema: SchemaDocument, table: Table): readonly Column[] {
  return table.columnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    return column === undefined ? [] : [column];
  });
}

function renderTable(
  table: Table,
  columns: readonly Column[],
  schemaName: string,
  enumSchemaNames: ReadonlyMap<EnumId, string>,
): readonly string[] {
  const jsDoc = formatJsDocLines(table.comment, "");
  if (columns.length === 0) {
    return [...jsDoc, `export const ${schemaName} = z.object({});`];
  }
  return [
    ...jsDoc,
    `export const ${schemaName} = z.object({`,
    ...columns.flatMap((column) => renderColumn(column, enumSchemaNames)),
    "});",
  ];
}

function customTypeDiagnostics(
  columns: readonly Column[],
): readonly GeneratorDiagnostic[] {
  return columns
    .filter((column) => column.type.kind === "custom")
    .map((column) =>
      createDiagnostic("custom-type-unmapped", ["columns", column.id, "type"]),
    );
}

export const generateZod: Generate<"zod"> = (
  schema: SchemaDocument,
): GenerateResult => {
  const allocator = createNameAllocator({
    reserved: ["z"],
    comparison: "exact",
    separator: "",
    maxBytes: null,
  });
  // Enums first, so a table schema never references a later declaration.
  const enums = sortEnums(schema).map((enumElement) => ({
    enumElement,
    schemaName: allocator.allocate(
      toCamelCaseIdentifier(enumElement.name, "enum") + SCHEMA_SUFFIX,
    ),
  }));
  const enumSchemaNames = new Map(
    enums.map(({ enumElement, schemaName }) => [enumElement.id, schemaName]),
  );
  const tables = sortTables(schema).map((table) => ({
    table,
    columns: tableColumns(schema, table),
    schemaName: allocator.allocate(
      toCamelCaseIdentifier(table.name, "table") + SCHEMA_SUFFIX,
    ),
  }));

  const content = renderFileContent([
    enums.length + tables.length > 0 ? [IMPORT_LINE] : [],
    ...enums.map(({ enumElement, schemaName }) =>
      renderEnum(enumElement, schemaName),
    ),
    ...tables.map(({ table, columns, schemaName }) =>
      renderTable(table, columns, schemaName, enumSchemaNames),
    ),
  ]);

  return {
    file: { fileName: FILE_NAME, language: "typescript", content },
    diagnostics: finalizeDiagnostics(
      tables.flatMap(({ columns }) => customTypeDiagnostics(columns)),
    ),
  };
};
