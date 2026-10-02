import type { Column } from "../../model/column.js";
import type { ColumnType } from "../../model/column-type.js";
import type { ColumnId } from "../../model/ids.js";
import {
  sortEnums,
  sortIndexes,
  sortNotes,
  sortRelations,
  sortSubjectAreas,
  sortTables,
} from "../../model/ordering.js";
import type { ReferentialAction, Relation } from "../../model/relation.js";
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
} from "../shared/generator-types.js";
import { renderFileContent } from "../shared/render-file.js";
import { dbmlString, quoteDbmlIdentifier } from "./dbml-strings.js";

export type DbmlOptions = GeneratorOptions["dbml"];

const INDENT = "  ";
const NESTED_INDENT = "    ";

const ACTION_KEYWORDS: Readonly<Record<ReferentialAction, string>> = {
  noAction: "no action",
  restrict: "restrict",
  cascade: "cascade",
  setNull: "set null",
  setDefault: "set default",
};

// Numbers and booleans are written bare; every other literal is a string.
const BARE_LITERAL_KINDS: ReadonlySet<ColumnType["kind"]> = new Set([
  "smallint",
  "integer",
  "bigint",
  "decimal",
  "real",
  "double",
  "boolean",
]);

function renderType(schema: SchemaDocument, type: ColumnType): string {
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
    case "enum": {
      const element = schema.enums[type.enumId];
      return element === undefined ? "text" : quoteDbmlIdentifier(element.name);
    }
    case "custom":
      return quoteDbmlIdentifier(type.name);
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

function renderDefault(schema: SchemaDocument, column: Column): string | null {
  const defaultValue = column.defaultValue;
  if (defaultValue === null || isDefaultOmitted(schema, column)) {
    return null;
  }
  switch (defaultValue.kind) {
    case "currentTimestamp":
      return "`now()`";
    case "generateUuid":
      return "`gen_random_uuid()`";
    case "literal":
      return BARE_LITERAL_KINDS.has(column.type.kind)
        ? defaultValue.value
        : dbmlString(defaultValue.value);
    default: {
      const unreachable: never = defaultValue;
      return unreachable;
    }
  }
}

function renderColumn(
  schema: SchemaDocument,
  table: Table,
  column: Column,
): string {
  const defaultText = renderDefault(schema, column);
  const isSinglePrimaryKey =
    table.primaryKeyColumnIds.length === 1 &&
    table.primaryKeyColumnIds[0] === column.id;
  const settings = [
    ...(isSinglePrimaryKey ? ["pk"] : []),
    ...(column.isAutoIncrement ? ["increment"] : []),
    ...(column.isNullable ? [] : ["not null"]),
    ...(column.isUnique ? ["unique"] : []),
    ...(defaultText === null ? [] : [`default: ${defaultText}`]),
    ...(column.comment === "" ? [] : [`note: ${dbmlString(column.comment)}`]),
  ];
  const suffix = settings.length === 0 ? "" : ` [${settings.join(", ")}]`;
  return `${INDENT}${quoteDbmlIdentifier(column.name)} ${renderType(schema, column.type)}${suffix}`;
}

// Empty when a column is missing, so the caller skips the element instead of
// writing a partial column list.
function quotedColumnNames(
  schema: SchemaDocument,
  columnIds: readonly ColumnId[],
): readonly string[] {
  const names = columnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    return column === undefined ? [] : [quoteDbmlIdentifier(column.name)];
  });
  return names.length === columnIds.length ? names : [];
}

function indexLine(
  schema: SchemaDocument,
  columnIds: readonly ColumnId[],
  settings: string,
): readonly string[] {
  const names = quotedColumnNames(schema, columnIds);
  return names.length === 0
    ? []
    : [`${NESTED_INDENT}(${names.join(", ")}) [${settings}]`];
}

function renderIndexes(
  schema: SchemaDocument,
  table: Table,
): readonly string[] {
  const lines = [
    ...(table.primaryKeyColumnIds.length > 1
      ? indexLine(schema, table.primaryKeyColumnIds, "pk")
      : []),
    ...sortIndexes(schema)
      .filter((index) => index.tableId === table.id)
      .flatMap((index) => {
        const name = `name: ${dbmlString(index.name)}`;
        return indexLine(
          schema,
          index.columnIds,
          index.isUnique ? `unique, ${name}` : name,
        );
      }),
  ];
  return lines.length === 0
    ? []
    : [`${INDENT}indexes {`, ...lines, `${INDENT}}`];
}

