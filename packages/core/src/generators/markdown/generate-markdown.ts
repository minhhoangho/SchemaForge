import type { Column } from "../../model/column.js";
import type { ColumnType } from "../../model/column-type.js";
import type { ColumnId } from "../../model/ids.js";
import {
  sortEnums,
  sortIndexes,
  sortRelations,
  sortTables,
} from "../../model/ordering.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import { findDefaultValueProblem } from "../../validation/rules/default-literals.js";
import {
  createDiagnostic,
  finalizeDiagnostics,
} from "../shared/diagnostics.js";
import type {
  Generate,
  GenerateResult,
  GeneratorOptions,
  MarkdownLabels,
} from "../shared/generator-types.js";
import { renderFileContent } from "../shared/render-file.js";
import { renderRelations } from "./markdown-relations.js";
import { formatMarkdownInline } from "./markdown-text.js";

export type MarkdownOptions = GeneratorOptions["markdown"];

type Block = readonly string[];

const SCHEMA_HEADING_LEVEL = 1;
const SECTION_HEADING_LEVEL = 2;
const ELEMENT_HEADING_LEVEL = 3;
const SUBSECTION_HEADING_LEVEL = 4;

function heading(level: number, text: string): string {
  return `${"#".repeat(level)} ${formatMarkdownInline(text)}`;
}

function listItem(text: string): string {
  return `- ${text}`;
}

// Every cell is escaped, so a `|` or a line break cannot end the cell or row.
function tableRow(cells: readonly string[]): string {
  const rendered = cells.map((cell) => {
    const text = formatMarkdownInline(cell);
    return text === "" ? " |" : ` ${text} |`;
  });
  return `|${rendered.join("")}`;
}

function markdownTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): Block {
  return [
    tableRow(headers),
    `|${"---|".repeat(headers.length)}`,
    ...rows.map(tableRow),
  ];
}

// Generic type names of the core model, not a dialect's names (CG-10).
function typeName(schema: SchemaDocument, type: ColumnType): string {
  switch (type.kind) {
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
    case "decimal":
      return `decimal(${String(type.precision)},${String(type.scale)})`;
    case "char":
    case "varchar":
      return `${type.kind}(${String(type.length)})`;
    case "enum":
      return schema.enums[type.enumId]?.name ?? "text";
    case "custom":
      return type.name;
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}

function isDefaultOmitted(schema: SchemaDocument, column: Column): boolean {
  return (
    column.defaultValue !== null &&
    findDefaultValueProblem(column.type, column.defaultValue, schema.enums) !==
      null
  );
}

function defaultText(schema: SchemaDocument, column: Column): string {
  const defaultValue = column.defaultValue;
  if (defaultValue === null || isDefaultOmitted(schema, column)) {
    return "";
  }
  switch (defaultValue.kind) {
    case "currentTimestamp":
      return "now()";
    case "generateUuid":
      return "gen_random_uuid()";
    case "literal":
      return defaultValue.value;
    default: {
      const unreachable: never = defaultValue;
      return unreachable;
    }
  }
}

function constraintsText(
  table: Table,
  column: Column,
  foreignKeyColumnIds: ReadonlySet<ColumnId>,
  labels: MarkdownLabels,
): string {
  return [
    ...(table.primaryKeyColumnIds.includes(column.id)
      ? [labels.primaryKey]
      : []),
    ...(column.isUnique ? [labels.unique] : []),
    ...(column.isAutoIncrement ? [labels.autoIncrement] : []),
    ...(foreignKeyColumnIds.has(column.id) ? [labels.foreignKey] : []),
  ].join(", ");
}

function tableColumns(
  schema: SchemaDocument,
  columnIds: readonly ColumnId[],
): readonly Column[] {
  return columnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    return column === undefined ? [] : [column];
  });
}

