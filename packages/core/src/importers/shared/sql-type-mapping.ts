import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { toNameKey } from "../../model/name-limits.js";
import { isSafeCustomTypeName } from "../../validation/rules/custom-type-name.js";
import { tokenizeSql, type SqlToken } from "../sql/sql-lexer.js";
import type { ImportDiagnosticCode } from "./import-diagnostic-codes.js";
import { isSqlSymbol as isSymbol } from "./sql-default-functions.js";
import { mapped, type SqlTypeMapping } from "./sql-type-rule-builders.js";
import { SQL_TYPE_RULES } from "./sql-type-rules.js";

export type { SqlTypeMapping } from "./sql-type-rule-builders.js";

export type SqlTypeInput = {
  readonly rawType: string;
  readonly dialect: SqlDialect;
  readonly enumNameKeys: ReadonlySet<string>;
  readonly hasUuidDefault: boolean;
};

export type SqlServerIdentity = {
  readonly seed: string;
  readonly step: string;
};

type ParsedTypeName = {
  // Unquoted type words without a schema qualifier.
  readonly words: readonly string[];
  // Arguments of the single parenthesized list; null when there is none.
  readonly args: readonly string[] | null;
};

const IDENTITY_KEYWORD = "identity";
const UNSIGNED = "unsigned";
const ZEROFILL = "zerofill";
const MYSQL_MODIFIERS: ReadonlySet<string> = new Set([UNSIGNED, ZEROFILL]);
const WHITESPACE_RUN = /\s+/g;
const DEFAULT_IDENTITY: SqlServerIdentity = { seed: "1", step: "1" };

function isNameToken(token: SqlToken): boolean {
  return token.kind === "word" || token.kind === "quotedIdentifier";
}

// Words before the argument list may carry a schema (`public.status`); only
// the words after the last dot name the type.
function readTypeWords(
  before: readonly SqlToken[],
  after: readonly SqlToken[],
): readonly string[] | null {
  const lastDot = before.findLastIndex((token) => isSymbol(token, "."));
  const words = [...before.slice(lastDot + 1), ...after];
  if (words.length === 0 || !words.every(isNameToken)) {
    return null;
  }
  return words.map((token) => token.value);
}

// Every argument is exactly one number or word, like `10`, `max` or `Point`.
function readArguments(inside: readonly SqlToken[]): readonly string[] | null {
  const args: string[] = [];
  for (let index = 0; index < inside.length; index += 2) {
    const token = inside[index];
    const separator = inside[index + 1];
    const isArgument = token?.kind === "number" || token?.kind === "word";
    if (!isArgument || (separator !== undefined && !isSymbol(separator, ","))) {
      return null;
    }
    args.push(token.text);
  }
  return args.length === 0 ? null : args;
}

function parseTypeName(tokens: readonly SqlToken[]): ParsedTypeName | null {
  const open = tokens.findIndex((token) => isSymbol(token, "("));
  const parentheses = tokens.filter(
    (token) => isSymbol(token, "(") || isSymbol(token, ")"),
  );
  if (open === -1) {
    const words = parentheses.length === 0 ? readTypeWords(tokens, []) : null;
    return words === null ? null : { words, args: null };
  }
  const close = tokens.findIndex((token) => isSymbol(token, ")"));
  if (parentheses.length !== 2 || close < open) {
    return null;
  }
  const words = readTypeWords(tokens.slice(0, open), tokens.slice(close + 1));
  const args = readArguments(tokens.slice(open + 1, close));
  return words === null || args === null ? null : { words, args };
}

// The scanner hands over the source text, which may wrap or indent words.
function mapCustomType(rawType: string): SqlTypeMapping {
  const name = rawType.trim().replace(WHITESPACE_RUN, " ");
  return isSafeCustomTypeName(name)
    ? mapped({ kind: "custom", name })
    : mapped({ kind: "text" }, ["type-not-supported"]);
}

function addCodes(
  mapping: SqlTypeMapping,
  codes: readonly ImportDiagnosticCode[],
): SqlTypeMapping {
  const merged = [...new Set([...mapping.codes, ...codes])];
  return { ...mapping, codes: merged };
}

