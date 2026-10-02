import type { ColumnId, RelationId, TableId } from "../../model/ids.js";
import { sortRelations } from "../../model/ordering.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import type { JsonValue } from "../shared/json-representation.js";
import type { SeedRow } from "./seed-dataset.js";
import type { SeedRandom } from "./seed-random.js";
import { listSeedUniqueKeys, toSeedKey } from "./validate-seed-dataset.js";

// Internal to buildSeedDataset (plan Task 21, steps 4 and 6); tested through it.

export type BuiltRow = {
  readonly values: Map<ColumnId, JsonValue>;
  // Source columns already set by a relation (to a parent's value or null).
  readonly assigned: Set<ColumnId>;
};

export type Choice = {
  readonly relationId: RelationId;
  readonly rowIndex: number;
};

// Mutable state of one buildSeedDataset call; nothing lives at module level.
export type RelationState = {
  readonly schema: SchemaDocument;
  readonly rowsByTable: Map<TableId, BuiltRow[]>;
  // Target rows already picked by each one-to-one relation.
  readonly chosen: Map<RelationId, Set<number>>;
  readonly deferredIds: ReadonlySet<RelationId>;
};

export type RelationSource = {
  readonly table: Table;
  readonly random: SeedRandom;
};

type TargetFilter = (row: BuiltRow, target: BuiltRow) => boolean;

const ACCEPT_ANY_TARGET: TargetFilter = () => true;

export function toSeedRow(row: BuiltRow): SeedRow {
  return Object.fromEntries(row.values);
}

