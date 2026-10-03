import type { ColumnId, RelationId, TableId } from "../../model/ids.js";
import {
  sortIndexes,
  sortRelations,
  sortTables,
} from "../../model/ordering.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import type { Index } from "../../model/table-index.js";
import {
  createDiagnostic,
  finalizeDiagnostics,
} from "../shared/diagnostics.js";
import type { GeneratorDiagnostic } from "../shared/generator-types.js";
import {
  buildLoadOrder,
  propagateSkippedTables,
} from "../shared/relation-graph.js";
import { assertSeedDatasetOptions } from "./seed-dataset.js";
import type { SeedDataset, SeedDatasetOptions } from "./seed-dataset.js";
import { createTableSeedRandom } from "./seed-random.js";
import {
  assignRelation,
  commitChoices,
  fillDeferredRelations,
  listCompleteTargets,
  toSeedRow,
} from "./seed-relations.js";
import type {
  BuiltRow,
  Choice,
  RelationSource,
  RelationState,
} from "./seed-relations.js";
import { findFixedSeedValue, generateColumnValue } from "./seed-values.js";
import {
  listSeedUniqueKeys,
  toSeedValuesKey,
} from "./validate-seed-dataset.js";

// Attempts per row, the first one included; then the table stops (Vấn đề 20).
export const SEED_MAX_ROW_ATTEMPTS = 20;

type TablePlan = RelationSource & {
  // Relations set while the row is built (not deferred), in sortRelations order.
  readonly relations: readonly Relation[];
  readonly sourceColumnIds: ReadonlySet<ColumnId>;
  readonly deferredColumnIds: readonly ColumnId[];
  readonly keyColumnIds: ReadonlySet<ColumnId>;
  readonly primaryKeyColumnIds: ReadonlySet<ColumnId>;
  readonly counters: Map<ColumnId, number>;
  // listCompleteTargets of each relation in `relations`; their target tables
  // are already built and do not change while this table is.
  readonly completeTargets: ReadonlyMap<RelationId, readonly number[]>;
};

function findUnseedableTableIds(schema: SchemaDocument): readonly TableId[] {
  return sortTables(schema)
    .filter((table) =>
      table.columnIds.some((columnId) => {
        const column = schema.columns[columnId];
        return (
          column !== undefined &&
          findFixedSeedValue(column, schema.enums)?.kind === "none"
        );
      }),
    )
    .map((table) => table.id);
}

function sourceColumnsOf(relation: Relation): readonly ColumnId[] {
  return relation.columnPairs.map((pair) => pair.fromColumnId);
}

function planTable(
  state: RelationState,
  table: Table,
  seed: number,
  // Sorted once per dataset, not once per table.
  relations: readonly Relation[],
  indexes: readonly Index[],
): TablePlan {
  const outgoing = relations.filter(
    (relation) => relation.fromTableId === table.id,
  );
  const pairColumnIds = relations
    .filter(
      (relation) =>
        relation.fromTableId === table.id || relation.toTableId === table.id,
    )
    .flatMap((relation) =>
      relation.columnPairs.flatMap((pair) => [
        pair.fromColumnId,
        pair.toColumnId,
      ]),
    );
  const uniqueKeys = listSeedUniqueKeys(state.schema, table, indexes);
  const builtRelations = outgoing.filter(
    (relation) => !state.deferredIds.has(relation.id),
  );
  return {
    table,
    random: createTableSeedRandom(seed, table.name),
    relations: builtRelations,
    sourceColumnIds: new Set(outgoing.flatMap(sourceColumnsOf)),
    deferredColumnIds: outgoing
      .filter((relation) => state.deferredIds.has(relation.id))
      .flatMap(sourceColumnsOf),
    keyColumnIds: new Set([...uniqueKeys.flat(), ...pairColumnIds]),
    primaryKeyColumnIds: new Set(table.primaryKeyColumnIds),
    uniqueKeys,
    counters: new Map(),
    completeTargets: new Map(
      builtRelations.map((relation) => [
        relation.id,
        listCompleteTargets(state, relation),
      ]),
    ),
  };
}

function nextSequence(plan: TablePlan, columnId: ColumnId): number {
  const sequence = plan.counters.get(columnId) ?? 1;
  plan.counters.set(columnId, sequence + 1);
  return sequence;
}

