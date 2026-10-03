import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createEmptySchema } from "../model/create-empty-schema.js";
import type { ColumnId, GenerateId } from "../model/ids.js";
import { sortEnums, sortTables } from "../model/ordering.js";
import { referentialActionShape } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import { applyOperation } from "../operations/apply-operation.js";
import type { Operation } from "../operations/operation.js";
import { parseSchemaDocument } from "../parse/parse-schema-document.js";
import { PROPERTY_SEED } from "../testing/arbitraries.js";
import { createCounterIdGenerator } from "../testing/factories.js";
import { createSampleSchema } from "../testing/sample-schema.js";
import { unwrapOk } from "../testing/unwrap-result.js";
import { findIntroducedIssues } from "../validation/find-introduced-issues.js";
import type { AiColumnSpec, AiEdit } from "./ai-edit-tools.js";
import {
  AI_COLUMN_TYPE_KINDS,
  aiEditToolInputShapes,
} from "./ai-edit-tools.js";
import { applyAiEdit } from "./apply-ai-edit.js";
import type { AiTablePlacement } from "./place-ai-table.js";
import { createAiTablePlacement } from "./place-ai-table.js";

// The plan fixes 100 runs for these properties (Task 9).
const PROPERTY_PARAMETERS = { seed: PROPERTY_SEED, numRuns: 100 };
const PROPERTY_TIMEOUT_MS = 60_000;
const MAX_TURN_CALLS = 15;
const MAX_PICK = 999;
// Weights toward names that resolve, so most calls reach applyOperation.
const LIKELY_WEIGHT = 3;
// A call names two tables at most, so a stale name is kept rare.
const EXISTING_REFERENCE_WEIGHT = 9;
const VARCHAR_LENGTH = 64;
const DECIMAL_PRECISION = 10;
const DECIMAL_SCALE = 2;

// Collide with the sample schema case-insensitively ("Users", "ORDER_STATUS",
// "id") or look like prototype keys, so some calls are rejected.
const EDGE_NAMES = ["id", "Users", "ORDER_STATUS", "__proto__", "constructor"];
const ENUM_VALUES = ["low", "high", "__proto__"];

// Parsing freezes a document, so a call that mutated its input would throw.
const SAMPLE = unwrapOk(parseSchemaDocument(createSampleSchema()));
const EMPTY = unwrapOk(parseSchemaDocument(createEmptySchema("property")));

function likely<Value>(
  arbitrary: fc.Arbitrary<Value>,
  unlikely: fc.Arbitrary<Value>,
): fc.Arbitrary<Value> {
  return fc.oneof({ arbitrary, weight: LIKELY_WEIGHT }, unlikely);
}

const newName = likely(
  fc.stringMatching(/^[a-z][a-z0-9_]{0,11}$/),
  fc.constantFrom(...EDGE_NAMES),
);

// A reference to an existing element, or (unlikely) to a name the draft lacks.
const reference = fc.record({
  isExisting: fc.oneof(
    { arbitrary: fc.constant(true), weight: EXISTING_REFERENCE_WEIGHT },
    fc.constant(false),
  ),
  pick: fc.nat({ max: MAX_PICK }),
  fallback: newName,
});
type Reference = typeof reference extends fc.Arbitrary<infer T> ? T : never;

const optional = <Value>(arbitrary: fc.Arbitrary<Value>) =>
  fc.option(arbitrary, { nil: undefined });

const columnPlan = fc.record({
  name: newName,
  kind: fc.constantFrom(...AI_COLUMN_TYPE_KINDS),
  enumName: reference,
  // A nullable primary key column is rejected.
  isNullable: likely(fc.constant(false), fc.constant(true)),
  isUnique: likely(fc.constant(false), fc.constant(true)),
  defaultValue: likely(
    fc.constantFrom(undefined, null),
    fc.constantFrom<AiColumnSpec["defaultValue"]>(
      { kind: "literal", value: "0" },
      { kind: "currentTimestamp" },
      { kind: "generateUuid" },
    ),
  ),
});
type ColumnPlan = typeof columnPlan extends fc.Arbitrary<infer T> ? T : never;

