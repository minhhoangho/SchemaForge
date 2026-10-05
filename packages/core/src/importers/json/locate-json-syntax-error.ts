import { err, ok } from "../../result.js";
import type { Result } from "../../result.js";
import type { SourceLocation } from "../shared/import-types.js";
import {
  createLineStarts,
  toSourceLocation,
} from "../shared/source-location.js";

type Bracket = "{" | "[";

// What the grammar allows at the next non-whitespace character.
type Expectation =
  | "value"
  | "value-or-close"
  | "key"
  | "key-or-close"
  | "colon"
  | "comma-or-close"
  | "end";

type TokenKind =
  "open-object" | "open-array" | "close" | "scalar" | "key" | "colon" | "comma";

type Token = { readonly kind: TokenKind; readonly end: number };

// Ok carries the offset right after the scanned text, error the offset of the
// first invalid character (the source length when the text ends early).
type Scan = Result<number, number>;

const WHITESPACE = new Set([" ", "\t", "\n", "\r"]);
const SIMPLE_ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t"]);
const HEX_DIGITS = new Set("0123456789abcdefABCDEF");
const DIGITS = new Set("0123456789");
const LITERALS = new Map([
  ["t", "true"],
  ["f", "false"],
  ["n", "null"],
]);
const UNICODE_ESCAPE_DIGITS = 4;
const FIRST_NON_CONTROL_CODE = 0x20;

function skipWhitespace(source: string, offset: number): number {
  let index = offset;
  while (WHITESPACE.has(source.charAt(index))) {
    index += 1;
  }
  return index;
}

function skipDigits(source: string, offset: number): number {
  let index = offset;
  while (DIGITS.has(source.charAt(index))) {
    index += 1;
  }
  return index;
}

// One or more digits.
function scanDigits(source: string, offset: number): Scan {
  const end = skipDigits(source, offset);
  return end === offset ? err(offset) : ok(end);
}

// `offset` points at the backslash.
function scanEscape(source: string, offset: number): Scan {
  const escaped = source.charAt(offset + 1);
  if (SIMPLE_ESCAPES.has(escaped)) {
    return ok(offset + 2);
  }
  if (escaped !== "u") {
    return err(offset + 1);
  }
  const firstDigit = offset + 2;
  for (
    let index = firstDigit;
    index < firstDigit + UNICODE_ESCAPE_DIGITS;
    index += 1
  ) {
    if (!HEX_DIGITS.has(source.charAt(index))) {
      return err(index);
    }
  }
  return ok(firstDigit + UNICODE_ESCAPE_DIGITS);
}

// `offset` points at the opening quote.
function scanString(source: string, offset: number): Scan {
  let index = offset + 1;
  while (index < source.length) {
    const character = source.charAt(index);
    if (character === '"') {
      return ok(index + 1);
    }
    if (character.charCodeAt(0) < FIRST_NON_CONTROL_CODE) {
      return err(index);
    }
    if (character !== "\\") {
      index += 1;
      continue;
    }
    const escape = scanEscape(source, index);
    if (!escape.isOk) {
      return escape;
    }
    index = escape.value;
  }
  return err(source.length);
}

function scanNumber(source: string, offset: number): Scan {
  const integerStart = source.charAt(offset) === "-" ? offset + 1 : offset;
  const integer =
    source.charAt(integerStart) === "0"
      ? ok(integerStart + 1)
      : scanDigits(source, integerStart);
  if (!integer.isOk) {
    return integer;
  }
  let index = integer.value;
  if (source.charAt(index) === ".") {
    const fraction = scanDigits(source, index + 1);
    if (!fraction.isOk) {
      return fraction;
    }
    index = fraction.value;
  }
  if (source.charAt(index) !== "e" && source.charAt(index) !== "E") {
    return ok(index);
  }
  const sign = source.charAt(index + 1);
  return scanDigits(
    source,
    sign === "+" || sign === "-" ? index + 2 : index + 1,
  );
}

