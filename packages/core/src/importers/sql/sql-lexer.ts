import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { err, ok, type Result } from "../../result.js";
import {
  DECIMAL_DIGITS,
  isCharIn,
  readQuotedText,
  skipChars,
} from "./sql-quoted-text.js";

export type SqlTokenKind =
  "word" | "quotedIdentifier" | "string" | "number" | "symbol";

// `text` is the source text of the token; `value` drops the quotes and
// resolves escapes. `depth` is the parenthesis depth at the token: an opening
// parenthesis has the outer depth and the tokens inside it the outer depth + 1.
export type SqlToken = {
  readonly kind: SqlTokenKind;
  readonly text: string;
  readonly value: string;
  readonly start: number;
  readonly depth: number;
};

// An unterminated string, comment, dollar quote or quoted identifier, at the
// offset where it opens.
export type ScanFailure = { readonly offset: number };

// One lexing step: the offset after it, the token read (null for whitespace
// and comments), and the parenthesis depth after it.
export type LexedStep = {
  readonly next: number;
  readonly token: SqlToken | null;
  readonly depth: number;
};

type RawToken = Omit<SqlToken, "depth">;

type LexStep =
  | { readonly kind: "token"; readonly token: RawToken }
  | { readonly kind: "skip"; readonly next: number }
  | { readonly kind: "failure"; readonly offset: number };

const WHITESPACE = " \t\n\r\f\v";
const HEX_DIGITS = "0123456789abcdefABCDEF";

function isWordStart(char: string, dialect: SqlDialect): boolean {
  const isLetter = (char >= "a" && char <= "z") || (char >= "A" && char <= "Z");
  const isSqlServerPrefix = dialect === "sqlserver" && isCharIn(char, "@#");
  return isLetter || char === "_" || char >= "\u0080" || isSqlServerPrefix;
}

function isWordPart(char: string, dialect: SqlDialect): boolean {
  return (
    isWordStart(char, dialect) || isCharIn(char, DECIMAL_DIGITS) || char === "$"
  );
}

function rawToken(
  kind: SqlTokenKind,
  source: string,
  start: number,
  end: number,
  value?: string,
): LexStep {
  const text = source.slice(start, end);
  return { kind: "token", token: { kind, text, value: value ?? text, start } };
}

function readNumberEnd(source: string, offset: number): number {
  const isHex =
    source.charAt(offset) === "0" && isCharIn(source.charAt(offset + 1), "xX");
  if (isHex && isCharIn(source.charAt(offset + 2), HEX_DIGITS)) {
    return skipChars(source, offset + 2, HEX_DIGITS);
  }
  let end = skipChars(source, offset, DECIMAL_DIGITS);
  if (source.charAt(end) === ".") {
    end = skipChars(source, end + 1, DECIMAL_DIGITS);
  }
  if (isCharIn(source.charAt(end), "eE")) {
    const exponentStart = isCharIn(source.charAt(end + 1), "+-")
      ? end + 2
      : end + 1;
    if (isCharIn(source.charAt(exponentStart), DECIMAL_DIGITS)) {
      end = skipChars(source, exponentStart, DECIMAL_DIGITS);
    }
  }
  return end;
}

function readTokenAt(
  source: string,
  offset: number,
  dialect: SqlDialect,
): LexStep {
  const char = source.charAt(offset);
  const quoted = readQuotedText(source, offset, dialect);
  if (quoted === "unterminated") {
    return { kind: "failure", offset };
  }
  if (quoted !== null) {
    return rawToken(quoted.kind, source, offset, quoted.end, quoted.value);
  }
  if (
    isCharIn(char, DECIMAL_DIGITS) ||
    (char === "." && isCharIn(source.charAt(offset + 1), DECIMAL_DIGITS))
  ) {
    return rawToken("number", source, offset, readNumberEnd(source, offset));
  }
  if (isWordStart(char, dialect)) {
    let end = offset + 1;
    while (isWordPart(source.charAt(end), dialect)) {
      end += 1;
    }
    return rawToken("word", source, offset, end);
  }
  return rawToken("symbol", source, offset, offset + 1);
}

function readBlockComment(
  source: string,
  offset: number,
  dialect: SqlDialect,
): LexStep {
  if (dialect === "mysql" && source.charAt(offset + 2) === "!") {
    // MySQL runs the content of `/*!50003 … */`, so it is read as SQL.
    return {
      kind: "skip",
      next: skipChars(source, offset + 3, DECIMAL_DIGITS),
    };
  }
  let nesting = 1;
  let index = offset + 2;
  while (index < source.length) {
    const isOpen = dialect === "postgresql" && source.startsWith("/*", index);
    const isClose = source.startsWith("*/", index);
    nesting += isOpen ? 1 : isClose ? -1 : 0;
    index += isOpen || isClose ? 2 : 1;
    if (nesting === 0) {
      return { kind: "skip", next: index };
    }
  }
  return { kind: "failure", offset };
}

function lexAt(source: string, offset: number, dialect: SqlDialect): LexStep {
  const char = source.charAt(offset);
  const next = source.charAt(offset + 1);
  if (isCharIn(char, WHITESPACE)) {
    return { kind: "skip", next: offset + 1 };
  }
  if ((char === "-" && next === "-") || (char === "#" && dialect === "mysql")) {
    const lineEnd = source.indexOf("\n", offset);
    return { kind: "skip", next: lineEnd === -1 ? source.length : lineEnd };
  }
  if (char === "/" && next === "*") {
    return readBlockComment(source, offset, dialect);
  }
  if (char === "*" && next === "/" && dialect === "mysql") {
    // Closes an executable comment; `*/` is never valid SQL outside one.
    return { kind: "skip", next: offset + 2 };
  }
  return readTokenAt(source, offset, dialect);
}

function depthsOf(
  token: RawToken,
  depth: number,
): readonly [token: number, after: number] {
  if (token.kind === "symbol" && token.text === "(") {
    return [depth, depth + 1];
  }
  if (token.kind === "symbol" && token.text === ")") {
    const after = Math.max(0, depth - 1);
    return [after, after];
  }
  return [depth, depth];
}

// Lexes one step at `offset`, where the parenthesis depth is `depth`.
export function lexNext(
  source: string,
  offset: number,
  dialect: SqlDialect,
  depth: number,
): Result<LexedStep, ScanFailure> {
  const step = lexAt(source, offset, dialect);
  if (step.kind === "failure") {
    return err({ offset: step.offset });
  }
  if (step.kind === "skip") {
    return ok({ next: step.next, token: null, depth });
  }
  const [tokenDepth, depthAfter] = depthsOf(step.token, depth);
  return ok({
    next: step.token.start + step.token.text.length,
    token: { ...step.token, depth: tokenDepth },
    depth: depthAfter,
  });
}

export function tokenizeSql(
  text: string,
  dialect: SqlDialect,
): Result<readonly SqlToken[], ScanFailure> {
  const tokens: SqlToken[] = [];
  let offset = 0;
  let depth = 0;
  while (offset < text.length) {
    const step = lexNext(text, offset, dialect, depth);
    if (!step.isOk) {
      return step;
    }
    if (step.value.token !== null) {
      tokens.push(step.value.token);
    }
    ({ next: offset, depth } = step.value);
  }
  return ok(tokens);
}
