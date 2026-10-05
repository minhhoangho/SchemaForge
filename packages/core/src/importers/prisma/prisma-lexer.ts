import type { Result } from "../../result.js";
import { err, ok } from "../../result.js";
import type { PrismaPosition, PrismaSyntaxError } from "./prisma-ast.js";

export type PrismaTokenKind =
  | "identifier"
  | "string"
  | "number"
  | "symbol"
  | "newline"
  | "docComment"
  // Always the last token, so the parser can point at the end of the input.
  | "end";

/**
 * `text` is the decoded value for a string, the text after `///` (minus one
 * leading space) for a doc comment, and the source text otherwise.
 */
export type PrismaToken = {
  readonly kind: PrismaTokenKind;
  readonly text: string;
  readonly position: PrismaPosition;
};

type Scanned = Result<
  { readonly token: PrismaToken | null; readonly end: number },
  PrismaSyntaxError
>;

const SINGLE_SYMBOLS = "{}()[],:=?.";
const WHITESPACE = " \t\r";
const DOC_COMMENT_PREFIX = "///";
const LINE_COMMENT_PREFIX = "//";
const SIMPLE_ESCAPES: ReadonlyMap<string, string> = new Map([
  ['"', '"'],
  ["\\", "\\"],
  ["/", "/"],
  ["b", "\b"],
  ["f", "\f"],
  ["n", "\n"],
  ["r", "\r"],
  ["t", "\t"],
]);
const UNICODE_ESCAPE_DIGITS = 4;
const HEX_RADIX = 16;
const FOUR_HEX_DIGITS = /^[0-9A-Fa-f]{4}$/;

/** Single pass over the source; never throws (spec part 7, section 13). */
export function tokenizePrisma(
  source: string,
): Result<readonly PrismaToken[], PrismaSyntaxError> {
  const tokens: PrismaToken[] = [];
  let index = 0;
  let line = 1;
  let lineStart = 0;
  while (index < source.length) {
    const position = { line, column: index - lineStart + 1 };
    const scanned = scanToken(source, index, position);
    if (!scanned.isOk) return scanned;
    const { token, end } = scanned.value;
    if (token !== null) tokens.push(token);
    if (token?.kind === "newline") {
      line += 1;
      lineStart = end;
    }
    index = end;
  }
  tokens.push({
    kind: "end",
    text: "",
    position: { line, column: index - lineStart + 1 },
  });
  return ok(tokens);
}

function scanToken(
  source: string,
  index: number,
  position: PrismaPosition,
): Scanned {
  const char = source.charAt(index);
  const emit = (kind: PrismaTokenKind, text: string): Scanned =>
    ok({ token: { kind, text, position }, end: index + text.length });
  if (char === "\n") return emit("newline", char);
  if (WHITESPACE.includes(char)) return ok({ token: null, end: index + 1 });
  if (char === '"') return readString(source, index, position);
  if (char === "/") return readComment(source, index, position);
  if (char === "@") return emit("symbol", isAt(source, index + 1) ? "@@" : "@");
  if (SINGLE_SYMBOLS.includes(char)) return emit("symbol", char);
  if (isNumberStart(source, index)) {
    return emit("number", source.slice(index, numberEnd(source, index)));
  }
  if (isIdentifierStart(char)) {
    return emit(
      "identifier",
      source.slice(index, identifierEnd(source, index)),
    );
  }
  return err({ position });
}

function isAt(source: string, index: number): boolean {
  return source.charAt(index) === "@";
}

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isIdentifierStart(char: string): boolean {
  return (
    (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_"
  );
}

function identifierEnd(source: string, start: number): number {
  let index = start;
  while (index < source.length) {
    const char = source.charAt(index);
    if (!isIdentifierStart(char) && !isDigit(char)) break;
    index += 1;
  }
  return index;
}

function isNumberStart(source: string, index: number): boolean {
  const char = source.charAt(index);
  return isDigit(char) || (char === "-" && isDigit(source.charAt(index + 1)));
}

function skipDigits(source: string, start: number): number {
  let index = start;
  while (isDigit(source.charAt(index))) index += 1;
  return index;
}

/** `-?digits(.digits)?([eE][+-]?digits)?`, read without backtracking. */
function numberEnd(source: string, start: number): number {
  let index = skipDigits(
    source,
    source.charAt(start) === "-" ? start + 1 : start,
  );
  if (source.charAt(index) === "." && isDigit(source.charAt(index + 1))) {
    index = skipDigits(source, index + 1);
  }
  const marker = source.charAt(index);
  if (marker !== "e" && marker !== "E") return index;
  const sign = source.charAt(index + 1);
  const digitsStart = sign === "+" || sign === "-" ? index + 2 : index + 1;
  return isDigit(source.charAt(digitsStart))
    ? skipDigits(source, digitsStart)
    : index;
}

function readComment(
  source: string,
  index: number,
  position: PrismaPosition,
): Scanned {
  if (!source.startsWith(LINE_COMMENT_PREFIX, index)) return err({ position });
  const lineBreak = source.indexOf("\n", index);
  const end = lineBreak === -1 ? source.length : lineBreak;
  if (!source.startsWith(DOC_COMMENT_PREFIX, index)) {
    return ok({ token: null, end });
  }
  let text = source.slice(index + DOC_COMMENT_PREFIX.length, end);
  if (text.endsWith("\r")) text = text.slice(0, -1);
  if (text.startsWith(" ")) text = text.slice(1);
  return ok({ token: { kind: "docComment", text, position }, end });
}

function readString(
  source: string,
  start: number,
  position: PrismaPosition,
): Scanned {
  let value = "";
  let index = start + 1;
  while (index < source.length) {
    const char = source.charAt(index);
    if (char === '"') {
      return ok({
        token: { kind: "string", text: value, position },
        end: index + 1,
      });
    }
    if (char === "\n") break;
    if (char !== "\\") {
      value += char;
      index += 1;
      continue;
    }
    const escaped = readEscape(source, index);
    if (escaped === null) {
      return err({
        position: {
          line: position.line,
          column: position.column + index - start,
        },
      });
    }
    value += escaped.text;
    index = escaped.end;
  }
  return err({ position });
}

function readEscape(
  source: string,
  backslash: number,
): { readonly text: string; readonly end: number } | null {
  const marker = source.charAt(backslash + 1);
  const simple = SIMPLE_ESCAPES.get(marker);
  if (simple !== undefined) return { text: simple, end: backslash + 2 };
  if (marker !== "u") return null;
  const hexStart = backslash + 2;
  const hex = source.slice(hexStart, hexStart + UNICODE_ESCAPE_DIGITS);
  if (!FOUR_HEX_DIGITS.test(hex)) return null;
  return {
    text: String.fromCharCode(Number.parseInt(hex, HEX_RADIX)),
    end: hexStart + UNICODE_ESCAPE_DIGITS,
  };
}