const references = fc.array(reference, { minLength: 1, maxLength: 2 });
const callPlan = fc.oneof(
  fc.record({
    tool: fc.constant("createTable" as const),
    name: newName,
    columns: fc.array(columnPlan, { minLength: 1, maxLength: 3 }),
    // Indexes into the columns; one past the end is dropped.
    primaryKey: fc.uniqueArray(fc.nat({ max: 3 }), { maxLength: 2 }),
  }),
  fc.record({
    tool: fc.constantFrom("addColumn" as const, "updateColumn" as const),
    table: reference,
    column: columnPlan,
    target: reference,
    hasTypeChange: fc.boolean(),
  }),
  fc.record({
    tool: fc.constantFrom("removeColumn" as const, "removeTable" as const),
    table: reference,
    column: reference,
  }),
  fc.record({
    tool: fc.constant("addRelation" as const),
    branch: fc.constantFrom("manyToMany", "fromColumns", "newColumn"),
    fromTable: reference,
    toTable: reference,
    kind: fc.constantFrom("oneToOne" as const, "oneToMany" as const),
    fromColumns: references,
    junctionTable: optional(newName),
    onDelete: fc.constantFrom(...referentialActionShape.options),
  }),
  fc.record({
    tool: fc.constant("addIndex" as const),
    table: reference,
    columns: references,
    isUnique: fc.boolean(),
    name: optional(newName),
  }),
  fc.record({
    tool: fc.constant("createEnum" as const),
    name: newName,
    values: fc.subarray(ENUM_VALUES, { minLength: 1 }),
  }),
);
type CallPlan = typeof callPlan extends fc.Arbitrary<infer T> ? T : never;

const turnArbitrary = fc.record({
  original: likely(fc.constant(SAMPLE), fc.constant(EMPTY)),
  plans: fc.array(callPlan, { minLength: 1, maxLength: MAX_TURN_CALLS }),
});

function pick<Item>(items: readonly Item[], choice: Reference): Item | null {
  return choice.isExisting ? (items[choice.pick % items.length] ?? null) : null;
}

function pickTable(schema: SchemaDocument, choice: Reference): Table | null {
  return pick(sortTables(schema), choice);
}

function tableName(schema: SchemaDocument, choice: Reference): string {
  return pickTable(schema, choice)?.name ?? choice.fallback;
}

function columnName(
  schema: SchemaDocument,
  table: Table | null,
  choice: Reference,
): string {
  const id = pick(table?.columnIds ?? [], choice);
  return (
    (id === null ? undefined : schema.columns[id]?.name) ?? choice.fallback
  );
}

type AiColumnType = AiColumnSpec["type"];

// The parameters a kind requires; enum is resolved against the draft and the
// other kinds take none.
const TYPE_PARAMETERS = new Map<
  AiColumnType["kind"],
  Omit<AiColumnType, "kind">
>([
  ["char", { length: VARCHAR_LENGTH }],
  ["varchar", { length: VARCHAR_LENGTH }],
  ["decimal", { precision: DECIMAL_PRECISION, scale: DECIMAL_SCALE }],
  ["custom", { customName: "geometry" }],
]);

function columnType(schema: SchemaDocument, plan: ColumnPlan): AiColumnType {
  if (plan.kind === "enum") {
    const enumName = pick(sortEnums(schema), plan.enumName)?.name;
    return { kind: plan.kind, enumName: enumName ?? plan.enumName.fallback };
  }
  return { kind: plan.kind, ...TYPE_PARAMETERS.get(plan.kind) };
}

function columnSpec(schema: SchemaDocument, plan: ColumnPlan): AiColumnSpec {
  const { name, isNullable, isUnique, defaultValue } = plan;
  const type = columnType(schema, plan);
  return defaultValue === undefined
    ? { name, type, isNullable, isUnique }
    : { name, type, isNullable, isUnique, defaultValue };
}

// Prefers a column of the key column's type kind: other pairings are
// rejected with relation-column-type-mismatch.
function sourceColumn(
  schema: SchemaDocument,
  from: Table | null,
  keyId: ColumnId | null,
  choice: Reference,
): string {
  const kind = keyId === null ? null : schema.columns[keyId]?.type.kind;
  const sameKind = (from?.columnIds ?? [])
    .flatMap((id) => schema.columns[id] ?? [])
    .filter((column) => column.type.kind === kind);
  return pick(sameKind, choice)?.name ?? columnName(schema, from, choice);
}

function relationEdit(
  schema: SchemaDocument,
  plan: Extract<CallPlan, { tool: "addRelation" }>,
): AiEdit {
  const from = pickTable(schema, plan.fromTable);
  const fromTable = tableName(schema, plan.fromTable);
  const base = { fromTable, toTable: tableName(schema, plan.toTable) };
  const { kind, onDelete, junctionTable } = plan;
  switch (plan.branch) {
    case "manyToMany": {
      const junction = junctionTable === undefined ? {} : { junctionTable };
      return {
        tool: "addRelation",
        input: { ...base, kind: "manyToMany", onDelete, ...junction },
      };
    }
    case "fromColumns": {
      // One source column per target key column, so most pairings line up.
      const keyIds = pickTable(schema, plan.toTable)?.primaryKeyColumnIds ?? [];
      const fromColumns = (keyIds.length > 0 ? keyIds : [null]).map(
        (keyId, index) =>
          sourceColumn(
            schema,
            from,
            keyId,
            plan.fromColumns[index % plan.fromColumns.length] ?? plan.fromTable,
          ),
      );
      return {
        tool: "addRelation",
        input: { ...base, kind, onDelete, fromColumns },
      };
    }
    case "newColumn":
      return { tool: "addRelation", input: { ...base, kind, onDelete } };
  }
}

