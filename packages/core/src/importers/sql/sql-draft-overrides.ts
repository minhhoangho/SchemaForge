import type { CoreTable } from "../shared/dbml-core-adapter-types.js";
import type { DraftDiagnostic } from "../shared/import-draft.js";
import type { SourceLocation } from "../shared/import-types.js";
import {
  createNameResolver,
  type NameResolver,
} from "../shared/resolve-references.js";
import type { RawSqlDefault } from "../shared/sql-default-mapping.js";
import type { PostgresqlAlterColumn } from "./postgresql-identity.js";
import type { SqlServerDescription } from "./sqlserver-extended-property.js";

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
  readonly column: (
    tableIndex: number,
    columnIndex: number,
  ) => ColumnOverride | null;
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

/**
 * Matches pg_dump `ALTER COLUMN` statements and SQL Server descriptions to the
 * parsed tables and columns; a statement that matches nothing is reported as
 * statement-not-supported, since what it says is lost.
 */
export function resolveScannerStatements(input: {
  readonly tables: readonly CoreTable[];
  readonly alterColumns: readonly PostgresqlAlterColumn[];
  readonly descriptions: readonly SqlServerDescription[];
  readonly at: (offset: number) => SourceLocation;
}): {
  readonly overrides: SqlOverrides;
  readonly diagnostics: readonly DraftDiagnostic[];
} {
  const resolve = createPositionResolver(input.tables);
  const columns = new Map<string, ColumnOverride>();
  const tableComments = new Map<number, string>();
  const diagnostics: DraftDiagnostic[] = [];
  const update = (
    position: ColumnPosition,
    change: Partial<ColumnOverride>,
  ): void => {
    const key = toKey(position);
    columns.set(key, { ...(columns.get(key) ?? NO_OVERRIDE), ...change });
  };
  const reportUnmatched = (start: number): void => {
    diagnostics.push({
      code: "statement-not-supported",
      location: input.at(start),
      target: null,
    });
  };
  input.alterColumns.forEach(({ tableName, columnName, start, change }) => {
    const position = resolve.column(tableName, columnName);
    if (position === null) {
      reportUnmatched(start);
      return;
    }
    update(
      position,
      change.kind === "identity"
        ? { isIdentity: true }
        : { defaultValue: { raw: change.raw, location: input.at(start) } },
    );
  });
  input.descriptions.forEach(
    ({ tableName, columnName, description, start }) => {
      const tableIndex = columnName === null ? resolve.table(tableName) : null;
      const position =
        columnName === null ? null : resolve.column(tableName, columnName);
      if (tableIndex !== null) {
        tableComments.set(tableIndex, description);
      } else if (position !== null) {
        update(position, { comment: description });
      } else {
        reportUnmatched(start);
      }
    },
  );
  return {
    overrides: {
      column: (tableIndex, columnIndex) =>
        columns.get(toKey({ tableIndex, columnIndex })) ?? null,
      tableComment: (tableIndex) => tableComments.get(tableIndex) ?? null,
    },
    diagnostics,
  };
}