// MySQL writes UNSIGNED and ZEROFILL after the type (`int(10) unsigned
// zerofill`). The model has neither: unsigned is approximated by the signed
// type (or the wider type the spec table names) and ZEROFILL, which implies
// UNSIGNED, is dropped like a display width.
function mapMysqlModifiers(
  words: readonly string[],
  args: readonly string[] | null,
  hasUuidDefault: boolean,
): SqlTypeMapping | null {
  const keys = words.map(toNameKey);
  let end = keys.length;
  while (end > 1 && MYSQL_MODIFIERS.has(keys[end - 1] ?? "")) {
    end -= 1;
  }
  if (end === keys.length) {
    return null;
  }
  const base = keys.slice(0, end).join(" ");
  const rules = SQL_TYPE_RULES.mysql;
  const unsignedRule = rules.get(`${base} ${UNSIGNED}`) ?? rules.get(base);
  const mapping = unsignedRule?.(args, hasUuidDefault) ?? null;
  const hasZerofill = keys.slice(end).includes(ZEROFILL);
  return mapping === null
    ? null
    : addCodes(mapping, [
        "type-approximated",
        ...(hasZerofill ? (["type-parameter-dropped"] as const) : []),
      ]);
}

function mapKnownType(
  parsed: ParsedTypeName,
  input: SqlTypeInput,
): SqlTypeMapping | null {
  const name = parsed.words.join(" ");
  const rule = SQL_TYPE_RULES[input.dialect].get(toNameKey(name));
  const known = rule?.(parsed.args, input.hasUuidDefault) ?? null;
  if (known !== null || input.dialect !== "mysql") {
    return known;
  }
  return mapMysqlModifiers(parsed.words, parsed.args, input.hasUuidDefault);
}

/** Maps a SQL column type to the model (import / export spec, section 5). */
export function mapSqlType(input: SqlTypeInput): SqlTypeMapping {
  const tokens = tokenizeSql(input.rawType, input.dialect);
  const parsed = tokens.isOk ? parseTypeName(tokens.value) : null;
  if (parsed === null) {
    return mapCustomType(input.rawType);
  }
  const known = mapKnownType(parsed, input);
  if (known !== null) {
    return known;
  }
  const name = parsed.words.join(" ");
  if (parsed.args === null && input.enumNameKeys.has(toNameKey(name))) {
    return mapped({ kind: "enum", enumName: name });
  }
  return mapCustomType(input.rawType);
}

function readIdentityArguments(
  rawType: string,
  tokens: readonly SqlToken[],
): SqlServerIdentity | null {
  if (tokens.length === 0) {
    return DEFAULT_IDENTITY;
  }
  const open = tokens[0];
  const close = tokens.at(-1);
  const commas = tokens.filter((token) => isSymbol(token, ","));
  const parentheses = tokens.filter(
    (token) => isSymbol(token, "(") || isSymbol(token, ")"),
  );
  const comma = commas[0];
  if (
    open === undefined ||
    close === undefined ||
    comma === undefined ||
    !isSymbol(open, "(") ||
    !isSymbol(close, ")") ||
    commas.length !== 1 ||
    parentheses.length !== 2
  ) {
    return null;
  }
  const seed = rawType.slice(open.start + 1, comma.start).trim();
  const step = rawType.slice(comma.start + 1, close.start).trim();
  return seed === "" || step === "" ? null : { seed, step };
}

/**
 * Splits a trailing `IDENTITY[(seed, step)]` off a SQL Server type, which
 * @dbml/core leaves inside the type name (spec section 5, footnote 1).
 */
export function splitSqlServerIdentity(rawType: string): {
  readonly typeName: string;
  readonly identity: SqlServerIdentity | null;
} {
  const unchanged = { typeName: rawType, identity: null };
  const tokens = tokenizeSql(rawType, "sqlserver");
  if (!tokens.isOk) {
    return unchanged;
  }
  const index = tokens.value.findIndex(
    (token) =>
      token.kind === "word" && toNameKey(token.text) === IDENTITY_KEYWORD,
  );
  const keyword = tokens.value[index];
  if (index < 1 || keyword === undefined) {
    return unchanged;
  }
  const identity = readIdentityArguments(
    rawType,
    tokens.value.slice(index + 1),
  );
  return identity === null
    ? unchanged
    : { typeName: rawType.slice(0, keyword.start).trimEnd(), identity };
}