function columnEdit(
  schema: SchemaDocument,
  plan: Extract<CallPlan, { tool: "addColumn" | "updateColumn" }>,
): AiEdit {
  const table = pickTable(schema, plan.table);
  const name = tableName(schema, plan.table);
  const target = columnName(schema, table, plan.target);
  if (plan.tool === "addColumn") {
    const column = columnSpec(schema, plan.column);
    return { tool: "addColumn", input: { table: name, column, after: target } };
  }
  const { isNullable, isUnique } = plan.column;
  const type = plan.hasTypeChange
    ? { type: columnType(schema, plan.column) }
    : {};
  return {
    tool: "updateColumn",
    input: { table: name, column: target, isNullable, isUnique, ...type },
  };
}

// Resolves a plan against the current draft, the way the model names
// elements it has seen in the schema view or created earlier in the turn.
function toEdit(schema: SchemaDocument, plan: CallPlan): AiEdit {
  switch (plan.tool) {
    case "createTable": {
      const columns = plan.columns.map((column) => columnSpec(schema, column));
      const names = columns.map((column) => column.name);
      const primaryKey = plan.primaryKey.flatMap(
        (index) => names[index % names.length] ?? [],
      );
      return {
        tool: "createTable",
        input: { name: plan.name, columns, primaryKey },
      };
    }
    case "addColumn":
    case "updateColumn":
      return columnEdit(schema, plan);
    case "removeColumn": {
      const table = pickTable(schema, plan.table);
      const column = columnName(schema, table, plan.column);
      return {
        tool: "removeColumn",
        input: { table: tableName(schema, plan.table), column },
      };
    }
    case "removeTable":
      return {
        tool: "removeTable",
        input: { table: tableName(schema, plan.table) },
      };
    case "addRelation":
      return relationEdit(schema, plan);
    case "addIndex": {
      const table = pickTable(schema, plan.table);
      const columns = plan.columns.map((choice) =>
        columnName(schema, table, choice),
      );
      const { isUnique, name } = plan;
      const named = name === undefined ? {} : { name: `${name}_index` };
      return {
        tool: "addIndex",
        input: {
          table: tableName(schema, plan.table),
          columns,
          isUnique,
          ...named,
        },
      };
    }
    case "createEnum":
      return {
        tool: "createEnum",
        input: { name: plan.name, values: plan.values },
      };
  }
}

type Turn = {
  readonly draft: SchemaDocument;
  readonly edits: readonly AiEdit[];
  readonly operations: readonly Operation[];
  readonly placement: AiTablePlacement;
};

// Applies the calls one by one on a draft and skips a rejected call, as the
// backend does (AI-R15), keeping the operations of the accepted calls.
function runTurn(original: SchemaDocument, plans: readonly CallPlan[]): Turn {
  const counter = createCounterIdGenerator();
  // A prefix keeps new ids clear of the counter ids of the sample schema.
  const generateId: GenerateId = () => `ai${counter()}`;
  const placement = createAiTablePlacement(original);
  const start: Turn = { draft: original, edits: [], operations: [], placement };
  return plans.reduce<Turn>((turn, plan) => {
    const edit = toEdit(turn.draft, plan);
    const edits = [...turn.edits, edit];
    const context = { generateId, placement: turn.placement };
    const result = applyAiEdit(turn.draft, edit, context);
    if (!result.isOk) {
      return { ...turn, edits };
    }
    const { schema, operation, placedTables } = result.value;
    const { originX, placedCount } = turn.placement;
    return {
      draft: schema,
      edits,
      operations: [...turn.operations, operation],
      placement: { originX, placedCount: placedCount + placedTables },
    };
  }, start);
}

function isValidToolInput(edit: AiEdit): boolean {
  return aiEditToolInputShapes[edit.tool].safeParse(edit.input).success;
}

describe("applyAiEdit properties", () => {
  it(
    "generates only tool inputs that pass their tool input shapes",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(turnArbitrary, ({ original, plans }) => {
          const { edits } = runTurn(original, plans);

          expect(edits.filter((edit) => !isValidToolInput(edit))).toStrictEqual(
            [],
          );
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "applies every accepted call of a random turn to the original document without new issues",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(turnArbitrary, ({ original, plans }) => {
          const { draft, operations } = runTurn(original, plans);

          const applied = applyOperation(original, {
            type: "batch",
            operations,
          });

          const { schema } = unwrapOk(applied);
          expect(schema).toStrictEqual(draft);
          expect(findIntroducedIssues(original, schema)).toStrictEqual([]);
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it(
    "restores the original document with the inverse of the turn batch",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(turnArbitrary, ({ original, plans }) => {
          const { operations } = runTurn(original, plans);
          const batch = { type: "batch" as const, operations };
          const applied = unwrapOk(applyOperation(original, batch));

          const restored = applyOperation(applied.schema, applied.inverse);

          expect(unwrapOk(restored).schema).toStrictEqual(original);
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );
});
