import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { toNameKey } from "../../model/name-limits.js";
import type { ReferentialAction } from "../../model/relation.js";
import type {
  CoreEndpoint,
  CoreRef,
} from "../shared/dbml-core-adapter-types.js";
import type { ForeignKeyColumns } from "../shared/implicit-foreign-key-index.js";
import type {
  DraftDiagnostic,
  DraftIndex,
  DraftRelation,
  DraftTable,
} from "../shared/import-draft.js";
import { createNameResolver } from "../shared/resolve-references.js";
import {
  createColumnSetLookup,
  type ColumnSetLookup,
} from "./sql-column-set-lookup.js";
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

// Unique as spec part 2 defines it: the primary key, a unique column, or the
// columns of a unique index (spec section 5, "Quan hệ"). Built once per table,
// so a foreign key is checked without a scan of the table (spec section 1).
type TableUniqueKeys = {
  readonly keyOf: ColumnSetLookup<readonly string[]>;
  readonly uniqueColumnKeys: ReadonlySet<string>;
};

function createTableUniqueKeys(
  table: DraftTable,
  uniqueIndexes: ReadonlyMap<string, readonly DraftIndex[]>,
): TableUniqueKeys {
  const indexKeys = (uniqueIndexes.get(toNameKey(table.name)) ?? []).map(
    ({ columnNames }) => columnNames,
  );
  return {
    keyOf: createColumnSetLookup(
      [table.primaryKeyColumnNames, ...indexKeys],
      (columnNames) => columnNames,
    ),
    uniqueColumnKeys: new Set(
      table.columns
        .filter(({ isUnique }) => isUnique)
        .map(({ name }) => toNameKey(name)),
    ),
  };
}

function isUniqueColumnSet(
  keys: TableUniqueKeys | null,
  columnNames: readonly string[],
): boolean {
  if (keys === null) {
    return false;
  }
  const [single] = columnNames;
  return (
    keys.keyOf(columnNames) !== null ||
    (columnNames.length === 1 &&
      single !== undefined &&
      keys.uniqueColumnKeys.has(toNameKey(single)))
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

// MySQL creates an index for a foreign key no key serves, named after the
// constraint (spec section 5); the other dialects create none.
export function readForeignKeys(
  refs: readonly CoreRef[],
  dialect: SqlDialect,
): readonly (ForeignKeyColumns & { readonly tableName: string })[] {
  if (dialect !== "mysql") {
    return [];
  }
  return refs.flatMap(({ name, endpoints: [first, second] }) => {
    if (name === null || first === undefined || second === undefined) {
      return [];
    }
    const [from] = orderEndpoints(first, second);
    return [{ name, tableName: from.tableName, columnNames: from.columnNames }];
  });
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
  const uniqueKeys = new Map<DraftTable, TableUniqueKeys>();
  const uniqueKeysOf = (table: DraftTable): TableUniqueKeys => {
    const keys =
      uniqueKeys.get(table) ?? createTableUniqueKeys(table, uniqueIndexes);
    uniqueKeys.set(table, keys);
    return keys;
  };
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
      kind: isUniqueColumnSet(
        fromTable === undefined ? null : uniqueKeysOf(fromTable),
        from.columnNames,
      )
        ? "oneToOne"
        : "oneToMany",
      onDelete: toAction(ref.onDelete),
      onUpdate: toAction(ref.onUpdate),
      location: input.locations.foreignKey(from.tableName, from.columnNames),
    });
  });
  return { relations, diagnostics };
}
