import type { Result } from "../../result.js";
import { err, ok } from "../../result.js";
import type {
  PrismaArgument,
  PrismaAttribute,
  PrismaSyntaxError,
  PrismaValue,
} from "./prisma-ast.js";
import type { PrismaToken } from "./prisma-lexer.js";

/** Deepest bracket nesting inside one attribute or property (spec section 13). */
export const MAX_PRISMA_NESTING = 32;

export type Parsed<T> = Result<T, PrismaSyntaxError>;

/** The parser owns this cursor for one call only; nothing outlives the call. */
export type Cursor = { readonly tokens: readonly PrismaToken[]; index: number };

export function peek(cursor: Cursor): PrismaToken {
  const token = cursor.tokens[cursor.index];
  if (token === undefined) {
    throw new Error("The Prisma parser moved past the end token");
  }
  return token;
}

export function advance(cursor: Cursor): PrismaToken {
  const token = peek(cursor);
  // The end token is never consumed, so `peek` always has a token to return.
  if (token.kind !== "end") cursor.index += 1;
  return token;
}

export function fail(token: PrismaToken): Parsed<never> {
  return err({ position: token.position });
}

export function isSymbol(token: PrismaToken, text: string): boolean {
  return token.kind === "symbol" && token.text === text;
}

export function expectSymbol(
  cursor: Cursor,
  text: string,
): Parsed<PrismaToken> {
  const token = peek(cursor);
  return isSymbol(token, text) ? ok(advance(cursor)) : fail(token);
}

export function expectIdentifier(cursor: Cursor): Parsed<PrismaToken> {
  const token = peek(cursor);
  return token.kind === "identifier" ? ok(advance(cursor)) : fail(token);
}

export function parseFieldAttributes(
  cursor: Cursor,
): Parsed<readonly PrismaAttribute[]> {
  const attributes: PrismaAttribute[] = [];
  while (isSymbol(peek(cursor), "@")) {
    const attribute = parseAttribute(cursor);
    if (!attribute.isOk) return attribute;
    attributes.push(attribute.value);
  }
  return ok(attributes);
}

/** `@name(…)` or `@@name(…)`; the caller has checked the prefix symbol. */
export function parseAttribute(cursor: Cursor): Parsed<PrismaAttribute> {
  const prefix = advance(cursor);
  const name = parseDottedName(cursor);
  if (!name.isOk) return name;
  if (!isSymbol(peek(cursor), "(")) {
    return ok({ name: name.value, args: [], position: prefix.position });
  }
  const args = parseArguments(cursor, 1);
  if (!args.isOk) return args;
  return ok({ name: name.value, args: args.value, position: prefix.position });
}

function parseDottedName(cursor: Cursor): Parsed<string> {
  const first = expectIdentifier(cursor);
  if (!first.isOk) return first;
  let name = first.value.text;
  while (isSymbol(peek(cursor), ".")) {
    advance(cursor);
    const part = expectIdentifier(cursor);
    if (!part.isOk) return part;
    name = `${name}.${part.value.text}`;
  }
  return ok(name);
}

export function parseValue(cursor: Cursor, depth: number): Parsed<PrismaValue> {
  const token = peek(cursor);
  const { position } = token;
  if (token.kind === "string") {
    advance(cursor);
    return ok({ kind: "string", value: token.text, position });
  }
  if (token.kind === "number") {
    advance(cursor);
    return ok({ kind: "number", text: token.text, position });
  }
  if (isSymbol(token, "[")) {
    if (depth >= MAX_PRISMA_NESTING) return fail(token);
    advance(cursor);
    const items = parseList(cursor, "]", () => parseValue(cursor, depth + 1));
    if (!items.isOk) return items;
    return ok({ kind: "array", items: items.value, position });
  }
  if (token.kind !== "identifier") return fail(token);
  const name = parseDottedName(cursor);
  if (!name.isOk) return name;
  if (!isSymbol(peek(cursor), "(")) {
    return ok({ kind: "identifier", name: name.value, position });
  }
  const args = parseArguments(cursor, depth + 1);
  if (!args.isOk) return args;
  return ok({ kind: "call", name: name.value, args: args.value, position });
}

/** `depth` counts the opening parenthesis this call is about to read. */
function parseArguments(
  cursor: Cursor,
  depth: number,
): Parsed<readonly PrismaArgument[]> {
  const open = peek(cursor);
  if (depth > MAX_PRISMA_NESTING) return fail(open);
  advance(cursor);
  return parseList(cursor, ")", () => parseArgument(cursor, depth));
}

function parseArgument(cursor: Cursor, depth: number): Parsed<PrismaArgument> {
  const first = peek(cursor);
  const next = cursor.tokens[cursor.index + 1];
  const isNamed =
    first.kind === "identifier" && next !== undefined && isSymbol(next, ":");
  if (isNamed) {
    advance(cursor);
    advance(cursor);
  }
  const value = parseValue(cursor, depth);
  if (!value.isOk) return value;
  return ok({
    name: isNamed ? first.text : null,
    value: value.value,
    position: first.position,
  });
}

/** Comma-separated items up to `close`; line breaks and a trailing comma are allowed. */
function parseList<T>(
  cursor: Cursor,
  close: string,
  parseItem: () => Parsed<T>,
): Parsed<readonly T[]> {
  const items: T[] = [];
  skipLineBreaks(cursor);
  while (!isSymbol(peek(cursor), close)) {
    const item = parseItem();
    if (!item.isOk) return item;
    items.push(item.value);
    skipLineBreaks(cursor);
    if (!isSymbol(peek(cursor), ",")) break;
    advance(cursor);
    skipLineBreaks(cursor);
  }
  const closing = expectSymbol(cursor, close);
  if (!closing.isOk) return closing;
  return ok(items);
}

function skipLineBreaks(cursor: Cursor): void {
  for (
    let token = peek(cursor);
    token.kind === "newline" || token.kind === "docComment";
    token = peek(cursor)
  ) {
    advance(cursor);
  }
}
