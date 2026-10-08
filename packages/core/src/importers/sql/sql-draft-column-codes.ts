import type { ImportDiagnosticCode } from "../shared/import-diagnostic-codes.js";
import type { DraftColumn, DraftColumnType } from "../shared/import-draft.js";
import type { SourceLocation } from "../shared/import-types.js";
import {
  mapSqlDefault,
  type RawSqlDefault,
} from "../shared/sql-default-mapping.js";
import type { SqlDraftContext } from "./sql-draft-context.js";

// The diagnostics of one column and the mapping of its default.

export type FieldCode = {
  readonly code: ImportDiagnosticCode;
  // The last path segment; undefined targets the column itself.
  readonly field?: string;
};

export type ColumnPosition = {
  readonly tableIndex: number;
  readonly columnIndex: number;
};

function defaultCodeField(code: ImportDiagnosticCode): string {
  return code === "sequence-default-as-auto-increment"
    ? "isAutoIncrement"
    : "defaultValue";
}

export function translateDefault(
  raw: RawSqlDefault | null,
  columnType: DraftColumnType,
  context: SqlDraftContext,
): {
  readonly defaultValue: DraftColumn["defaultValue"];
  readonly isAutoIncrement: boolean;
  readonly codes: readonly FieldCode[];
} {
  if (raw === null) {
    return { defaultValue: null, isAutoIncrement: false, codes: [] };
  }
  const mapping = mapSqlDefault({ raw, columnType, dialect: context.dialect });
  return {
    defaultValue: mapping.defaultValue ?? null,
    isAutoIncrement: mapping.isAutoIncrement,
    codes: mapping.codes.map((code) => ({
      code,
      field: defaultCodeField(code),
    })),
  };
}

export function reportColumnCodes(
  codes: readonly FieldCode[],
  location: SourceLocation | null,
  position: ColumnPosition,
  context: SqlDraftContext,
): void {
  codes.forEach(({ code, field }) =>
    context.parts.diagnostics.push({
      code,
      location,
      target: {
        kind: "column",
        ...position,
        ...(field === undefined ? {} : { field }),
      },
    }),
  );
}
