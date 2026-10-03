import type { DocumentPath } from "../document-path.js";
import type { SeedDataset, SeedRow } from "../generators/seed/seed-dataset.js";
import { validateSeedDataset } from "../generators/seed/validate-seed-dataset.js";
import type { Column } from "../model/column.js";
import type { ColumnType } from "../model/column-type.js";
import type { ColumnId, TableId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import { err, ok } from "../result.js";
import type { Result } from "../result.js";
import type { AiEditError } from "./ai-edit-error-codes.js";
import type { AiSampleDataInput } from "./ai-edit-tools.js";
import {
  AI_MAX_SAMPLE_DEPTH,
  AI_MAX_SAMPLE_ROWS_PER_TURN,
} from "./ai-limits.js";
import { formatAiName } from "./describe-path-for-ai.js";
import { findColumnByName, findTableByName } from "./resolve-ai-names.js";

type SampleValue = Exclude<SeedRow[ColumnId], undefined>;
type SampleTable = AiSampleDataInput["tables"][number];
type SampleCell = SampleTable["rows"][number][number];
type SeedTable = SeedDataset["tables"][number];

type TranslatedTable = {
  readonly entry: SeedTable | null;
  readonly errors: readonly AiEditError[];
};

const INTEGER_PATTERN = /^-?\d+$/;
const FLOAT_PATTERN = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const BOOLEAN_TEXT = new Map([
  ["true", true],
  ["false", false],
]);

function toFiniteNumber(text: string, pattern: RegExp): number | undefined {
  const value = pattern.test(text) ? Number(text) : Number.NaN;
  return Number.isFinite(value) ? value : undefined;
}

function isJsonPrimitive(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  );
}

// Explicit stack, so text nested far past the limit cannot overflow the call
// stack. A primitive has depth 0 and each enclosing array or object adds one.
function isJsonWithinDepth(root: unknown): root is SampleValue {
  const stack = [{ value: root, enclosing: 0 }];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    const { value, enclosing } = node;
    if (typeof value === "object" && value !== null) {
      if (enclosing >= AI_MAX_SAMPLE_DEPTH) {
        return false;
      }
      for (const child of Object.values(value)) {
        stack.push({ value: child, enclosing: enclosing + 1 });
      }
    } else if (!isJsonPrimitive(value)) {
      return false;
    }
  }
  return true;
}

// Malformed text is an expected failure of model output, reported as an
// invalid value rather than thrown.
function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The seed JSON representation of a text value (spec part 6), or undefined when it does not convert. */
function toSampleValue(
  type: ColumnType,
  text: string | null,
): SampleValue | undefined {
  if (text === null) {
    return null;
  }
  switch (type.kind) {
    case "smallint":
    case "integer":
      return toFiniteNumber(text, INTEGER_PATTERN);
    case "real":
    case "double":
      return toFiniteNumber(text, FLOAT_PATTERN);
    case "boolean":
      return BOOLEAN_TEXT.get(text);
    case "json": {
      const parsed = parseJsonText(text);
      return isJsonWithinDepth(parsed) ? parsed : undefined;
    }
    case "bigint":
    case "decimal":
    case "char":
    case "varchar":
    case "text":
    case "uuid":
    case "date":
    case "time":
    case "timestamp":
    case "timestamptz":
    case "binary":
    case "enum":
    case "custom":
      return text;
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}

function describeCell(table: string, rowIndex: number, column: string): string {
  return `tables.${formatAiName(table)}.rows.${String(rowIndex)}.${formatAiName(column)}`;
}

function translateRow(
  table: Table,
  findColumn: (name: string) => Column | null,
  cells: readonly SampleCell[],
  rowPath: readonly ["tables", number, "rows", number],
): { readonly row: SeedRow; readonly errors: readonly AiEditError[] } {
  const values = new Map<ColumnId, SampleValue>();
  const errors: AiEditError[] = [];
  const at = (column: string): string =>
    describeCell(table.name, rowPath[3], column);
  for (const cell of cells) {
    const column = findColumn(cell.column);
    const value =
      column === null ? undefined : toSampleValue(column.type, cell.value);
    if (column === null) {
      errors.push({
        code: "column-name-not-found",
        path: rowPath,
        at: at(cell.column),
      });
    } else if (value === undefined || values.has(column.id)) {
      const path = [...rowPath, column.id];
      errors.push({ code: "seed-value-invalid", path, at: at(column.name) });
    } else {
      values.set(column.id, value);
    }
  }
  return { row: Object.fromEntries(values), errors };
}

function translateTable(
  schema: SchemaDocument,
  entry: SampleTable,
  tableIndex: number,
): TranslatedTable {
  const table = findTableByName(schema, entry.table);
  if (table === null) {
    const at = `tables.${formatAiName(entry.table)}`;
    return {
      entry: null,
      errors: [
        { code: "table-name-not-found", path: ["tables", tableIndex], at },
      ],
    };
  }
  // One lookup per distinct name: findColumnByName scans every column.
  const columnsByName = new Map<string, Column | null>();
  const findColumn = (name: string): Column | null => {
    const known = columnsByName.get(name);
    const column =
      known === undefined ? findColumnByName(schema, table, name) : known;
    columnsByName.set(name, column);
    return column;
  };
  const rows = entry.rows.map((cells, rowIndex) =>
    translateRow(table, findColumn, cells, [
      "tables",
      tableIndex,
      "rows",
      rowIndex,
    ]),
  );
  return {
    entry: { tableId: table.id, rows: rows.map(({ row }) => row) },
    errors: rows.flatMap(({ errors }) => errors),
  };
}

function describeSeedIssuePath(
  schema: SchemaDocument,
  tableIds: readonly TableId[],
  path: DocumentPath,
): string {
  const [, tableIndex, rowsKey, rowIndex, columnId] = path;
  const tableId =
    typeof tableIndex === "number" ? tableIds[tableIndex] : undefined;
  const table = tableId === undefined ? undefined : schema.tables[tableId];
  if (table === undefined) {
    return "tables";
  }
  const column = table.columnIds
    .map((id) => schema.columns[id])
    .find((candidate) => candidate?.id === columnId);
  return rowsKey === "rows" &&
    typeof rowIndex === "number" &&
    column !== undefined
    ? describeCell(table.name, rowIndex, column.name)
    : `tables.${formatAiName(table.name)}`;
}

/**
 * Translates `proposeSampleData` input by names into a seed dataset in the
 * given table order and checks it with `validateSeedDataset` (AI-R41). Every
 * error carries a path by names; the input is never changed.
 */
export function buildAiSampleDataset(
  original: SchemaDocument,
  input: AiSampleDataInput,
): Result<SeedDataset, readonly AiEditError[]> {
  const rowCount = input.tables.reduce(
    (total, entry) => total + entry.rows.length,
    0,
  );
  if (rowCount > AI_MAX_SAMPLE_ROWS_PER_TURN) {
    return err([{ code: "sample-rows-limit", path: ["tables"], at: "tables" }]);
  }
  const translated = input.tables.map((entry, index) =>
    translateTable(original, entry, index),
  );
  const errors = translated.flatMap((table) => table.errors);
  const tables = translated.flatMap(({ entry }) =>
    entry === null ? [] : [entry],
  );
  if (errors.length > 0) {
    return err(errors);
  }
  const dataset: SeedDataset = { tables };
  const issues = validateSeedDataset(original, dataset);
  const tableIds = tables.map((entry) => entry.tableId);
  return issues.length === 0
    ? ok(dataset)
    : err(
        issues.map((issue) => ({
          ...issue,
          at: describeSeedIssuePath(original, tableIds, issue.path),
        })),
      );
}
