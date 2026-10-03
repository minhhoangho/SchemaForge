import type { ColumnId, RelationId, TableId } from "../../model/ids.js";
import { sortRelations } from "../../model/ordering.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import type { JsonValue } from "../shared/json-representation.js";
import type { SeedRow } from "./seed-dataset.js";
import type { SeedRandom } from "./seed-random.js";
import { toSeedValuesKey } from "./validate-seed-dataset.js";

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
  // listSeedUniqueKeys of `table`.
  readonly uniqueKeys: readonly (readonly ColumnId[])[];
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

/**
 * Indexes of the target rows that hold every value `relation` references.
 * Only valid while those rows stay unchanged: they belong to another table,
 * so compute it after that table is built (or, for a deferred relation,
 * right before filling it).
 */
export function listCompleteTargets(
  state: RelationState,
  relation: Relation,
): readonly number[] {
  const targetRows = state.rowsByTable.get(relation.toTableId) ?? [];
  return targetRows.flatMap((target, index) =>
    relation.columnPairs.every((pair) => {
      const targetValue = target.values.get(pair.toColumnId);
      return targetValue !== undefined && targetValue !== null;
    })
      ? [index]
      : [],
  );
}

// Scanning every target row for every generated row made seeding quadratic
// in rows, so a row that nothing restricts takes `completeTargets` as is.
function listCandidates(
  state: RelationState,
  relation: Relation,
  row: BuiltRow,
  previousRows: readonly BuiltRow[],
  completeTargets: readonly number[],
  isAllowed: TargetFilter,
): readonly number[] {
  const isSelfReference = relation.fromTableId === relation.toTableId;
  const taken =
    relation.kind === "oneToOne" ? state.chosen.get(relation.id) : undefined;
  const isUnrestricted =
    !isSelfReference &&
    taken === undefined &&
    isAllowed === ACCEPT_ANY_TARGET &&
    relation.columnPairs.every((pair) => !row.assigned.has(pair.fromColumnId));
  if (isUnrestricted) {
    return completeTargets;
  }
  const targetRows = listTargetRows(state, relation, previousRows);
  // A self-reference may only point to the row just before this one.
  const indexes = isSelfReference
    ? [previousRows.length - 1].filter((index) => index >= 0)
    : completeTargets;
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
  // From listCompleteTargets; ignored for a self-reference.
  completeTargets: readonly number[],
  isAllowed: TargetFilter = ACCEPT_ANY_TARGET,
): boolean {
  const isSelfReference = relation.fromTableId === relation.toTableId;
  const candidates = listCandidates(
    state,
    relation,
    row,
    previousRows,
    completeTargets,
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

function rowKeyOf(
  row: BuiltRow,
  columnIds: readonly ColumnId[],
): string | null {
  return toSeedValuesKey(columnIds.map((columnId) => row.values.get(columnId)));
}

// Allows a target when each key `row` would have after copyFrom(relation,
// row, target) is incomplete, unchanged or unused. The keys are read in
// place: copying the row for every candidate made seeding quadratic in rows.
function createTrialKeyFilter(
  relation: Relation,
  keys: readonly (readonly ColumnId[])[],
  used: readonly ReadonlySet<string>[],
): TargetFilter {
  const targetColumnIds = new Map(
    relation.columnPairs.map((pair) => [pair.fromColumnId, pair.toColumnId]),
  );
  // Runs only on candidates, whose referenced values are all set.
  return (row, target) => {
    const readTrial = (columnId: ColumnId): JsonValue | undefined => {
      const toColumnId = targetColumnIds.get(columnId);
      return toColumnId === undefined || row.assigned.has(columnId)
        ? row.values.get(columnId)
        : target.values.get(toColumnId);
    };
    return keys.every((columnIds, index) => {
      const key = toSeedValuesKey(columnIds.map(readTrial));
      return (
        key === null ||
        key === rowKeyOf(row, columnIds) ||
        used[index]?.has(key) !== true
      );
    });
  };
}

// Step 6 sets values after the unique check of step 5, so it keeps every
// unique key that holds one of the relation's source columns distinct itself.
function createUniqueGuard(
  source: RelationSource,
  relation: Relation,
  rows: readonly BuiltRow[],
): UniqueGuard {
  const sourceIds = new Set(
    relation.columnPairs.map((pair) => pair.fromColumnId),
  );
  const keys = source.uniqueKeys.filter((columnIds) =>
    columnIds.some((columnId) => sourceIds.has(columnId)),
  );
  const used = keys.map(() => new Set<string>());
  const record = (row: BuiltRow): void => {
    keys.forEach((columnIds, index) => {
      const key = rowKeyOf(row, columnIds);
      if (key !== null) {
        used[index]?.add(key);
      }
    });
  };
  rows.forEach(record);
  const isAllowed =
    keys.length === 0
      ? ACCEPT_ANY_TARGET
      : createTrialKeyFilter(relation, keys, used);
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
    const guard = createUniqueGuard(source, relation, rows);
    const completeTargets = listCompleteTargets(state, relation);
    rows.forEach((row) => {
      const choices: Choice[] = [];
      assignRelation(
        state,
        source,
        relation,
        row,
        [],
        choices,
        completeTargets,
        guard.isAllowed,
      );
      commitChoices(state, choices);
      guard.record(row);
    });
  }
}