function renderTable(schema: SchemaDocument, table: Table): readonly string[] {
  const columns = table.columnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    return column === undefined ? [] : [column];
  });
  const note =
    table.comment === "" ? [] : [`${INDENT}Note: ${dbmlString(table.comment)}`];
  return [
    `Table ${quoteDbmlIdentifier(table.name)} {`,
    ...columns.map((column) => renderColumn(schema, table, column)),
    ...renderIndexes(schema, table),
    ...note,
    "}",
  ];
}

// `"posts"."author_id"` for one column, `"posts".("a", "b")` for several.
function relationEnd(
  schema: SchemaDocument,
  table: Table | undefined,
  columnIds: readonly ColumnId[],
): string | undefined {
  const names = quotedColumnNames(schema, columnIds);
  const [onlyName] = names;
  if (table === undefined || onlyName === undefined) {
    return undefined;
  }
  const columns = names.length === 1 ? onlyName : `(${names.join(", ")})`;
  return `${quoteDbmlIdentifier(table.name)}.${columns}`;
}

function renderRelation(
  schema: SchemaDocument,
  relation: Relation,
): readonly string[] {
  const from = relationEnd(
    schema,
    schema.tables[relation.fromTableId],
    relation.columnPairs.map((pair) => pair.fromColumnId),
  );
  const to = relationEnd(
    schema,
    schema.tables[relation.toTableId],
    relation.columnPairs.map((pair) => pair.toColumnId),
  );
  if (from === undefined || to === undefined) {
    return [];
  }
  const operator = relation.kind === "oneToOne" ? "-" : ">";
  const actions = `delete: ${ACTION_KEYWORDS[relation.onDelete]}, update: ${ACTION_KEYWORDS[relation.onUpdate]}`;
  return [`Ref: ${from} ${operator} ${to} [${actions}]`];
}

function renderTableGroups(
  schema: SchemaDocument,
): readonly (readonly string[])[] {
  const tables = sortTables(schema);
  return sortSubjectAreas(schema).map((area) => [
    `TableGroup ${quoteDbmlIdentifier(area.name)} {`,
    ...tables
      .filter((table) => table.subjectAreaId === area.id)
      .map((table) => `${INDENT}${quoteDbmlIdentifier(table.name)}`),
    "}",
  ]);
}

// CG-09 has no options, so the implementation leaves out the second parameter
// of `Generate` instead of declaring an unused one.
export const generateDbml: Generate<"dbml"> = (
  schema: SchemaDocument,
): GenerateResult => {
  const tables = sortTables(schema);
  const content = renderFileContent([
    [`Project ${quoteDbmlIdentifier(schema.name)} {`, "}"],
    ...sortEnums(schema).map((element) => [
      `Enum ${quoteDbmlIdentifier(element.name)} {`,
      ...element.values.map(
        (value) => `${INDENT}${quoteDbmlIdentifier(value)}`,
      ),
      "}",
    ]),
    ...tables.map((table) => renderTable(schema, table)),
    sortRelations(schema).flatMap((relation) =>
      renderRelation(schema, relation),
    ),
    ...renderTableGroups(schema),
    ...sortNotes(schema).map((note, index) => [
      `Note ${quoteDbmlIdentifier(`note ${String(index + 1)}`)} {`,
      `${INDENT}${dbmlString(note.text)}`,
      "}",
    ]),
  ]);
  const diagnostics = tables
    .flatMap((table) => table.columnIds)
    .flatMap((columnId) => {
      const column = schema.columns[columnId];
      return column !== undefined && isDefaultOmitted(schema, column)
        ? [
            createDiagnostic("default-omitted", [
              "columns",
              columnId,
              "defaultValue",
            ]),
          ]
        : [];
    });
  return {
    file: { fileName: "schema.dbml", language: "dbml", content },
    diagnostics: finalizeDiagnostics(diagnostics),
  };
};
