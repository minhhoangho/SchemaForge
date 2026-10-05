import { toNameKey } from "../../model/name-limits.js";
import type {
  DraftColumn,
  DraftColumnType,
  DraftIndex,
  DraftRelation,
  DraftTable,
  ImportDraft,
} from "./import-draft.js";
import { createImportDiagnostic } from "./import-diagnostics.js";
import type { ImportDiagnostic, SourceLocation } from "./import-types.js";

/** Returns the position of the matching name, or null. */
export type NameResolver = (wanted: string) => number | null;

/**
 * Exact match first (the first one when a name repeats), then the single
 * case-insensitive match; two case-insensitive matches resolve to nothing.
 * Maps keep names such as __proto__ away from any prototype.
 */
export function createNameResolver(names: readonly string[]): NameResolver {
  const exactPositions = new Map<string, number>();
  // null marks a key shared by several names.
  const keyPositions = new Map<string, number | null>();
  names.forEach((name, position) => {
    if (!exactPositions.has(name)) {
      exactPositions.set(name, position);
    }
    const key = toNameKey(name);
    keyPositions.set(key, keyPositions.has(key) ? null : position);
  });
  return (wanted) =>
    exactPositions.get(wanted) ?? keyPositions.get(toNameKey(wanted)) ?? null;
}

/**
 * An out-of-range position is a bug in the importer, not in its input;
 * assembleDocument turns the RangeError into parse-failed.
 */
export function elementAt<Element>(
  elements: readonly Element[],
  position: number,
): Element {
  const element = elements[position];
  if (element === undefined) {
    throw new RangeError(`No draft element at position ${String(position)}`);
  }
  return element;
}

export type ResolvedColumnType =
  | Exclude<DraftColumnType, { readonly kind: "enum" }>
  | { readonly kind: "enum"; readonly enumIndex: number };

export type ResolvedColumn = {
  readonly draftIndex: number;
  readonly column: DraftColumn;
  readonly type: ResolvedColumnType;
};

// Column positions below point into the table's kept columns.
export type ResolvedTable = {
  readonly table: DraftTable;
  readonly columns: readonly ResolvedColumn[];
  readonly primaryKey: readonly number[];
  readonly subjectAreaIndex: number | null;
  readonly resolveColumn: NameResolver;
};

export type ResolvedIndex = {
  readonly draftIndex: number;
  readonly index: DraftIndex;
  readonly tableIndex: number;
  readonly columns: readonly number[];
};

export type ResolvedRelation = {
  readonly draftIndex: number;
  readonly relation: DraftRelation;
  readonly fromTableIndex: number;
  readonly toTableIndex: number;
  readonly columnPairs: readonly {
    readonly from: number;
    readonly to: number;
  }[];
};

/** Kept elements only; every dropped element left a reference-not-found. */
export type ResolvedDraft = {
  readonly tables: readonly ResolvedTable[];
  readonly indexes: readonly ResolvedIndex[];
  readonly relations: readonly ResolvedRelation[];
  readonly diagnostics: readonly ImportDiagnostic[];
};

type Resolvers = {
  readonly resolveTable: NameResolver;
  readonly resolveEnum: NameResolver;
  readonly resolveSubjectArea: NameResolver;
  readonly report: (location: SourceLocation | null) => void;
};

/**
 * Null when any name is unresolved. A column listed twice (such as "id" and
 * "ID" resolving to one column) keeps its first position: repeating a column
 * adds no meaning, and the document must not list it twice.
 */
function resolveAll(
  resolve: NameResolver,
  names: readonly string[],
): readonly number[] | null {
  const positions = new Set<number>();
  for (const name of names) {
    const position = resolve(name);
    if (position === null) {
      return null;
    }
    positions.add(position);
  }
  return [...positions];
}

function resolveColumns(
  table: DraftTable,
  resolvers: Resolvers,
): readonly ResolvedColumn[] {
  return table.columns.flatMap((column, draftIndex): ResolvedColumn[] => {
    if (column.type.kind !== "enum") {
      return [{ draftIndex, column, type: column.type }];
    }
    const enumIndex = resolvers.resolveEnum(column.type.enumName);
    if (enumIndex === null) {
      resolvers.report(column.location);
      return [];
    }
    return [{ draftIndex, column, type: { kind: "enum", enumIndex } }];
  });
}

function resolveSubjectArea(
  table: DraftTable,
  resolvers: Resolvers,
): number | null {
  if (table.subjectAreaName === null) {
    return null;
  }
  const subjectAreaIndex = resolvers.resolveSubjectArea(table.subjectAreaName);
  if (subjectAreaIndex === null) {
    resolvers.report(table.location);
  }
  return subjectAreaIndex;
}

