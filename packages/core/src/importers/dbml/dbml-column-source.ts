// The adapter loses two things the column's source text still has (spec
// section 7, "Parser"): whether the type was quoted, and the exact text of a
// number default. This reads them back with a one-pass lexer over the text of
// a single column definition.

type ColumnToken = {
  readonly kind: "word" | "doubleQuoted" | "otherQuoted" | "symbol";
  readonly text: string;
  readonly start: number;
  readonly end: number;
};

export type DbmlColumnSource = {
  readonly isTypeQuoted: boolean;
  /** The text after `default:`, or null when the column has no default setting. */
  readonly defaultText: string | null;
};

const SYMBOLS: ReadonlySet<string> = new Set([
  "[",
  "]",
  "(",
  ")",
  ",",
  ":",
  ".",
]);
const QUOTES: ReadonlySet<string> = new Set(['"', "'", "`"]);
const TRIPLE_QUOTE = "'''";
const ESCAPE = "\\";
const WHITESPACE = /\s/;
const DEFAULT_KEY = "default";
const SETTINGS_DEPTH = 1;

function isWordCharacter(character: string): boolean {
  return (
    !WHITESPACE.test(character) &&
    !SYMBOLS.has(character) &&
    !QUOTES.has(character)
  );
}

// An unterminated string runs to the end of the text.
function findQuotedEnd(text: string, start: number): number {
  const closing = text.startsWith(TRIPLE_QUOTE, start)
    ? TRIPLE_QUOTE
    : (text[start] ?? "");
  let offset = start + closing.length;
  while (offset < text.length) {
    if (text[offset] === ESCAPE) {
      offset += 2;
    } else if (text.startsWith(closing, offset)) {
      return offset + closing.length;
    } else {
      offset += 1;
    }
  }
  return text.length;
}

function findWordEnd(text: string, start: number): number {
  let offset = start;
  while (offset < text.length && isWordCharacter(text[offset] ?? "")) {
    offset += 1;
  }
  return offset;
}

function readToken(text: string, start: number): ColumnToken {
  const character = text[start] ?? "";
  if (SYMBOLS.has(character)) {
    return { kind: "symbol", text: character, start, end: start + 1 };
  }
  if (QUOTES.has(character)) {
    const end = findQuotedEnd(text, start);
    const kind = character === '"' ? "doubleQuoted" : "otherQuoted";
    return { kind, text: text.slice(start, end), start, end };
  }
  const end = findWordEnd(text, start);
  return { kind: "word", text: text.slice(start, end), start, end };
}

function tokenize(text: string): readonly ColumnToken[] {
  const tokens: ColumnToken[] = [];
  let offset = 0;
  while (offset < text.length) {
    if (WHITESPACE.test(text[offset] ?? "")) {
      offset += 1;
    } else {
      const token = readToken(text, offset);
      tokens.push(token);
      offset = token.end;
    }
  }
  return tokens;
}

function isSymbol(token: ColumnToken | undefined, symbol: string): boolean {
  return token?.kind === "symbol" && token.text === symbol;
}

// Token 0 is the column name; a schema prefix (`public."status"`) comes before the type name.
function readIsTypeQuoted(tokens: readonly ColumnToken[]): boolean {
  let position = 1;
  while (isSymbol(tokens[position + 1], ".")) {
    position += 2;
  }
  return tokens[position]?.kind === "doubleQuoted";
}

function bracketStep(token: ColumnToken): number {
  if (isSymbol(token, "[")) {
    return 1;
  }
  return isSymbol(token, "]") ? -1 : 0;
}

function readDefaultText(
  text: string,
  tokens: readonly ColumnToken[],
): string | null {
  let depth = 0;
  for (const [position, token] of tokens.entries()) {
    depth += bracketStep(token);
    const colon = tokens[position + 1];
    const isDefaultKey =
      depth === SETTINGS_DEPTH &&
      token.kind === "word" &&
      token.text.toLowerCase() === DEFAULT_KEY &&
      colon !== undefined &&
      isSymbol(colon, ":");
    if (isDefaultKey) {
      const end = tokens
        .slice(position + 2)
        .find((next) => isSymbol(next, ",") || isSymbol(next, "]"));
      return text.slice(colon.end, end?.start ?? text.length).trim();
    }
  }
  return null;
}

/** Reads back what the parser model loses from the text of one column definition. */
export function readDbmlColumnSource(text: string): DbmlColumnSource {
  const tokens = tokenize(text);
  return {
    isTypeQuoted: readIsTypeQuoted(tokens),
    defaultText: readDefaultText(text, tokens),
  };
}
