import type { TableId } from "../../model/ids.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
// The one import between two targets that spec CG-06 allows.
import { buildSeedDataset } from "../seed/build-seed-dataset.js";
import type { SeedRow } from "../seed/seed-dataset.js";
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
import { formatPropertyKey } from "../shared/identifiers.js";
import { buildRestApiNames } from "../shared/rest-resources.js";
import type { RestResource } from "../shared/rest-resources.js";
import { renderFileContent } from "../shared/render-file.js";
import { renderResourceHandlers } from "./mock-api-handlers.js";
import { renderJsValue } from "./render-js-value.js";

export type MockApiOptions = GeneratorOptions["mock-api"];

export const MOCK_ROWS_PER_TABLE = 5;
export const MOCK_SEED = 1;

const HEADER = [
  "// Mock REST API handlers for MSW 2 (npm install msw@^2).",
  "// Browser: run npx msw init <public dir>, then setupWorker(...handlers).start().",
  "// Node: setupServer(...handlers).listen() from msw/node.",
];
const IMPORT = ['import { http, HttpResponse } from "msw";'];
const ROW_TYPE = ["type Row = Record<string, unknown>;"];
const IS_ROW = [
  "function isRow(value: unknown): value is Row {",
  '  return typeof value === "object" && value !== null && !Array.isArray(value);',
  "}",
];
// String() so a path parameter (always a string) matches a numeric key; json
// keys compare by their string form, a known limitation.
const HAS_KEY = [
  "function hasKey(row: Row, columns: readonly string[], values: readonly unknown[]): boolean {",
  "  return columns.every((column, index) => String(row[column]) === String(values[index]));",
  "}",
];

type MockTable = {
  readonly resource: RestResource;
  readonly table: Table;
  readonly rowsVariable: string;
  readonly rows: readonly SeedRow[];
};

function renderRow(schema: SchemaDocument, table: Table, row: SeedRow): string {
  const properties = table.columnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    const value = row[columnId];
    return column === undefined || value === undefined
      ? []
      : [`${formatPropertyKey(column.name)}: ${renderJsValue(value)}`];
  });
  return properties.length === 0 ? "  {}," : `  { ${properties.join(", ")} },`;
}

function renderRows(schema: SchemaDocument, mock: MockTable): string[] {
  const declaration = `const ${mock.rowsVariable}: Row[] = [`;
  if (mock.rows.length === 0) {
    return [`${declaration}];`];
  }
  return [
    declaration,
    ...mock.rows.map((row) => renderRow(schema, mock.table, row)),
    "];",
  ];
}

function keyColumnNames(
  schema: SchemaDocument,
  resource: RestResource,
): readonly string[] {
  return resource.keyParameters.flatMap(
    (parameter) => schema.columns[parameter.columnId]?.name ?? [],
  );
}

function renderHandlers(
  schema: SchemaDocument,
  mocks: readonly MockTable[],
): string[] {
  if (mocks.length === 0) {
    return ["export const handlers = [];"];
  }
  return [
    "export const handlers = [",
    ...mocks.flatMap((mock) =>
      renderResourceHandlers({
        resource: mock.resource,
        rowsVariable: mock.rowsVariable,
        keyColumnNames: keyColumnNames(schema, mock.resource),
      }),
    ),
    "];",
  ];
}

function listTargetDiagnostics(
  schema: SchemaDocument,
  mocks: readonly MockTable[],
): GeneratorDiagnostic[] {
  return mocks.flatMap(({ resource, table }) => [
    ...(resource.keyParameters.length === 0
      ? [createDiagnostic("table-without-identifier", ["tables", table.id])]
      : []),
    ...table.columnIds
      .filter((columnId) => schema.columns[columnId]?.type.kind === "custom")
      .map((columnId) =>
        createDiagnostic("custom-type-unmapped", ["columns", columnId, "type"]),
      ),
  ]);
}

// CG-06 has no options, so the implementation leaves out the second parameter
// of `Generate` instead of declaring an unused one.
export const generateMockApi: Generate<"mock-api"> = (
  schema: SchemaDocument,
): GenerateResult => {
  const seed = buildSeedDataset(schema, {
    rowsPerTable: MOCK_ROWS_PER_TABLE,
    seed: MOCK_SEED,
  });
  const rowsByTable = new Map<TableId, readonly SeedRow[]>(
    seed.dataset.tables.map((entry) => [entry.tableId, entry.rows]),
  );
  const mocks = buildRestApiNames(schema).resources.flatMap((resource) => {
    const table = schema.tables[resource.tableId];
    return table === undefined
      ? []
      : [
          {
            resource,
            table,
            rowsVariable: `rows${resource.typeName}`,
            rows: rowsByTable.get(table.id) ?? [],
          },
        ];
  });
  const hasTables = mocks.length > 0;
  const hasPrimaryKey = mocks.some(
    (mock) => mock.resource.keyParameters.length > 0,
  );
  const content = renderFileContent([
    HEADER,
    hasTables ? IMPORT : [],
    hasTables ? ROW_TYPE : [],
    hasTables ? IS_ROW : [],
    hasPrimaryKey ? HAS_KEY : [],
    ...mocks.map((mock) => renderRows(schema, mock)),
    renderHandlers(schema, mocks),
  ]);
  return {
    file: { fileName: "handlers.ts", language: "typescript", content },
    diagnostics: finalizeDiagnostics([
      ...seed.diagnostics,
      ...listTargetDiagnostics(schema, mocks),
    ]),
  };
};