function resolveTable(table: DraftTable, resolvers: Resolvers): ResolvedTable {
  const columns = resolveColumns(table, resolvers);
  const resolveColumn = createNameResolver(
    columns.map(({ column }) => column.name),
  );
  const primaryKey = resolveAll(resolveColumn, table.primaryKeyColumnNames);
  if (primaryKey === null) {
    resolvers.report(table.location);
  }
  return {
    table,
    columns,
    primaryKey: primaryKey ?? [],
    subjectAreaIndex: resolveSubjectArea(table, resolvers),
    resolveColumn,
  };
}

function resolveIndex(
  index: DraftIndex,
  draftIndex: number,
  tables: readonly ResolvedTable[],
  resolvers: Resolvers,
): readonly ResolvedIndex[] {
  // A draft without columns is the format importer's to report with its own
  // code (such as index-expression-not-supported); the model needs one.
  if (index.columnNames.length === 0) {
    return [];
  }
  const tableIndex = resolvers.resolveTable(index.tableName);
  const columns =
    tableIndex === null
      ? null
      : resolveAll(
          elementAt(tables, tableIndex).resolveColumn,
          index.columnNames,
        );
  if (tableIndex === null || columns === null) {
    resolvers.report(index.location);
    return [];
  }
  return [{ draftIndex, index, tableIndex, columns }];
}

type ResolvedPairs = ResolvedRelation["columnPairs"];

function hasRepeatedColumn(pairs: ResolvedPairs): boolean {
  return (
    new Set(pairs.map(({ from }) => from)).size < pairs.length ||
    new Set(pairs.map(({ to }) => to)).size < pairs.length
  );
}

/**
 * Null when a name is unresolved, or when a column still appears in two
 * pairs once exact repeats of a pair are removed.
 */
function resolveColumnPairs(
  relation: DraftRelation,
  fromTable: ResolvedTable,
  toTable: ResolvedTable,
): ResolvedPairs | null {
  const pairs = new Map<string, ResolvedPairs[number]>();
  for (const { fromColumnName, toColumnName } of relation.columnPairs) {
    const from = fromTable.resolveColumn(fromColumnName);
    const to = toTable.resolveColumn(toColumnName);
    if (from === null || to === null) {
      return null;
    }
    pairs.set(JSON.stringify([from, to]), { from, to });
  }
  const uniquePairs = [...pairs.values()];
  return hasRepeatedColumn(uniquePairs) ? null : uniquePairs;
}

function resolveRelation(
  relation: DraftRelation,
  draftIndex: number,
  tables: readonly ResolvedTable[],
  resolvers: Resolvers,
): readonly ResolvedRelation[] {
  // A draft without pairs is the format importer's to report with its own code.
  if (relation.columnPairs.length === 0) {
    return [];
  }
  const fromTableIndex = resolvers.resolveTable(relation.fromTableName);
  const toTableIndex = resolvers.resolveTable(relation.toTableName);
  const columnPairs =
    fromTableIndex === null || toTableIndex === null
      ? null
      : resolveColumnPairs(
          relation,
          elementAt(tables, fromTableIndex),
          elementAt(tables, toTableIndex),
        );
  if (
    fromTableIndex === null ||
    toTableIndex === null ||
    columnPairs === null
  ) {
    resolvers.report(relation.location);
    return [];
  }
  return [{ draftIndex, relation, fromTableIndex, toTableIndex, columnPairs }];
}

/**
 * Resolves every name-based reference of the draft. An element whose
 * reference does not resolve, or a relation that uses a column in two pairs,
 * is dropped with reference-not-found at its location; a table only loses its
 * primary key or subject area. Repeated columns are removed and an index or
 * relation without columns is dropped, so no format importer reaches a
 * structural error through a column list.
 */
export function resolveDraftReferences(draft: ImportDraft): ResolvedDraft {
  const diagnostics: ImportDiagnostic[] = [];
  const resolvers: Resolvers = {
    resolveTable: createNameResolver(draft.tables.map(({ name }) => name)),
    resolveEnum: createNameResolver(draft.enums.map(({ name }) => name)),
    resolveSubjectArea: createNameResolver(
      draft.subjectAreas.map(({ name }) => name),
    ),
    report: (location) => {
      diagnostics.push(
        createImportDiagnostic("reference-not-found", location, null),
      );
    },
  };
  const tables = draft.tables.map((table) => resolveTable(table, resolvers));
  const indexes = draft.indexes.flatMap((index, draftIndex) =>
    resolveIndex(index, draftIndex, tables, resolvers),
  );
  const relations = draft.relations.flatMap((relation, draftIndex) =>
    resolveRelation(relation, draftIndex, tables, resolvers),
  );
  return { tables, indexes, relations, diagnostics };
}