function isSameValue(
  left: JsonValue | undefined,
  right: JsonValue | undefined,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

// A target row qualifies when it has every referenced value and agrees with
// the source columns an earlier relation already set in this row.
function isCandidate(
  relation: Relation,
  row: BuiltRow,
  target: BuiltRow,
): boolean {
  return relation.columnPairs.every((pair) => {
    const targetValue = target.values.get(pair.toColumnId);
    return (
      targetValue !== undefined &&
      targetValue !== null &&
      (!row.assigned.has(pair.fromColumnId) ||
        isSameValue(targetValue, row.values.get(pair.fromColumnId)))
    );
  });
}

function copyFrom(relation: Relation, row: BuiltRow, target: BuiltRow): void {
  relation.columnPairs.forEach((pair) => {
    if (!row.assigned.has(pair.fromColumnId)) {
      row.values.set(
        pair.fromColumnId,
        target.values.get(pair.toColumnId) ?? null,
      );
      row.assigned.add(pair.fromColumnId);
    }
  });
}

function canAssignNull(
  state: RelationState,
  relation: Relation,
  row: BuiltRow,
): boolean {
  return relation.columnPairs.every(
    (pair) =>
      !row.assigned.has(pair.fromColumnId) &&
      state.schema.columns[pair.fromColumnId]?.isNullable === true,
  );
}

function listTargetRows(
  state: RelationState,
  relation: Relation,
  previousRows: readonly BuiltRow[],
): readonly BuiltRow[] {
  return relation.fromTableId === relation.toTableId
    ? previousRows
    : (state.rowsByTable.get(relation.toTableId) ?? []);
}

function listCandidates(
  state: RelationState,
  relation: Relation,
  row: BuiltRow,
  previousRows: readonly BuiltRow[],
  isAllowed: TargetFilter,
): readonly number[] {
  const targetRows = listTargetRows(state, relation, previousRows);
  // A self-reference may only point to the row just before this one.
  const indexes =
    relation.fromTableId === relation.toTableId
      ? [previousRows.length - 1].filter((index) => index >= 0)
      : targetRows.map((_target, index) => index);
  const taken =
    relation.kind === "oneToOne" ? state.chosen.get(relation.id) : undefined;
  return indexes.filter((index) => {
    const target = targetRows[index];
    return (
      target !== undefined &&
      taken?.has(index) !== true &&
      isCandidate(relation, row, target) &&
      isAllowed(row, target)
    );
  });
}

/** Sets the relation's source columns in `row`; false when the row cannot satisfy it. */
export function assignRelation(
  state: RelationState,
  source: RelationSource,
  relation: Relation,
  row: BuiltRow,
  previousRows: readonly BuiltRow[],
  choices: Choice[],
  isAllowed: TargetFilter = ACCEPT_ANY_TARGET,
): boolean {
  const isSelfReference = relation.fromTableId === relation.toTableId;
  const candidates = listCandidates(
    state,
    relation,
    row,
    previousRows,
    isAllowed,
  );
  const pick =
    isSelfReference || candidates.length === 0
      ? candidates[0]
      : candidates[source.random.nextInt(candidates.length)];
  const target =
    pick === undefined
      ? undefined
      : listTargetRows(state, relation, previousRows)[pick];
  if (pick !== undefined && target !== undefined) {
    copyFrom(relation, row, target);
    choices.push({ relationId: relation.id, rowIndex: pick });
    return true;
  }
  if (canAssignNull(state, relation, row)) {
    relation.columnPairs.forEach((pair) => {
      row.values.set(pair.fromColumnId, null);
      row.assigned.add(pair.fromColumnId);
    });
    return true;
  }
  if (isSelfReference && isCandidate(relation, row, row)) {
    copyFrom(relation, row, row);
    return true;
  }
  return false;
}

export function commitChoices(
  state: RelationState,
  choices: readonly Choice[],
): void {
  choices.forEach((choice) => {
    const taken = state.chosen.get(choice.relationId) ?? new Set<number>();
    taken.add(choice.rowIndex);
    state.chosen.set(choice.relationId, taken);
  });
}

type UniqueGuard = {
  readonly isAllowed: TargetFilter;
  readonly record: (row: BuiltRow) => void;
};

// Step 6 sets values after the unique check of step 5, so it keeps every
// unique key that holds one of the relation's source columns distinct itself.
function createUniqueGuard(
  schema: SchemaDocument,
  table: Table,
  relation: Relation,
  rows: readonly BuiltRow[],
): UniqueGuard {
  const sourceIds = new Set(
    relation.columnPairs.map((pair) => pair.fromColumnId),
  );
  const keys = listSeedUniqueKeys(schema, table).filter((columnIds) =>
    columnIds.some((columnId) => sourceIds.has(columnId)),
  );
  const keysOf = (row: BuiltRow): readonly (string | null)[] =>
    keys.map((columnIds) => toSeedKey(toSeedRow(row), columnIds));
  const used = keys.map(() => new Set<string>());
  const record = (row: BuiltRow): void => {
    keysOf(row).forEach((key, index) => {
      if (key !== null) {
        used[index]?.add(key);
      }
    });
  };
  rows.forEach(record);
  const isAllowed: TargetFilter = (row, target) => {
    const before = keysOf(row);
    const trial: BuiltRow = {
      values: new Map(row.values),
      assigned: new Set(row.assigned),
    };
    copyFrom(relation, trial, target);
    return keysOf(trial).every(
      (key, index) =>
        key === null || key === before[index] || used[index]?.has(key) !== true,
    );
  };
  return { isAllowed, record };
}

/**
 * Step 6: relations that break a cycle are set after every table has rows.
 * No row is regenerated, since other tables may already reference it; a row
 * with no allowed parent keeps NULL in the (nullable) source columns.
 */
export function fillDeferredRelations(
  state: RelationState,
  sources: ReadonlyMap<TableId, RelationSource>,
): void {
  for (const relation of sortRelations(state.schema)) {
    const source = sources.get(relation.fromTableId);
    if (
      !state.deferredIds.has(relation.id) ||
      source === undefined ||
      source.table.primaryKeyColumnIds.length === 0
    ) {
      continue;
    }
    const rows = state.rowsByTable.get(source.table.id) ?? [];
    const guard = createUniqueGuard(state.schema, source.table, relation, rows);
    rows.forEach((row) => {
      const choices: Choice[] = [];
      assignRelation(
        state,
        source,
        relation,
        row,
        [],
        choices,
        guard.isAllowed,
      );
      commitChoices(state, choices);
      guard.record(row);
    });
  }
}