function scanLiteral(source: string, offset: number, literal: string): Scan {
  for (let index = 0; index < literal.length; index += 1) {
    if (source.charAt(offset + index) !== literal.charAt(index)) {
      return err(offset + index);
    }
  }
  return ok(offset + literal.length);
}

function toToken(scan: Scan, kind: TokenKind): Result<Token, number> {
  return scan.isOk ? ok({ kind, end: scan.value }) : scan;
}

function readValue(source: string, offset: number): Result<Token, number> {
  const character = source.charAt(offset);
  const literal = LITERALS.get(character);
  if (character === "{") {
    return ok({ kind: "open-object", end: offset + 1 });
  }
  if (character === "[") {
    return ok({ kind: "open-array", end: offset + 1 });
  }
  if (character === '"') {
    return toToken(scanString(source, offset), "scalar");
  }
  if (character === "-" || DIGITS.has(character)) {
    return toToken(scanNumber(source, offset), "scalar");
  }
  return literal === undefined
    ? err(offset)
    : toToken(scanLiteral(source, offset, literal), "scalar");
}

function readToken(
  source: string,
  offset: number,
  expectation: Expectation,
  closing: string,
): Result<Token, number> {
  const character = source.charAt(offset);
  const canClose =
    expectation === "comma-or-close" ||
    expectation === "value-or-close" ||
    expectation === "key-or-close";
  if (canClose && character === closing) {
    return ok({ kind: "close", end: offset + 1 });
  }
  switch (expectation) {
    case "value":
    case "value-or-close":
      return readValue(source, offset);
    case "key":
    case "key-or-close":
      return character === '"'
        ? toToken(scanString(source, offset), "key")
        : err(offset);
    case "colon":
      return character === ":"
        ? ok({ kind: "colon", end: offset + 1 })
        : err(offset);
    case "comma-or-close":
      return character === ","
        ? ok({ kind: "comma", end: offset + 1 })
        : err(offset);
    case "end":
      return err(offset);
  }
}

function toClosing(bracket: Bracket | undefined): string {
  return bracket === "{" ? "}" : "]";
}

// A single pass with an explicit bracket stack, so nesting depth never
// touches the call stack. Returns the error offset, or null for valid JSON.
function findErrorOffset(source: string): number | null {
  const brackets: Bracket[] = [];
  let expectation: Expectation = "value";
  let offset = skipWhitespace(source, 0);
  while (offset < source.length) {
    const token = readToken(
      source,
      offset,
      expectation,
      toClosing(brackets.at(-1)),
    );
    if (!token.isOk) {
      return token.error;
    }
    const { kind, end } = token.value;
    if (kind === "open-object" || kind === "open-array") {
      brackets.push(kind === "open-object" ? "{" : "[");
      expectation = kind === "open-object" ? "key-or-close" : "value-or-close";
    } else if (kind === "close" || kind === "scalar") {
      if (kind === "close") {
        brackets.pop();
      }
      expectation = brackets.length === 0 ? "end" : "comma-or-close";
    } else {
      expectation = nextAfterSeparator(kind, brackets.at(-1));
    }
    offset = skipWhitespace(source, end);
  }
  return expectation === "end" ? null : source.length;
}

function nextAfterSeparator(
  kind: "key" | "colon" | "comma",
  bracket: Bracket | undefined,
): Expectation {
  if (kind === "key") {
    return "colon";
  }
  return kind === "comma" && bracket === "{" ? "key" : "value";
}

/**
 * Finds the first character that breaks the JSON grammar (RFC 8259), or the
 * position right after the last character when the text ends early. Returns
 * null when the text is valid JSON. Never reads a `SyntaxError` message,
 * whose format differs between engines.
 */
export function locateJsonSyntaxError(source: string): SourceLocation | null {
  const offset = findErrorOffset(source);
  return offset === null
    ? null
    : toSourceLocation(createLineStarts(source), offset);
}
