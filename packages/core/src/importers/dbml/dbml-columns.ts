import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type {
  CoreDefaultValue,
  CoreField,
  CoreToken,
} from "../shared/dbml-core-adapter-types.js";
import type { ImportDiagnosticCode } from "../shared/import-diagnostic-codes.js";
import type {
  DraftColumn,
  DraftDiagnostic,
  DraftIndex,
  DraftTable,
  DraftTarget,
} from "../shared/import-draft.js";
import type { SourceLocation } from "../shared/import-types.js";
import { mapSqlDefault } from "../shared/sql-default-mapping.js";
import type { RawSqlDefault } from "../shared/sql-default-mapping.js";
import { readDbmlColumnSource } from "./dbml-column-source.js";
import { resolveDbmlType } from "./dbml-type-resolution.js";

export type DbmlTableContext = {
  readonly source: string;
  readonly lineStarts: readonly number[];
  readonly databaseType: SqlDialect;
  readonly enumNameKeys: ReadonlySet<string>;
  readonly subjectAreaByTable: ReadonlyMap<string, string>;
};

/** Filled in source order, so positions in these arrays are draft positions. */
export type TableDraftParts = {
  readonly tables: DraftTable[];
  readonly indexes: DraftIndex[];
  readonly diagnostics: DraftDiagnostic[];
};

export function locationOf(token: CoreToken | null): SourceLocation | null {
  return token?.start ?? null;
}

function toOffset(context: DbmlTableContext, location: SourceLocation): number {
  const lineStart = context.lineStarts[location.line - 1];
  return lineStart === undefined
    ? context.source.length
    : lineStart + location.column - 1;
}

function sliceToken(
  context: DbmlTableContext,
  token: CoreToken | null,
): string {
  return token === null
    ? ""
    : context.source.slice(
        toOffset(context, token.start),
        toOffset(context, token.end),
      );
}

// The parser turns a number default into a JavaScript number; the source text
// keeps every digit. Text that reads as another number is not trusted.
function toRawDefault(
  value: CoreDefaultValue,
  sourceText: string | null,
): RawSqlDefault {
  const isSameNumber =
    value.type === "number" &&
    sourceText !== null &&
    sourceText !== "" &&
    Number(sourceText) === Number(value.value);
  return {
    kind: value.type,
    text: isSameNumber ? sourceText : value.value,
  };
}

function defaultCodeField(code: ImportDiagnosticCode): string {
  return code === "sequence-default-as-auto-increment"
    ? "isAutoIncrement"
    : "defaultValue";
}

/** One column; its diagnostics go to `parts`. */
export function translateColumn(
  field: CoreField,
  target: { readonly tableIndex: number; readonly columnIndex: number },
  isPrimaryKey: boolean,
  context: DbmlTableContext,
  parts: TableDraftParts,
): DraftColumn {
  const location = locationOf(field.token);
  const report = (code: ImportDiagnosticCode, fieldName: string): void => {
    const columnTarget: DraftTarget = {
      kind: "column",
      ...target,
      field: fieldName,
    };
    parts.diagnostics.push({ code, location, target: columnTarget });
  };
  const columnSource = readDbmlColumnSource(sliceToken(context, field.token));
  const typeMapping = resolveDbmlType({
    rawType: field.typeName,
    isQuoted: columnSource.isTypeQuoted,
    enumNameKeys: context.enumNameKeys,
    databaseType: context.databaseType,
  });
  typeMapping.codes.forEach((code) => {
    report(code, "type");
  });
  const defaultMapping =
    field.defaultValue === null
      ? null
      : mapSqlDefault({
          raw: toRawDefault(field.defaultValue, columnSource.defaultText),
          columnType: typeMapping.type,
          dialect: "any",
        });
  defaultMapping?.codes.forEach((code) => {
    report(code, defaultCodeField(code));
  });
  field.checks.forEach((check) =>
    parts.diagnostics.push({
      code: "check-constraint-not-supported",
      location: locationOf(check.token) ?? location,
      target: null,
    }),
  );
  return {
    name: field.name,
    type: typeMapping.type,
    // As in SQL, a primary key column is never null.
    isNullable: !field.isNotNull && !isPrimaryKey,
    isUnique: field.isUnique,
    isAutoIncrement:
      field.isIncrement ||
      typeMapping.isAutoIncrement ||
      (defaultMapping?.isAutoIncrement ?? false),
    defaultValue: defaultMapping?.defaultValue ?? null,
    comment: field.note ?? "",
    location,
  };
}
