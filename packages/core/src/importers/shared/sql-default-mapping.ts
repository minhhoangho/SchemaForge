import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type { ColumnDefault } from "../../model/column-default.js";
import { toNameKey } from "../../model/name-limits.js";
import { tokenizeSql, type SqlToken } from "../sql/sql-lexer.js";
import type { ImportDiagnosticCode } from "./import-diagnostic-codes.js";
import type { DraftColumnType } from "./import-draft.js";
import {
  findDefaultFunction,
  isSqlSymbol as isSymbol,
  type DefaultFunctionResult,
} from "./sql-default-functions.js";

// `string`: text is the content between the quotes, still SQL-escaped as
// @dbml/core returns it (`it''s`); it is unescaped for the dialect here, and
// kept as is for DBML ("any"), whose parser already unescapes. Otherwise text
// is the source text of the number, boolean or expression, read again here.
export type RawSqlDefault = {
  readonly kind: "string" | "number" | "boolean" | "expression";
  readonly text: string;
};

export type SqlDefaultMapping = {
  readonly defaultValue: ColumnDefault | null;
  readonly isAutoIncrement: boolean;
  readonly codes: readonly ImportDiagnosticCode[];
};

type DefaultValue =
  | {
      readonly kind: "literal";
      readonly text: string;
      readonly isNumber: boolean;
    }
  | { readonly kind: "null" }
  | { readonly kind: "function"; readonly result: DefaultFunctionResult }
  | { readonly kind: "unsupported" };

