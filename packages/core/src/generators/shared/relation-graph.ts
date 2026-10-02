import type {
  ColumnId,
  IndexId,
  RelationId,
  TableId,
} from "../../model/ids.js";
import {
  sortIndexes,
  sortRelations,
  sortTables,
} from "../../model/ordering.js";
import type { ColumnPair, Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";

export type ReferencedKey =
  | { readonly kind: "primaryKey"; readonly columnIds: readonly ColumnId[] }
  | { readonly kind: "uniqueColumn"; readonly columnIds: readonly ColumnId[] }
  | {
      readonly kind: "uniqueIndex";
      readonly indexId: IndexId;
      readonly columnIds: readonly ColumnId[];
    };

export type LoadOrder = {
  // Tables in load order: referenced tables before referencing tables.
  readonly tableIds: readonly TableId[];
  // Inserted with NULL foreign keys first, then set by an UPDATE.
  readonly deferredRelationIds: readonly RelationId[];
  readonly skippedTableIds: readonly TableId[];
};

// Edges point from the referenced table to the referencing table.
type Edges = ReadonlyMap<TableId, readonly TableId[]>;

type TableIdLookup = { readonly has: (tableId: TableId) => boolean };

// SQL Server writes `restrict` as NO ACTION, so neither forms a cascade path (Vấn đề 4).
const NON_CASCADING_ACTIONS: ReadonlySet<string> = new Set([
  "noAction",
  "restrict",
]);

function isSameColumnSet(
  first: readonly ColumnId[],
  second: readonly ColumnId[],
): boolean {
  const firstSet = new Set(first);
  const secondSet = new Set(second);
  return (
    first.length === second.length &&
    firstSet.size === secondSet.size &&
    second.every((columnId) => firstSet.has(columnId))
  );
}

export function findReferencedKey(
  schema: SchemaDocument,
  relation: Relation,
): ReferencedKey | null {
  const targetIds = relation.columnPairs.map((pair) => pair.toColumnId);
  const primaryKeyIds =
    schema.tables[relation.toTableId]?.primaryKeyColumnIds ?? [];
  if (isSameColumnSet(primaryKeyIds, targetIds)) {
    return { kind: "primaryKey", columnIds: primaryKeyIds };
  }
  const [onlyTargetId] = targetIds;
  const onlyTarget =
    onlyTargetId === undefined ? undefined : schema.columns[onlyTargetId];
  if (
    targetIds.length === 1 &&
    onlyTarget?.tableId === relation.toTableId &&
    onlyTarget.isUnique
  ) {
    return { kind: "uniqueColumn", columnIds: [onlyTarget.id] };
  }
  const index = sortIndexes(schema).find(
    (candidate) =>
      candidate.tableId === relation.toTableId &&
      candidate.isUnique &&
      isSameColumnSet(candidate.columnIds, targetIds),
  );
  return index === undefined
    ? null
    : { kind: "uniqueIndex", indexId: index.id, columnIds: index.columnIds };
}

/** Column pairs in the order of the referenced key (MySQL requires it). */
export function orderColumnPairsByReferencedKey(
  schema: SchemaDocument,
  relation: Relation,
): readonly ColumnPair[] {
  const key = findReferencedKey(schema, relation);
  if (key === null) {
    return relation.columnPairs;
  }
  return relation.columnPairs.toSorted(
    (left, right) =>
      key.columnIds.indexOf(left.toColumnId) -
      key.columnIds.indexOf(right.toColumnId),
  );
}

function buildEdges(
  relations: readonly Relation[],
  isReversed = false,
): Map<TableId, TableId[]> {
  const edges = new Map<TableId, TableId[]>();
  for (const relation of relations) {
    addEdge(edges, relation, isReversed);
  }
  return edges;
}

function addEdge(
  edges: Map<TableId, TableId[]>,
  relation: Relation,
  isReversed = false,
): void {
  const [source, target] = isReversed
    ? [relation.fromTableId, relation.toTableId]
    : [relation.toTableId, relation.fromTableId];
  const targets = edges.get(source);
  if (targets === undefined) {
    edges.set(source, [target]);
  } else {
    targets.push(target);
  }
}

// Explicit stack instead of recursion: a long chain of tables must not
// overflow the call stack. `excluded` tables are neither entered nor returned.
function findReachableTables(
  startIds: Iterable<TableId>,
  edges: Edges,
  excluded: TableIdLookup = new Set(),
): Set<TableId> {
  const reached = new Set<TableId>();
  const stack = [...startIds].filter((tableId) => !excluded.has(tableId));
  for (
    let tableId = stack.pop();
    tableId !== undefined;
    tableId = stack.pop()
  ) {
    if (reached.has(tableId)) {
      continue;
    }
    reached.add(tableId);
    const next = edges.get(tableId) ?? [];
    stack.push(...next.filter((nextId) => !excluded.has(nextId)));
  }
  return reached;
}

function isCascading(relation: Relation): boolean {
  return (
    !NON_CASCADING_ACTIONS.has(relation.onDelete) ||
    !NON_CASCADING_ACTIONS.has(relation.onUpdate)
  );
}

// Adding toTableId -> fromTableId creates a cycle or a second path exactly
// when an ancestor of `to` (or `to` itself) already reaches a descendant of
// `from` (or `from` itself).
function closesCascadePath(
  relation: Relation,
  edges: Edges,
  reverseEdges: Edges,
): boolean {
  if (relation.fromTableId === relation.toTableId) {
    return true;
  }
  const ancestors = findReachableTables([relation.toTableId], reverseEdges);
  const reachedFromAncestors = findReachableTables(ancestors, edges);
  const descendants = findReachableTables([relation.fromTableId], edges);
  return [...descendants].some((tableId) => reachedFromAncestors.has(tableId));
}

/**
 * Relations SQL Server would reject with "may cause cycles or multiple
 * cascade paths", in `sortRelations` order. Each must be written with
 * NO ACTION for both events.
 */
export function findCascadeConflicts(
  schema: SchemaDocument,
): readonly RelationId[] {
  const edges = new Map<TableId, TableId[]>();
  const reverseEdges = new Map<TableId, TableId[]>();
  const conflicts: RelationId[] = [];
  for (const relation of sortRelations(schema).filter(isCascading)) {
    if (closesCascadePath(relation, edges, reverseEdges)) {
      conflicts.push(relation.id);
    } else {
      addEdge(edges, relation);
      addEdge(reverseEdges, relation, true);
    }
  }
  return conflicts;
}

// First pass of Kosaraju's algorithm: tables in depth-first finishing order.
function listByFinishingOrder(
  tableIds: readonly TableId[],
  edges: Edges,
): readonly TableId[] {
  const visited = new Set<TableId>();
  const finished: TableId[] = [];
  for (const startId of tableIds) {
    const stack = visited.has(startId) ? [] : [{ tableId: startId, next: 0 }];
    visited.add(startId);
    for (let top = stack.at(-1); top !== undefined; top = stack.at(-1)) {
      const childId = edges.get(top.tableId)?.[top.next];
      top.next += 1;
      if (childId === undefined) {
        stack.pop();
        finished.push(top.tableId);
      } else if (!visited.has(childId)) {
        visited.add(childId);
        stack.push({ tableId: childId, next: 0 });
      }
    }
  }
  return finished;
}

// Strongly connected components (Kosaraju, iterative), each as a table set.
function findComponents(
  tableIds: readonly TableId[],
  relations: readonly Relation[],
): ReadonlyMap<TableId, ReadonlySet<TableId>> {
  const finished = listByFinishingOrder(tableIds, buildEdges(relations));
  const reverseEdges = buildEdges(relations, true);
  const componentOf = new Map<TableId, ReadonlySet<TableId>>();
  for (const tableId of finished.toReversed()) {
    if (componentOf.has(tableId)) {
      continue;
    }
    const component = findReachableTables([tableId], reverseEdges, componentOf);
    component.forEach((memberId) => componentOf.set(memberId, component));
  }
  return componentOf;
}

function isDeferrable(schema: SchemaDocument, relation: Relation): boolean {
  return relation.columnPairs.every(
    (pair) => schema.columns[pair.fromColumnId]?.isNullable === true,
  );
}

/**
 * `skippedTableIds` plus every table that has a non-deferrable foreign key
 * (some column required) to a skipped table, repeated to a fixed point; in
 * `sortTables` order.
 */
export function propagateSkippedTables(
  schema: SchemaDocument,
  skippedTableIds: readonly TableId[],
): readonly TableId[] {
  const requiredRelations = sortRelations(schema).filter(
    (relation) => !isDeferrable(schema, relation),
  );
  const skipped = findReachableTables(
    skippedTableIds,
    buildEdges(requiredRelations),
  );
  return sortTables(schema)
    .map((table) => table.id)
    .filter((tableId) => skipped.has(tableId));
}

// Kahn's algorithm; each step takes the first ready table in `tableIds` order.
// ponytail: O(n^2) scan for the next ready table; use a heap if schemas grow to thousands of tables.
function sortTopologically(
  tableIds: readonly TableId[],
  relations: readonly Relation[],
): readonly TableId[] {
  const edges = buildEdges(relations);
  const inDegree = new Map(tableIds.map((tableId) => [tableId, 0]));
  relations.forEach((relation) =>
    inDegree.set(
      relation.fromTableId,
      (inDegree.get(relation.fromTableId) ?? 0) + 1,
    ),
  );
  const ordered = new Set<TableId>();
  const isReady = (tableId: TableId): boolean =>
    inDegree.get(tableId) === 0 && !ordered.has(tableId);
  for (
    let next = tableIds.find(isReady);
    next !== undefined;
    next = tableIds.find(isReady)
  ) {
    ordered.add(next);
    (edges.get(next) ?? []).forEach((childId) =>
      inDegree.set(childId, (inDegree.get(childId) ?? 0) - 1),
    );
  }
  return [...ordered];
}

function isInCycle(
  componentOf: ReadonlyMap<TableId, ReadonlySet<TableId>>,
  relation: Relation,
): boolean {
  return (
    componentOf.get(relation.fromTableId)?.has(relation.toTableId) === true
  );
}

/** Table load order for seed data (CG-08), breaking cycles where it can. */
export function buildLoadOrder(schema: SchemaDocument): LoadOrder {
  const allTableIds = sortTables(schema).map((table) => table.id);
  const relations = sortRelations(schema).filter(
    (relation) => relation.fromTableId !== relation.toTableId,
  );
  const firstComponents = findComponents(allTableIds, relations);
  const deferred = relations.filter(
    (relation) =>
      isDeferrable(schema, relation) && isInCycle(firstComponents, relation),
  );
  const deferredSet = new Set(deferred);
  const kept = relations.filter((relation) => !deferredSet.has(relation));
  const secondComponents = findComponents(allTableIds, kept);
  const cycleTableIds = allTableIds.filter(
    (tableId) => (secondComponents.get(tableId)?.size ?? 0) > 1,
  );
  const skippedTableIds = propagateSkippedTables(schema, cycleTableIds);
  const skipped = new Set(skippedTableIds);
  const touchesSkipped = (relation: Relation): boolean =>
    skipped.has(relation.fromTableId) || skipped.has(relation.toTableId);
  return {
    tableIds: sortTopologically(
      allTableIds.filter((tableId) => !skipped.has(tableId)),
      kept.filter((relation) => !touchesSkipped(relation)),
    ),
    deferredRelationIds: deferred
      .filter((relation) => !touchesSkipped(relation))
      .map((relation) => relation.id),
    skippedTableIds,
  };
}
