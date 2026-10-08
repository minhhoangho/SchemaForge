import type { CoreTable } from "../shared/dbml-core-adapter-types.js";
import type { DraftDiagnostic } from "../shared/import-draft.js";
import type { SourceLocation } from "../shared/import-types.js";
import {
  createNameResolver,
  type NameResolver,
} from "../shared/resolve-references.js";
import type { RawSqlDefault } from "../shared/sql-default-mapping.js";
import type { SqlServerDescription } from "./sqlserver-extended-property.js";

/**
 * A change to one column that the scanner reads from a statement it keeps from
 * the parser: pg_dump `ALTER COLUMN … ADD GENERATED … AS IDENTITY` or `SET
 * DEFAULT`, and SQL Server `ADD [CONSTRAINT n] DEFAULT … FOR c`.
 */
export type ColumnChange = {
  readonly tableName: string;
  readonly columnName: string;
  readonly start: number;
  readonly change:
    | { readonly kind: "identity" }
    | { readonly kind: "default"; readonly raw: RawSqlDefault };
};

// What the statements that the scanner reads instead of the parser change on a
// column (import / export spec, section 5, flow step 6).
export type ColumnOverride = {
  readonly isIdentity: boolean;
  readonly defaultValue: {
    readonly raw: RawSqlDefault;
    readonly location: SourceLocation;
  } | null;
  readonly comment: string | null;
};

export type SqlOverrides = {
  readonly column: (position: ColumnPosition) => ColumnOverride | null;
  readonly tableComment: (tableIndex: number) => string | null;
};

const NO_OVERRIDE: ColumnOverride = {
  isIdentity: false,
  defaultValue: null,
  comment: null,
};

type ColumnPosition = {
  readonly tableIndex: number;
  readonly columnIndex: number;
};

type PositionResolver = {
  readonly table: NameResolver;
  readonly column: (
    tableName: string,
    columnName: string,
  ) => ColumnPosition | null;
};

function createPositionResolver(
  tables: readonly CoreTable[],
): PositionResolver {
  const resolveTable = createNameResolver(tables.map(({ name }) => name));
  const columnResolvers = new Map<number, NameResolver>();
  const columnResolverOf = (tableIndex: number): NameResolver => {
    const cached = columnResolvers.get(tableIndex);
    if (cached !== undefined) {
      return cached;
    }
    const fields = tables[tableIndex]?.fields ?? [];
    const resolver = createNameResolver(fields.map(({ name }) => name));
    columnResolvers.set(tableIndex, resolver);
    return resolver;
  };
  return {
    table: resolveTable,
    column: (tableName, columnName) => {
      const tableIndex = resolveTable(tableName);
      const columnIndex =
        tableIndex === null ? null : columnResolverOf(tableIndex)(columnName);
      return tableIndex === null || columnIndex === null
        ? null
        : { tableIndex, columnIndex };
    },
  };
}

function toKey({ tableIndex, columnIndex }: ColumnPosition): string {
  return `${String(tableIndex)}:${String(columnIndex)}`;
}

type OverrideState = {
  readonly resolve: PositionResolver;
  readonly columns: Map<string, ColumnOverride>;
  readonly tableComments: Map<number, string>;
  readonly diagnostics: DraftDiagnostic[];
  readonly at: (offset: number) => SourceLocation;
};

function updateColumn(
  state: OverrideState,
  position: ColumnPosition,
  change: Partial<ColumnOverride>,
): void {
  const key = toKey(position);
  state.columns.set(key, {
    ...(state.columns.get(key) ?? NO_OVERRIDE),
    ...change,
  });
}

// What a statement says is lost when it matches no table or column.
function reportUnmatched(state: OverrideState, start: number): void {
  state.diagnostics.push({
    code: "statement-not-supported",
    location: state.at(start),
    target: null,
  });
}

function applyColumnChanges(
  state: OverrideState,
  changes: readonly ColumnChange[],
): void {
  changes.forEach(({ tableName, columnName, start, change }) => {
    const position = state.resolve.column(tableName, columnName);
    if (position === null) {
      reportUnmatched(state, start);
      return;
    }
    updateColumn(
      state,
      position,
      change.kind === "identity"
        ? { isIdentity: true }
        : { defaultValue: { raw: change.raw, location: state.at(start) } },
    );
  });
}

function applyDescriptions(
  state: OverrideState,
  descriptions: readonly SqlServerDescription[],
): void {
  descriptions.forEach(({ tableName, columnName, description, start }) => {
    const tableIndex =
      columnName === null ? state.resolve.table(tableName) : null;
    const position =
      columnName === null ? null : state.resolve.column(tableName, columnName);
    if (tableIndex !== null) {
      state.tableComments.set(tableIndex, description);
    } else if (position !== null) {
      updateColumn(state, position, { comment: description });
    } else {
      reportUnmatched(state, start);
    }
  });
}

/**
 * Matches the column changes and SQL Server descriptions the scanner read to
 * the parsed tables and columns; a statement that matches nothing is reported
 * as statement-not-supported, since what it says is lost.
 */
export function resolveScannerStatements(input: {
  readonly tables: readonly CoreTable[];
  readonly columnChanges: readonly ColumnChange[];
  readonly descriptions: readonly SqlServerDescription[];
  readonly at: (offset: number) => SourceLocation;
}): {
  readonly overrides: SqlOverrides;
  readonly diagnostics: readonly DraftDiagnostic[];
} {
  const state: OverrideState = {
    resolve: createPositionResolver(input.tables),
    columns: new Map(),
    tableComments: new Map(),
    diagnostics: [],
    at: input.at,
  };
  applyColumnChanges(state, input.columnChanges);
  applyDescriptions(state, input.descriptions);
  return {
    overrides: {
      column: (position) => state.columns.get(toKey(position)) ?? null,
      tableComment: (tableIndex) => state.tableComments.get(tableIndex) ?? null,
    },
    diagnostics: state.diagnostics,
  };
}
