import type { ColumnType } from "@schemaforge/core";

/** The seventeen column kinds offered in the first group of the type combobox. */
export const COMMON_COLUMN_TYPE_KINDS = [
  "smallint",
  "integer",
  "bigint",
  "decimal",
  "real",
  "double",
  "boolean",
  "char",
  "varchar",
  "text",
  "uuid",
  "date",
  "time",
  "timestamp",
  "timestamptz",
  "json",
  "binary",
] as const;

export type CommonColumnTypeKind = (typeof COMMON_COLUMN_TYPE_KINDS)[number];

export const DEFAULT_VARCHAR_LENGTH = 255;
export const DEFAULT_DECIMAL_PRECISION = 10;
export const DEFAULT_DECIMAL_SCALE = 2;

export function isCommonColumnTypeKind(
  kind: string,
): kind is CommonColumnTypeKind {
  return COMMON_COLUMN_TYPE_KINDS.some((commonKind) => commonKind === kind);
}

function previousLength(previous: ColumnType): number {
  return previous.kind === "char" || previous.kind === "varchar"
    ? previous.length
    : DEFAULT_VARCHAR_LENGTH;
}

/**
 * Builds the type a column gets when the user picks `kind`. Parameters carry
 * over between two kinds that share them (`char` and `varchar` keep the
 * length, `decimal` keeps precision and scale); otherwise the defaults apply.
 */
export function buildColumnType(
  kind: CommonColumnTypeKind,
  previous: ColumnType,
): ColumnType {
  switch (kind) {
    case "char":
    case "varchar":
      return { kind, length: previousLength(previous) };
    case "decimal":
      return previous.kind === "decimal"
        ? { kind, precision: previous.precision, scale: previous.scale }
        : {
            kind,
            precision: DEFAULT_DECIMAL_PRECISION,
            scale: DEFAULT_DECIMAL_SCALE,
          };
    case "smallint":
    case "integer":
    case "bigint":
    case "real":
    case "double":
    case "boolean":
    case "text":
    case "uuid":
    case "date":
    case "time":
    case "timestamp":
    case "timestamptz":
    case "json":
    case "binary":
      return { kind };
    default: {
      const unhandledKind: never = kind;
      return unhandledKind;
    }
  }
}

const SEARCH_MATCH = 1;
const SEARCH_NO_MATCH = 0;

/**
 * The cmdk filter of the type list. It matches the search against an item's
 * keywords, which hold its visible text, and never against its value: the
 * value of an enum item is the enum id, whose letters would match searches
 * that have nothing to do with the enum name.
 */
export function scoreColumnTypeSearch(
  value: string,
  search: string,
  keywords: readonly string[] = [],
): number {
  const query = search.trim().toLowerCase();
  return keywords.some((keyword) => keyword.toLowerCase().includes(query))
    ? SEARCH_MATCH
    : SEARCH_NO_MATCH;
}
