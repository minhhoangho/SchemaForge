import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { toNameKey } from "../../model/name-limits.js";
import { tokenizeSql } from "./sql-lexer.js";
import {
  isNameAt,
  isSymbolAt,
  readParenthesizedList,
  wordAt,
  type Tokens,
} from "./sql-token-reading.js";

// Drops the parenthesis pairs that wrap the whole expression, in one pass: a
// pair wraps only if no token between the pairs sits at or above its depth.
function unwrap(tokens: Tokens): Tokens {
  const base = tokens[0]?.depth ?? 0;
  let leading = 0;
  while (isSymbolAt(tokens, leading, "(")) {
    leading += 1;
  }
  let trailing = 0;
  while (
    trailing < tokens.length - leading &&
    isSymbolAt(tokens, tokens.length - 1 - trailing, ")")
  ) {
    trailing += 1;
  }
  let innerDepth = base + leading;
  for (const token of tokens.slice(leading, tokens.length - trailing)) {
    innerDepth = Math.min(innerDepth, token.depth);
  }
  const pairs = Math.min(leading, trailing, innerDepth - base);
  return tokens.slice(pairs, tokens.length - pairs);
}

function isCastAt(tokens: Tokens, index: number): boolean {
  return isSymbolAt(tokens, index, ":") && isSymbolAt(tokens, index + 1, ":");
}

// `name`, `(name)` or a quoted name at the start, followed by an optional cast
// up to IN; returns the index of IN or null.
function readColumn(tokens: Tokens, columnName: string): number | null {
  const isParenthesized = isSymbolAt(tokens, 0, "(");
  const nameIndex = isParenthesized ? 1 : 0;
  const name = tokens[nameIndex];
  const afterName = isParenthesized ? 3 : 1;
  const isColumn =
    isNameAt(tokens, nameIndex) &&
    (!isParenthesized || isSymbolAt(tokens, 2, ")")) &&
    (name?.value === columnName ||
      toNameKey(name?.value ?? "") === toNameKey(columnName));
  if (!isColumn) {
    return null;
  }
  const base = tokens[0]?.depth;
  const inIndex = tokens.findIndex(
    (token, index) =>
      index >= afterName &&
      token.depth === base &&
      wordAt(tokens, index) === "IN",
  );
  const isCastOrNothing =
    inIndex === afterName ||
    (isCastAt(tokens, afterName) && inIndex > afterName + 2);
  return isCastOrNothing ? inIndex : null;
}

// One list item: `[_charset]'text' [::type]`.
function readValue(item: Tokens): string | null {
  const hasIntroducer =
    item[0]?.kind === "word" &&
    item[0].text.startsWith("_") &&
    item[1]?.start === item[0].start + item[0].text.length;
  const valueIndex = hasIntroducer ? 1 : 0;
  const value = item[valueIndex];
  const rest = item.length - valueIndex - 1;
  const hasCastOrNothing =
    rest === 0 || (rest > 2 && isCastAt(item, valueIndex + 1));
  return value?.kind === "string" && hasCastOrNothing ? value.value : null;
}

/**
 * Reads the values of a CHECK of the form `<column> IN ('a', 'b', …)` on
 * `columnName` (quoted or cast column, `N` or cast values); null for any other
 * expression (import / export spec, section 5, "CHECK").
 */
export function readCheckEnumValues(input: {
  readonly expression: string;
  readonly columnName: string;
  readonly dialect: SqlDialect;
}): readonly string[] | null {
  const lexed = tokenizeSql(input.expression, input.dialect);
  if (!lexed.isOk) {
    return null;
  }
  const tokens = unwrap(lexed.value);
  const inIndex = readColumn(tokens, input.columnName);
  if (inIndex === null || !isSymbolAt(tokens, inIndex + 1, "(")) {
    return null;
  }
  const list = readParenthesizedList(tokens, inIndex + 1);
  if (list.close !== tokens.length - 1) {
    return null;
  }
  const values: string[] = [];
  for (const item of list.items) {
    const value = readValue(tokens.slice(item.start, item.end));
    if (value === null) {
      return null;
    }
    values.push(value);
  }
  return values;
}