// Step 4: generated columns first, then source columns from relations.
function generateRow(
  state: RelationState,
  plan: TablePlan,
  previousRows: readonly BuiltRow[],
  choices: Choice[],
): BuiltRow | null {
  const row: BuiltRow = { values: new Map(), assigned: new Set() };
  for (const columnId of plan.table.columnIds) {
    const column = state.schema.columns[columnId];
    if (column === undefined || plan.sourceColumnIds.has(columnId)) {
      continue;
    }
    const generated = generateColumnValue({
      column,
      enums: state.schema.enums,
      random: plan.random,
      sequence: nextSequence(plan, columnId),
      isKeyColumn: plan.keyColumnIds.has(columnId),
      isPrimaryKeyColumn: plan.primaryKeyColumnIds.has(columnId),
    });
    if (generated.kind === "value") {
      row.values.set(columnId, generated.value);
    }
  }
  const isAssigned = plan.relations.every((relation) =>
    assignRelation(
      state,
      plan,
      relation,
      row,
      previousRows,
      choices,
      plan.completeTargets.get(relation.id) ?? [],
    ),
  );
  plan.deferredColumnIds
    .filter((columnId) => !row.assigned.has(columnId))
    .forEach((columnId) => row.values.set(columnId, null));
  return isAssigned ? row : null;
}

// Step 5: returns null when every attempt fails a relation or a unique key.
function generateAcceptedRow(
  state: RelationState,
  plan: TablePlan,
  rows: readonly BuiltRow[],
  usedKeys: readonly Set<string>[],
): BuiltRow | null {
  for (let attempt = 0; attempt < SEED_MAX_ROW_ATTEMPTS; attempt += 1) {
    const choices: Choice[] = [];
    const row = generateRow(state, plan, rows, choices);
    const keys = plan.uniqueKeys.map((columnIds) =>
      row === null
        ? null
        : toSeedValuesKey(
            columnIds.map((columnId) => row.values.get(columnId)),
          ),
    );
    const isUnique = keys.every(
      (key, index) => key === null || usedKeys[index]?.has(key) !== true,
    );
    if (row !== null && isUnique) {
      keys.forEach((key, index) => {
        if (key !== null) {
          usedKeys[index]?.add(key);
        }
      });
      commitChoices(state, choices);
      return row;
    }
  }
  return null;
}

// Returns true when the table stopped short of `rowsPerTable` rows.
function buildTableRows(
  state: RelationState,
  plan: TablePlan,
  rowsPerTable: number,
): boolean {
  const rows: BuiltRow[] = [];
  state.rowsByTable.set(plan.table.id, rows);
  if (plan.table.columnIds.length === 0) {
    return false;
  }
  const usedKeys = plan.uniqueKeys.map(() => new Set<string>());
  while (rows.length < rowsPerTable) {
    const row = generateAcceptedRow(state, plan, rows, usedKeys);
    if (row === null) {
      return true;
    }
    rows.push(row);
  }
  return false;
}

/** Deterministic seed rows for every table that can have them (spec CG-08). */
export function buildSeedDataset(
  schema: SchemaDocument,
  options: SeedDatasetOptions,
): {
  readonly dataset: SeedDataset;
  readonly diagnostics: readonly GeneratorDiagnostic[];
} {
  assertSeedDatasetOptions(options);
  const loadOrder = buildLoadOrder(schema);
  const skippedIds = propagateSkippedTables(schema, [
    ...findUnseedableTableIds(schema),
    ...loadOrder.skippedTableIds,
  ]);
  const skipped = new Set(skippedIds);
  const state: RelationState = {
    schema,
    rowsByTable: new Map(),
    chosen: new Map(),
    deferredIds: new Set(loadOrder.deferredRelationIds),
  };
  const diagnostics = skippedIds.map((tableId) =>
    createDiagnostic("seed-table-skipped", ["tables", tableId]),
  );
  const plans = new Map<TableId, TablePlan>();
  const relations = sortRelations(schema);
  const indexes = sortIndexes(schema);
  const tables = loadOrder.tableIds
    .filter((tableId) => !skipped.has(tableId))
    .flatMap((tableId) => schema.tables[tableId] ?? []);
  for (const table of tables) {
    const plan = planTable(state, table, options.seed, relations, indexes);
    plans.set(table.id, plan);
    if (buildTableRows(state, plan, options.rowsPerTable)) {
      diagnostics.push(
        createDiagnostic("seed-rows-reduced", ["tables", table.id]),
      );
    }
  }
  fillDeferredRelations(state, plans);
  const dataset: SeedDataset = {
    tables: tables.map((table) => ({
      tableId: table.id,
      rows: (state.rowsByTable.get(table.id) ?? []).map(toSeedRow),
    })),
  };
  return { dataset, diagnostics: finalizeDiagnostics(diagnostics) };
}