function renderColumnTable(
  schema: SchemaDocument,
  table: Table,
  foreignKeyColumnIds: ReadonlySet<ColumnId>,
  labels: MarkdownLabels,
): readonly Block[] {
  const columns = tableColumns(schema, table.columnIds);
  if (columns.length === 0) {
    return [];
  }
  const headers = [
    labels.columnNameHeader,
    labels.columnTypeHeader,
    labels.columnNullableHeader,
    labels.columnDefaultHeader,
    labels.columnConstraintsHeader,
    labels.columnCommentHeader,
  ];
  const rows = columns.map((column) => [
    column.name,
    typeName(schema, column.type),
    column.isNullable ? labels.yes : labels.no,
    defaultText(schema, column),
    constraintsText(table, column, foreignKeyColumnIds, labels),
    column.comment,
  ]);
  return [markdownTable(headers, rows)];
}

function renderIndexTable(
  schema: SchemaDocument,
  table: Table,
  labels: MarkdownLabels,
): readonly Block[] {
  const indexes = sortIndexes(schema).filter(
    (index) => index.tableId === table.id,
  );
  if (indexes.length === 0) {
    return [];
  }
  const headers = [
    labels.indexNameHeader,
    labels.indexColumnsHeader,
    labels.indexUniqueHeader,
  ];
  // Column names are joined raw: `tableRow` escapes the whole cell once.
  const rows = indexes.map((index) => [
    index.name,
    tableColumns(schema, index.columnIds)
      .map((column) => column.name)
      .join(", "),
    index.isUnique ? labels.yes : labels.no,
  ]);
  return [
    [heading(SUBSECTION_HEADING_LEVEL, labels.indexesHeading)],
    markdownTable(headers, rows),
  ];
}

function renderTable(
  schema: SchemaDocument,
  table: Table,
  foreignKeyColumnIds: ReadonlySet<ColumnId>,
  labels: MarkdownLabels,
): readonly Block[] {
  return [
    [heading(ELEMENT_HEADING_LEVEL, table.name)],
    table.comment === "" ? [] : [formatMarkdownInline(table.comment)],
    ...renderColumnTable(schema, table, foreignKeyColumnIds, labels),
    ...renderIndexTable(schema, table, labels),
    ...renderRelations(schema, table, labels),
  ];
}

function renderEnums(
  schema: SchemaDocument,
  labels: MarkdownLabels,
): readonly Block[] {
  const enums = sortEnums(schema);
  if (enums.length === 0) {
    return [];
  }
  return [
    [heading(SECTION_HEADING_LEVEL, labels.enumsHeading)],
    ...enums.flatMap((element) => [
      [heading(ELEMENT_HEADING_LEVEL, element.name)],
      element.values.map((value) => listItem(formatMarkdownInline(value))),
    ]),
  ];
}

function renderTables(
  schema: SchemaDocument,
  tables: readonly Table[],
  labels: MarkdownLabels,
): readonly Block[] {
  if (tables.length === 0) {
    return [];
  }
  const foreignKeyColumnIds: ReadonlySet<ColumnId> = new Set(
    sortRelations(schema).flatMap((relation) =>
      relation.columnPairs.map((pair) => pair.fromColumnId),
    ),
  );
  return [
    [heading(SECTION_HEADING_LEVEL, labels.tablesHeading)],
    ...tables.flatMap((table) =>
      renderTable(schema, table, foreignKeyColumnIds, labels),
    ),
  ];
}

export const generateMarkdown: Generate<"markdown"> = (
  schema: SchemaDocument,
  options: MarkdownOptions,
): GenerateResult => {
  const tables = sortTables(schema);
  const content = renderFileContent([
    [heading(SCHEMA_HEADING_LEVEL, schema.name)],
    ...renderEnums(schema, options.labels),
    ...renderTables(schema, tables, options.labels),
  ]);
  const diagnostics = tables
    .flatMap((table) => tableColumns(schema, table.columnIds))
    .filter((column) => isDefaultOmitted(schema, column))
    .map((column) =>
      createDiagnostic("default-omitted", [
        "columns",
        column.id,
        "defaultValue",
      ]),
    );
  return {
    file: { fileName: "schema.md", language: "markdown", content },
    diagnostics: finalizeDiagnostics(diagnostics),
  };
};
