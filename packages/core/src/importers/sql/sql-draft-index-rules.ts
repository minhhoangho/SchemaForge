import { buildConstraintName } from "../../generators/shared/constraint-names.js";
import { toNameKey } from "../../model/name-limits.js";
import type {
  CoreIndex,
  CoreTable,
} from "../shared/dbml-core-adapter-types.js";
import type { SourceLocation } from "../shared/import-types.js";
import type { SqlUniqueConstraint } from "./sql-column-definitions.js";
import type { SqlDraftContext } from "./sql-draft-context.js";
import type { SqlIndexDefinition } from "./sql-index-definitions.js";

// How one parsed index enters the draft (spec section 5, "Unique", "Index").
export type IndexOutcome =
  | {
      readonly kind: "uniqueColumn";
      readonly hasDroppedOption: boolean;
    }
  | {
      readonly kind: "index";
      readonly name: string | null;
      readonly hasDroppedOption: boolean;
      readonly location: SourceLocation | null;
    }
  | { readonly kind: "dropped" };

export type IndexSource = {
  readonly index: CoreIndex;
  readonly table: CoreTable;
  readonly columnNames: readonly string[];
  readonly definition: SqlIndexDefinition | null;
  readonly context: SqlDraftContext;
};

function isSameList(
  a: readonly string[],
  b: readonly (string | null)[],
): boolean {
  return a.length === b.length && a.every((name, index) => name === b[index]);
}

function isSameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && isSubset(b, a);
}

function isSubset(names: readonly string[], of: readonly string[]): boolean {
  const keys = new Set(of.map(toNameKey));
  return names.every((name) => keys.has(toNameKey(name)));
}

// The CREATE INDEX of the same table, by name, or by its columns in order
// when the index has no name.
export function findDefinition(
  index: CoreIndex,
  table: CoreTable,
  columnNames: readonly string[],
  context: SqlDraftContext,
): SqlIndexDefinition | null {
  const definitions = context.indexDefinitions.get(toNameKey(table.name)) ?? [];
  return (
    definitions.find((definition) =>
      index.name === null
        ? definition.indexName === null &&
          isSameList(columnNames, definition.columnNames)
        : definition.indexName !== null &&
          toNameKey(definition.indexName) === toNameKey(index.name),
    ) ?? null
  );
}

function findUniqueConstraint(source: IndexSource): {
  readonly constraint: SqlUniqueConstraint;
  readonly start: number | null;
} | null {
  const { table, columnNames, context } = source;
  const created = context.locations.tableDefinition(table.name);
  const inTable = created?.uniqueConstraints.find((constraint) =>
    isSameSet(constraint.columnNames, columnNames),
  );
  if (inTable !== undefined) {
    return { constraint: inTable, start: null };
  }
  const added = context.addedUniqueConstraints
    .get(toNameKey(table.name))
    ?.find(({ constraint }) => isSameSet(constraint.columnNames, columnNames));
  return added === undefined
    ? null
    : { constraint: added.constraint, start: added.start };
}

function isGeneratedUniqueName(
  source: IndexSource,
  name: string | null,
): boolean {
  const [columnName] = source.columnNames;
  return (
    source.columnNames.length === 1 &&
    columnName !== undefined &&
    name === buildConstraintName(source.table.name, [columnName], "key")
  );
}

// How CG-01 writes a unique column or index on nullable columns for SQL Server:
// a unique index filtered on `<column> IS NOT NULL` of its own columns.
function classifyFilteredUnique(source: IndexSource): IndexOutcome | null {
  const { definition, columnNames } = source;
  const filtered = definition?.whereNotNullColumnNames ?? null;
  if (
    source.context.dialect !== "sqlserver" ||
    definition === null ||
    filtered === null ||
    !isSubset(filtered, columnNames)
  ) {
    return null;
  }
  const hasDroppedOption =
    definition.hasDroppedElementOption || definition.hasInclude;
  return isGeneratedUniqueName(source, source.index.name)
    ? { kind: "uniqueColumn", hasDroppedOption }
    : {
        kind: "index",
        name: source.index.name,
        hasDroppedOption,
        location: source.context.locations.at(definition.start),
      };
}

function classifyConstraint(source: IndexSource): IndexOutcome {
  const { table, columnNames, context } = source;
  const tableLocation = context.locations.table(table.name);
  const found = findUniqueConstraint(source);
  if (found === null) {
    return columnNames.length === 1
      ? { kind: "uniqueColumn", hasDroppedOption: false }
      : {
          kind: "index",
          name: source.index.name,
          hasDroppedOption: false,
          location: tableLocation,
        };
  }
  const { constraint, start } = found;
  const isUniqueColumn = constraint.isMysqlKey
    ? constraint.name === null || isGeneratedUniqueName(source, constraint.name)
    : columnNames.length === 1;
  const hasDroppedOption = constraint.hasDroppedElementOption;
  return isUniqueColumn && columnNames.length === 1
    ? { kind: "uniqueColumn", hasDroppedOption }
    : {
        kind: "index",
        name: constraint.name,
        hasDroppedOption,
        location: start === null ? tableLocation : context.locations.at(start),
      };
}

// MySQL needs an index on an AUTO_INCREMENT column that does not lead a key;
// CG-01 adds `KEY <table>_<column>_idx` for it and writes it again.
function isAutoIncrementIndex(source: IndexSource): boolean {
  const { table, columnNames, index } = source;
  const [columnName] = columnNames;
  return (
    source.context.dialect === "mysql" &&
    columnName !== undefined &&
    columnNames.length === 1 &&
    table.fields.some(
      ({ name, isIncrement }) => isIncrement && name === columnName,
    ) &&
    index.name === buildConstraintName(table.name, [columnName], "idx")
  );
}

export function classifyIndex(source: IndexSource): IndexOutcome {
  const { definition, index, context, table } = source;
  if (index.isUnique) {
    const filtered = classifyFilteredUnique(source);
    if (filtered !== null) {
      return filtered;
    }
  }
  if (definition !== null) {
    return {
      kind: "index",
      name: index.name,
      hasDroppedOption:
        definition.hasDroppedElementOption ||
        definition.hasInclude ||
        definition.hasWhere,
      location: context.locations.at(definition.start),
    };
  }
  if (index.isUnique) {
    return classifyConstraint(source);
  }
  return isAutoIncrementIndex(source)
    ? { kind: "dropped" }
    : {
        kind: "index",
        name: index.name,
        hasDroppedOption: false,
        location: context.locations.table(table.name),
      };
}