const UNSUPPORTED: DefaultValue = { kind: "unsupported" };
// Casts and wrapping parentheses alternate a few times at most in real dumps;
// the bound keeps a hostile chain of casts from costing quadratic time.
const MAX_NORMALIZATION_STEPS = 8;
// DBML expressions may come from any dialect; PostgreSQL lexing reads the
// quoting of all three except MySQL backticks and SQL Server brackets.
const ANY_DIALECT_LEXING: SqlDialect = "postgresql";
const BOOLEAN_NUMBERS: ReadonlyMap<string, string> = new Map([
  ["1", "true"],
  ["0", "false"],
]);
const BOOLEAN_WORDS: ReadonlySet<string> = new Set(["true", "false"]);
const NULL_WORD = "null";
const INTEGER_KINDS: ReadonlySet<DraftColumnType["kind"]> = new Set([
  "smallint",
  "integer",
  "bigint",
]);
const TIMESTAMP_KINDS: ReadonlySet<DraftColumnType["kind"]> = new Set([
  "timestamp",
  "timestamptz",
]);
// How pg_dump, mysqldump and prisma db pull write a point in time: a space
// before the time, and an offset of hours only (`+00`) or hours and minutes.
const DUMP_TIMESTAMP_PATTERN =
  /^([0-9]{4}-[0-9]{2}-[0-9]{2}) ([0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?)(?:([+-][0-9]{2})(:[0-9]{2})?)?$/;

// Counts the parenthesis pairs that wrap the whole expression in one pass:
// a pair wraps only if no token between it sits at or above its depth.
function countWrappingPairs(tokens: readonly SqlToken[]): number {
  const base = tokens[0]?.depth ?? 0;
  let leading = 0;
  while (isSymbol(tokens[leading], "(")) {
    leading += 1;
  }
  let trailing = 0;
  while (
    trailing < tokens.length - leading &&
    isSymbol(tokens.at(-1 - trailing), ")")
  ) {
    trailing += 1;
  }
  const inner = tokens.slice(leading, tokens.length - trailing);
  // A spread would overflow the argument limit on a long expression.
  const innerDepth = inner.reduce(
    (lowest, token) => Math.min(lowest, token.depth),
    base + leading,
  );
  return Math.min(leading, trailing, innerDepth - base);
}

// A PostgreSQL cast `::type` at the outer level ends the value.
function findCast(tokens: readonly SqlToken[]): number {
  const base = tokens[0]?.depth;
  return tokens.findIndex((token, index) => {
    const next = tokens[index + 1];
    return (
      index > 0 &&
      token.depth === base &&
      isSymbol(token, ":") &&
      isSymbol(next, ":") &&
      next?.start === token.start + 1
    );
  });
}

function normalize(tokens: readonly SqlToken[]): readonly SqlToken[] {
  let current = tokens;
  for (let step = 0; step < MAX_NORMALIZATION_STEPS; step += 1) {
    const pairs = countWrappingPairs(current);
    const unwrapped = current.slice(pairs, current.length - pairs);
    const cast = findCast(unwrapped);
    const next = cast === -1 ? unwrapped : unwrapped.slice(0, cast);
    if (next.length === current.length) {
      return current;
    }
    current = next;
  }
  return current;
}

function classifyWord(text: string): DefaultValue {
  const key = toNameKey(text);
  if (BOOLEAN_WORDS.has(key)) {
    return { kind: "literal", text: key, isNumber: false };
  }
  return key === NULL_WORD ? { kind: "null" } : UNSUPPORTED;
}

// A MySQL charset introducer, `_utf8mb4'…'`, names the charset of exactly one
// string; the model has no charset, so only the string is kept (spec section 5).
function isCharsetIntroducer(
  tokens: readonly SqlToken[],
  dialect: SqlDialect | "any",
): boolean {
  const [first, second, third] = tokens;
  return (
    dialect === "mysql" &&
    first?.kind === "word" &&
    first.text.length > 1 &&
    first.text.startsWith("_") &&
    second?.kind === "string" &&
    third === undefined
  );
}

function classifyTokens(
  tokens: readonly SqlToken[],
  dialect: SqlDialect | "any",
): DefaultValue {
  const [first, second, ...rest] = tokens;
  if (isCharsetIntroducer(tokens, dialect)) {
    return { kind: "literal", text: second?.value ?? "", isNumber: false };
  }
  if (first?.kind === "string" && second === undefined) {
    return { kind: "literal", text: first.value, isNumber: false };
  }
  if (first?.kind === "number" && second === undefined) {
    return { kind: "literal", text: first.text, isNumber: true };
  }
  if (isSymbol(first, "-") && second?.kind === "number" && rest.length === 0) {
    return { kind: "literal", text: `-${second.text}`, isNumber: true };
  }
  if (first?.kind === "word" && second === undefined) {
    const word = classifyWord(first.text);
    if (word.kind !== "unsupported") {
      return word;
    }
  }
  const result = findDefaultFunction(tokens, dialect);
  return result === null ? UNSUPPORTED : { kind: "function", result };
}

// Re-quotes the content and lets the lexer resolve the dialect's escapes;
// content that does not form exactly one string token is kept verbatim.
function unescapeString(text: string, dialect: SqlDialect): string {
  const tokens = tokenizeSql(`'${text}'`, dialect);
  const [token, extra] = tokens.isOk ? tokens.value : [];
  return token?.kind === "string" && extra === undefined ? token.value : text;
}

function classifyRaw(
  raw: RawSqlDefault,
  dialect: SqlDialect | "any",
): DefaultValue {
  if (raw.kind === "string") {
    const text =
      dialect === "any" ? raw.text : unescapeString(raw.text, dialect);
    return { kind: "literal", text, isNumber: false };
  }
  const tokens = tokenizeSql(
    raw.text,
    dialect === "any" ? ANY_DIALECT_LEXING : dialect,
  );
  return tokens.isOk
    ? classifyTokens(normalize(tokens.value), dialect)
    : UNSUPPORTED;
}

function result(
  defaultValue: ColumnDefault | null,
  codes: readonly ImportDiagnosticCode[] = [],
  isAutoIncrement = false,
): SqlDefaultMapping {
  return { defaultValue, isAutoIncrement, codes };
}

const NOT_SUPPORTED = result(null, ["default-not-supported"]);

function mapFunction(
  functionResult: DefaultFunctionResult,
  columnType: DraftColumnType,
): SqlDefaultMapping {
  switch (functionResult) {
    case "currentTimestamp":
      return TIMESTAMP_KINDS.has(columnType.kind)
        ? result({ kind: "currentTimestamp" })
        : NOT_SUPPORTED;
    case "generateUuid":
    case "approximateUuid":
      if (columnType.kind !== "uuid") {
        return NOT_SUPPORTED;
      }
      return functionResult === "generateUuid"
        ? result({ kind: "generateUuid" })
        : result({ kind: "generateUuid" }, ["default-approximated"]);
    case "sequence":
      return INTEGER_KINDS.has(columnType.kind)
        ? result(null, ["sequence-default-as-auto-increment"], true)
        : NOT_SUPPORTED;
    default: {
      const unreachable: never = functionResult;
      return unreachable;
    }
  }
}

// `2026-01-01 20:04:05.123+00` → `2026-01-01T20:04:05.123+00:00`, the form
// the model reads (validation/rules/default-literals.ts); anything else as is.
function rewriteDumpTimestamp(text: string): string {
  const match = DUMP_TIMESTAMP_PATTERN.exec(text);
  if (match === null) {
    return text;
  }
  const [, date, time, offsetHours, offsetMinutes] = match;
  const offset =
    offsetHours === undefined ? "" : `${offsetHours}${offsetMinutes ?? ":00"}`;
  return `${date ?? ""}T${time ?? ""}${offset}`;
}

/** Maps a SQL column default to the model (import / export spec, section 5). */
export function mapSqlDefault(input: {
  readonly raw: RawSqlDefault;
  readonly columnType: DraftColumnType;
  readonly dialect: SqlDialect | "any";
}): SqlDefaultMapping {
  const value = classifyRaw(input.raw, input.dialect);
  switch (value.kind) {
    case "literal": {
      // 1 and 0 are how SQL Server (and MySQL TINYINT(1)) write booleans;
      // mysqldump quotes them ('1', '0').
      const booleanText =
        (value.isNumber || input.dialect === "mysql") &&
        input.columnType.kind === "boolean"
          ? BOOLEAN_NUMBERS.get(value.text)
          : undefined;
      // DBML keeps the source text of a literal (spec section 7).
      const timestampText =
        !value.isNumber &&
        input.dialect !== "any" &&
        TIMESTAMP_KINDS.has(input.columnType.kind)
          ? rewriteDumpTimestamp(value.text)
          : value.text;
      return result({ kind: "literal", value: booleanText ?? timestampText });
    }
    case "null":
      return result(null);
    case "function":
      return mapFunction(value.result, input.columnType);
    case "unsupported":
      return NOT_SUPPORTED;
    default: {
      const unreachable: never = value;
      return unreachable;
    }
  }
}
