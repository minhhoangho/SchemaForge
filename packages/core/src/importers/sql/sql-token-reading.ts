import type { SqlToken } from "./sql-lexer.js";

// Token-level reading shared by the statement classifier and the readers of
// statements given to the parser. Keywords are compared case-insensitively and
// only on `word` tokens: a quoted identifier is always a name.

export type Tokens = readonly SqlToken[];

// A token range [start, end) of `tokens`.
export type TokenRange = { readonly start: number; readonly end: number };

export type ParenthesizedList = {
  readonly items: readonly TokenRange[];
  // The index of the closing parenthesis, or tokens.length when it is missing.
  readonly close: number;
};

export function wordAt(tokens: Tokens, index: number): string | null {
  const token = tokens[index];
  return token?.kind === "word" ? token.value.toUpperCase() : null;
}

export function isSymbolAt(
  tokens: Tokens,
  index: number,
  symbol: string,
): boolean {
  const token = tokens[index];
  return token?.kind === "symbol" && token.text === symbol;
}

export function isNameAt(tokens: Tokens, index: number): boolean {
  const kind = tokens[index]?.kind;
  return kind === "word" || kind === "quotedIdentifier";
}

// Reads `name` or `schema.name` (quoted or not) starting at `index`.
export function readQualifiedName(
  tokens: Tokens,
  index: number,
): { readonly lastName: string; readonly next: number } | null {
  if (!isNameAt(tokens, index)) {
    return null;
  }
  let last = index;
  while (isSymbolAt(tokens, last + 1, ".") && isNameAt(tokens, last + 2)) {
    last += 2;
  }
  return { lastName: tokens[last]?.value ?? "", next: last + 1 };
}

const ALTER_TABLE_TARGET_PREFIXES: ReadonlySet<string> = new Set([
  "ONLY",
  "IF",
  "EXISTS",
]);

// Returns the index of the first action token of `ALTER TABLE [IF EXISTS]
// [ONLY] name [*] [WITH {CHECK | NOCHECK}] …`, and the table name without its
// schema ("" when the name is missing).
export function findAlterTableAction(tokens: Tokens): {
  readonly tableName: string;
  readonly index: number;
} {
  let index = 2;
  while (ALTER_TABLE_TARGET_PREFIXES.has(wordAt(tokens, index) ?? "")) {
    index += 1;
  }
  const name = readQualifiedName(tokens, index);
  index = name?.next ?? index;
  index += isSymbolAt(tokens, index, "*") ? 1 : 0;
  const isWithCheck =
    wordAt(tokens, index) === "WITH" &&
    ["CHECK", "NOCHECK"].includes(wordAt(tokens, index + 1) ?? "");
  return {
    tableName: name?.lastName ?? "",
    index: isWithCheck ? index + 2 : index,
  };
}

// The index of the first `(` at parenthesis depth `depth` from `from` on, or
// null.
export function findOpenParenthesis(
  tokens: Tokens,
  from: number,
  depth: number,
): number | null {
  for (let index = from; index < tokens.length; index += 1) {
    if (tokens[index]?.depth === depth && isSymbolAt(tokens, index, "(")) {
      return index;
    }
  }
  return null;
}

// Splits the content of the parentheses opened at `open` on the commas at the
// depth just inside them, in one pass. An empty item (`()`, `(a,)`) is kept,
// as an empty range.
export function readParenthesizedList(
  tokens: Tokens,
  open: number,
): ParenthesizedList {
  const inner = (tokens[open]?.depth ?? 0) + 1;
  const items: TokenRange[] = [];
  let itemStart = open + 1;
  let index = open + 1;
  for (; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === undefined || token.depth < inner) {
      break;
    }
    if (token.depth === inner && isSymbolAt(tokens, index, ",")) {
      items.push({ start: itemStart, end: index });
      itemStart = index + 1;
    }
  }
  items.push({ start: itemStart, end: index });
  return { items, close: index };
}
