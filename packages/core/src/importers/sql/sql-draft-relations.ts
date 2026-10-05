import { toNameKey } from "../../model/name-limits.js";
import type { ReferentialAction } from "../../model/relation.js";
import type {
  CoreEndpoint,
  CoreRef,
} from "../shared/dbml-core-adapter-types.js";
import type {
  DraftDiagnostic,
  DraftIndex,
  DraftRelation,
  DraftTable,
} from "../shared/import-draft.js";
import { createNameResolver } from "../shared/resolve-references.js";
import type { SqlElementLocations } from "./sql-element-locations.js";

const REFERENTIAL_ACTIONS: ReadonlyMap<string, ReferentialAction> = new Map([
  ["CASCADE", "cascade"],
  ["RESTRICT", "restrict"],
  ["SET NULL", "setNull"],
  ["SET DEFAULT", "setDefault"],
  ["NO ACTION", "noAction"],
]);

function toAction(keyword: string | null): ReferentialAction {
  return REFERENTIAL_ACTIONS.get(keyword?.toUpperCase() ?? "") ?? "noAction";
}

function isSameSet(a: readonly string[], b: readonly string[]): boolean {
  const keys = new Set(a.map(toNameKey));
  return a.length === b.length && b.every((name) => keys.has(toNameKey(name)));
}

// Unique as spec part 2 defines it: the primary key, a unique column, or the
// columns of a unique index (spec section 5, "Quan hệ").
function isUniqueColumnSet(
  table: DraftTable | undefined,
  columnNames: readonly string[],
  uniqueIndexes: ReadonlyMap<string, readonly DraftIndex[]>,
): boolean {
  if (table === undefined) {
    return false;
  }
  const [single] = columnNames;
  return (
    isSameSet(table.primaryKeyColumnNames, columnNames) ||
    (columnNames.length === 1 &&
      table.columns.some(
        ({ name, isUnique }) =>
          isUnique &&
          single !== undefined &&
          toNameKey(name) === toNameKey(single),
      )) ||
    (uniqueIndexes.get(toNameKey(table.name)) ?? []).some((index) =>
      isSameSet(index.columnNames, columnNames),
    )
  );
}

function groupUniqueIndexes(
  indexes: readonly DraftIndex[],
): ReadonlyMap<string, readonly DraftIndex[]> {
  const groups = new Map<string, DraftIndex[]>();
  indexes
    .filter(({ isUnique }) => isUnique)
    .forEach((index) => {
      const key = toNameKey(index.tableName);
      const group = groups.get(key) ?? [];
      group.push(index);
      groups.set(key, group);
    });
  return groups;
}

// The foreign key side is the `*` end; the parser lists it first.
function orderEndpoints(
  first: CoreEndpoint,
  second: CoreEndpoint,
): readonly [CoreEndpoint, CoreEndpoint] {
  return second.relation === "*" && first.relation !== "*"
    ? [second, first]
    : [first, second];
}

/** Foreign keys of the parsed tables; references are resolved later. */
export function translateRefs(input: {
  readonly refs: readonly CoreRef[];
  readonly tables: readonly DraftTable[];
  readonly indexes: readonly DraftIndex[];
  readonly locations: SqlElementLocations;
}): {
  readonly relations: readonly DraftRelation[];
  readonly diagnostics: readonly DraftDiagnostic[];
} {
  const resolveTable = createNameResolver(input.tables.map(({ name }) => name));
  const uniqueIndexes = groupUniqueIndexes(input.indexes);
  const relations: DraftRelation[] = [];
  const diagnostics: DraftDiagnostic[] = [];
  input.refs.forEach((ref) => {
    const [first, second] = ref.endpoints;
    if (first === undefined || second === undefined) {
      diagnostics.push({
        code: "reference-not-found",
        location: null,
        target: null,
      });
      return;
    }
    const [from, to] = orderEndpoints(first, second);
    const fromTableIndex = resolveTable(from.tableName);
    const fromTable =
      fromTableIndex === null ? undefined : input.tables[fromTableIndex];
    relations.push({
      fromTableName: from.tableName,
      toTableName: to.tableName,
      // The parser rejects ends with different column counts.
      columnPairs: from.columnNames.map((fromColumnName, position) => ({
        fromColumnName,
        toColumnName: to.columnNames[position] ?? "",
      })),
      kind: isUniqueColumnSet(fromTable, from.columnNames, uniqueIndexes)
        ? "oneToOne"
        : "oneToMany",
      onDelete: toAction(ref.onDelete),
      onUpdate: toAction(ref.onUpdate),
      location: input.locations.table(from.tableName),
    });
  });
  return { relations, diagnostics };
}
