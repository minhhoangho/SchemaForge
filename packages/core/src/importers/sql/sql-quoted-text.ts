import type { SqlDialect } from "../../generators/shared/generator-types.js";

// Reads quoted SQL text: strings, dollar quotes and quoted identifiers. Also
// holds the character helpers the lexer shares, so the two files do not
// import each other.

export type QuotedText = {
  readonly kind: "string" | "quotedIdentifier";
  readonly end: number;
  readonly value: string;
};

type Escape = { readonly value: string; readonly next: number };

type QuoteRule = {
  readonly kind: QuotedText["kind"];
  readonly close: string;
  readonly readEscape: ((source: string, at: number) => Escape) | null;
};

export const DECIMAL_DIGITS = "0123456789";
const OCTAL_DIGITS = "01234567";
const HEX_DIGITS = "0123456789abcdefABCDEF";
const MAX_CODE_POINT = 0x10ffff;

const MYSQL_ESCAPES: ReadonlyMap<string, string> = new Map([
  ["0", "\0"],
  ["b", "\b"],
  ["n", "\n"],
  ["r", "\r"],
  ["t", "\t"],
  ["Z", "\x1a"],
  // MySQL keeps the backslash of \% and \_ for LIKE patterns.
  ["%", "\\%"],
  ["_", "\\_"],
]);

const POSTGRESQL_ESCAPES: ReadonlyMap<string, string> = new Map([
  ["b", "\b"],
  ["f", "\f"],
  ["n", "\n"],
  ["r", "\r"],
  ["t", "\t"],
]);

// Marker after the backslash, digits, minimum and maximum digit count, radix.
const POSTGRESQL_NUMERIC_ESCAPES = [
  { marker: "x", digits: HEX_DIGITS, min: 1, max: 2, radix: 16 },
  { marker: "u", digits: HEX_DIGITS, min: 4, max: 4, radix: 16 },
  { marker: "U", digits: HEX_DIGITS, min: 8, max: 8, radix: 16 },
] as const;

export function isCharIn(char: string, chars: string): boolean {
  return char.length === 1 && chars.includes(char);
}

export function skipChars(
  source: string,
  from: number,
  chars: string,
  max = Infinity,
): number {
  let end = from;
  while (end - from < max && isCharIn(source.charAt(end), chars)) {
    end += 1;
  }
  return end;
}

function readMysqlEscape(source: string, at: number): Escape {
  const char = source.charAt(at);
  return { value: MYSQL_ESCAPES.get(char) ?? char, next: at + 1 };
}

function readPostgresqlEscape(source: string, at: number): Escape {
  const char = source.charAt(at);
  const simple = POSTGRESQL_ESCAPES.get(char);
  if (simple !== undefined) {
    return { value: simple, next: at + 1 };
  }
  const numeric = isCharIn(char, OCTAL_DIGITS)
    ? { from: at, digits: OCTAL_DIGITS, min: 1, max: 3, radix: 8 }
    : POSTGRESQL_NUMERIC_ESCAPES.map((rule) => ({
        ...rule,
        from: at + 1,
      })).find((rule) => rule.marker === char);
  if (numeric !== undefined) {
    const end = skipChars(source, numeric.from, numeric.digits, numeric.max);
    const codePoint = Number.parseInt(
      source.slice(numeric.from, end),
      numeric.radix,
    );
    if (end - numeric.from >= numeric.min && codePoint <= MAX_CODE_POINT) {
      return { value: String.fromCodePoint(codePoint), next: end };
    }
  }
  return { value: char, next: at + 1 };
}

function quotedIdentifier(close: string): QuoteRule {
  return { kind: "quotedIdentifier", close, readEscape: null };
}

const STANDARD_STRING: QuoteRule = {
  kind: "string",
  close: "'",
  readEscape: null,
};
const MYSQL_STRING: QuoteRule = {
  ...STANDARD_STRING,
  readEscape: readMysqlEscape,
};
const POSTGRESQL_ESCAPE_STRING: QuoteRule = {
  ...STANDARD_STRING,
  readEscape: readPostgresqlEscape,
};

// The opening text of each quoted token, by dialect. Without ANSI_QUOTES,
// MySQL reads a double-quoted text as a string.
const QUOTE_RULES: Readonly<
  Record<SqlDialect, ReadonlyMap<string, QuoteRule>>
> = {
  postgresql: new Map([
    ...["'", "N'", "n'"].map((open) => [open, STANDARD_STRING] as const),
    ...["E'", "e'"].map((open) => [open, POSTGRESQL_ESCAPE_STRING] as const),
    ['"', quotedIdentifier('"')],
  ]),
  mysql: new Map([
    ...["'", "N'", "n'"].map((open) => [open, MYSQL_STRING] as const),
    ['"', { ...MYSQL_STRING, close: '"' }],
    ["`", quotedIdentifier("`")],
  ]),
  sqlserver: new Map([
    ...["'", "N'", "n'"].map((open) => [open, STANDARD_STRING] as const),
    ['"', quotedIdentifier('"')],
    ["[", quotedIdentifier("]")],
  ]),
};

function readQuoted(
  source: string,
  contentStart: number,
  rule: QuoteRule,
): QuotedText | "unterminated" {
  let value = "";
  let chunkStart = contentStart;
  let index = chunkStart;
  while (index < source.length) {
    const char = source.charAt(index);
    if (char === rule.close) {
      if (source.charAt(index + 1) !== rule.close) {
        const text = value + source.slice(chunkStart, index);
        return { kind: rule.kind, end: index + 1, value: text };
      }
      // A doubled closing quote stands for one quote character.
      value += source.slice(chunkStart, index + 1);
      index += 2;
      chunkStart = index;
    } else if (char === "\\" && rule.readEscape !== null) {
      const escape = rule.readEscape(source, index + 1);
      value += source.slice(chunkStart, index) + escape.value;
      index = escape.next;
      chunkStart = index;
    } else {
      index += 1;
    }
  }
  return "unterminated";
}

function isDollarTagChar(char: string): boolean {
  const isLetter = (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
  return (
    isLetter ||
    char === "_" ||
    char >= "\u0080" ||
    isCharIn(char, DECIMAL_DIGITS)
  );
}

// `$tag$…$tag$`; null when the `$` opens no dollar quote, such as `$1`.
function readDollarQuote(
  source: string,
  offset: number,
): QuotedText | "unterminated" | null {
  if (isCharIn(source.charAt(offset + 1), DECIMAL_DIGITS)) {
    return null;
  }
  let tagEnd = offset + 1;
  while (isDollarTagChar(source.charAt(tagEnd))) {
    tagEnd += 1;
  }
  if (source.charAt(tagEnd) !== "$") {
    return null;
  }
  const tag = source.slice(offset, tagEnd + 1);
  const close = source.indexOf(tag, tagEnd + 1);
  if (close === -1) {
    return "unterminated";
  }
  const value = source.slice(tagEnd + 1, close);
  return { kind: "string", end: close + tag.length, value };
}

// Reads the quoted text opening at `offset`: null when none opens there,
// "unterminated" when it opens but never closes.
export function readQuotedText(
  source: string,
  offset: number,
  dialect: SqlDialect,
): QuotedText | "unterminated" | null {
  const rules = QUOTE_RULES[dialect];
  for (const open of [
    source.slice(offset, offset + 2),
    source.charAt(offset),
  ]) {
    const rule = rules.get(open);
    if (rule !== undefined) {
      return readQuoted(source, offset + open.length, rule);
    }
  }
  const isDollar = source.charAt(offset) === "$" && dialect === "postgresql";
  return isDollar ? readDollarQuote(source, offset) : null;
}
