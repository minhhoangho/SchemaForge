import { ok } from "../../result.js";
import type {
  PrismaAttribute,
  PrismaBlock,
  PrismaEnumValue,
  PrismaField,
  PrismaPosition,
  PrismaProperty,
  PrismaSchema,
} from "./prisma-ast.js";
import { tokenizePrisma } from "./prisma-lexer.js";
import type { Cursor, Parsed } from "./prisma-parser-values.js";
import {
  advance,
  expectIdentifier,
  expectSymbol,
  fail,
  isSymbol,
  parseAttribute,
  parseFieldAttributes,
  parseValue,
  peek,
} from "./prisma-parser-values.js";

export { MAX_PRISMA_NESTING } from "./prisma-parser-values.js";

type BlockHeader = {
  readonly name: string;
  readonly docComment: string | null;
  readonly position: PrismaPosition;
};

type FieldType = Pick<
  PrismaField,
  "typeName" | "isOptional" | "isList" | "unsupportedType"
>;

const BLOCK_KINDS: ReadonlyMap<string, PrismaBlock["kind"]> = new Map([
  ["datasource", "datasource"],
  ["generator", "generator"],
  ["model", "model"],
  ["view", "view"],
  ["type", "type"],
  ["enum", "enum"],
]);
const UNSUPPORTED_TYPE = "Unsupported";

/**
 * Recursive-descent parser for the Prisma schema subset the importer reads
 * (spec part 7, section 6). Stops at the first unexpected token without
 * recovering; never throws on any input.
 */
export function parsePrismaSchema(source: string): Parsed<PrismaSchema> {
  const tokens = tokenizePrisma(source);
  if (!tokens.isOk) return tokens;
  const cursor: Cursor = { tokens: tokens.value, index: 0 };
  const blocks: PrismaBlock[] = [];
  let docComment = readLeadingDocComment(cursor);
  while (peek(cursor).kind !== "end") {
    const block = parseBlock(cursor, docComment);
    if (!block.isOk) return block;
    blocks.push(block.value);
    const lineEnd = peek(cursor);
    if (lineEnd.kind !== "newline" && lineEnd.kind !== "end") {
      return fail(lineEnd);
    }
    docComment = readLeadingDocComment(cursor);
  }
  return ok({ blocks });
}

/**
 * Collects the `///` lines right before an element; a blank line between
 * them and the element detaches them.
 */
function readLeadingDocComment(cursor: Cursor): string | null {
  let lines: string[] = [];
  let isAfterLineBreak = false;
  for (let token = peek(cursor); ; token = peek(cursor)) {
    if (token.kind === "docComment") {
      lines.push(token.text);
      isAfterLineBreak = false;
    } else if (token.kind === "newline") {
      if (isAfterLineBreak) lines = [];
      isAfterLineBreak = true;
    } else {
      return lines.length === 0 ? null : lines.join("\n");
    }
    advance(cursor);
  }
}

function readTrailingDocComment(cursor: Cursor): string | null {
  const token = peek(cursor);
  return token.kind === "docComment" ? advance(cursor).text : null;
}

function joinDocComments(
  leading: string | null,
  trailing: string | null,
): string | null {
  if (leading === null) return trailing;
  return trailing === null ? leading : `${leading}\n${trailing}`;
}

function parseBlock(
  cursor: Cursor,
  docComment: string | null,
): Parsed<PrismaBlock> {
  const keyword = peek(cursor);
  const kind =
    keyword.kind === "identifier" ? BLOCK_KINDS.get(keyword.text) : undefined;
  if (kind === undefined) return fail(keyword);
  advance(cursor);
  const name = expectIdentifier(cursor);
  if (!name.isOk) return name;
  const open = expectSymbol(cursor, "{");
  if (!open.isOk) return open;
  const header = {
    name: name.value.text,
    docComment,
    position: keyword.position,
  };
  switch (kind) {
    case "datasource":
    case "generator":
      return parseConfigBlock(cursor, kind, header);
    case "model":
    case "view":
    case "type":
      return parseModelBlock(cursor, kind, header);
    case "enum":
      return parseEnumBlock(cursor, header);
    default: {
      const unreachable: never = kind;
      throw new Error(`Unhandled Prisma block kind: ${String(unreachable)}`);
    }
  }
}

/** Parses entries line by line up to and including the closing brace. */
function parseBody(
  cursor: Cursor,
  parseEntry: (docComment: string | null) => Parsed<null>,
): Parsed<null> {
  let docComment = readLeadingDocComment(cursor);
  while (!isSymbol(peek(cursor), "}")) {
    const entry = parseEntry(docComment);
    if (!entry.isOk) return entry;
    // A trailing `///` after a block attribute or property documents nothing.
    readTrailingDocComment(cursor);
    const lineEnd = peek(cursor);
    if (lineEnd.kind !== "newline" && !isSymbol(lineEnd, "}")) {
      return fail(lineEnd);
    }
    docComment = readLeadingDocComment(cursor);
  }
  advance(cursor);
  return ok(null);
}

function pushTo<T>(parsed: Parsed<T>, target: T[]): Parsed<null> {
  if (!parsed.isOk) return parsed;
  target.push(parsed.value);
  return ok(null);
}

function parseConfigBlock(
  cursor: Cursor,
  kind: "datasource" | "generator",
  header: BlockHeader,
): Parsed<PrismaBlock> {
  const properties: PrismaProperty[] = [];
  const body = parseBody(cursor, () =>
    pushTo(parseProperty(cursor), properties),
  );
  if (!body.isOk) return body;
  return ok({ kind, name: header.name, properties, position: header.position });
}

function parseModelBlock(
  cursor: Cursor,
  kind: "model" | "view" | "type",
  header: BlockHeader,
): Parsed<PrismaBlock> {
  const fields: PrismaField[] = [];
  const blockAttributes: PrismaAttribute[] = [];
  const body = parseBody(cursor, (docComment) =>
    isSymbol(peek(cursor), "@@")
      ? pushTo(parseAttribute(cursor), blockAttributes)
      : pushTo(parseField(cursor, docComment), fields),
  );
  if (!body.isOk) return body;
  return ok({ kind, ...header, fields, blockAttributes });
}

function parseEnumBlock(
  cursor: Cursor,
  header: BlockHeader,
): Parsed<PrismaBlock> {
  const values: PrismaEnumValue[] = [];
  const blockAttributes: PrismaAttribute[] = [];
  const body = parseBody(cursor, (docComment) =>
    isSymbol(peek(cursor), "@@")
      ? pushTo(parseAttribute(cursor), blockAttributes)
      : pushTo(parseEnumValue(cursor, docComment), values),
  );
  if (!body.isOk) return body;
  return ok({ kind: "enum", ...header, values, blockAttributes });
}

function parseProperty(cursor: Cursor): Parsed<PrismaProperty> {
  const name = expectIdentifier(cursor);
  if (!name.isOk) return name;
  const equals = expectSymbol(cursor, "=");
  if (!equals.isOk) return equals;
  const value = parseValue(cursor, 0);
  if (!value.isOk) return value;
  return ok({
    name: name.value.text,
    value: value.value,
    position: name.value.position,
  });
}

function parseField(
  cursor: Cursor,
  docComment: string | null,
): Parsed<PrismaField> {
  const name = expectIdentifier(cursor);
  if (!name.isOk) return name;
  const type = parseFieldType(cursor);
  if (!type.isOk) return type;
  const attributes = parseFieldAttributes(cursor);
  if (!attributes.isOk) return attributes;
  return ok({
    name: name.value.text,
    ...type.value,
    attributes: attributes.value,
    docComment: joinDocComments(docComment, readTrailingDocComment(cursor)),
    position: name.value.position,
  });
}

function parseFieldType(cursor: Cursor): Parsed<FieldType> {
  const type = expectIdentifier(cursor);
  if (!type.isOk) return type;
  let unsupportedType: string | null = null;
  if (type.value.text === UNSUPPORTED_TYPE) {
    const open = expectSymbol(cursor, "(");
    if (!open.isOk) return open;
    const text = peek(cursor);
    if (text.kind !== "string") return fail(text);
    unsupportedType = advance(cursor).text;
    const close = expectSymbol(cursor, ")");
    if (!close.isOk) return close;
  }
  const modifier = { typeName: type.value.text, unsupportedType };
  if (isSymbol(peek(cursor), "?")) {
    advance(cursor);
    return ok({ ...modifier, isOptional: true, isList: false });
  }
  if (!isSymbol(peek(cursor), "[")) {
    return ok({ ...modifier, isOptional: false, isList: false });
  }
  advance(cursor);
  const close = expectSymbol(cursor, "]");
  if (!close.isOk) return close;
  return ok({ ...modifier, isOptional: false, isList: true });
}

function parseEnumValue(
  cursor: Cursor,
  docComment: string | null,
): Parsed<PrismaEnumValue> {
  const name = expectIdentifier(cursor);
  if (!name.isOk) return name;
  const attributes = parseFieldAttributes(cursor);
  if (!attributes.isOk) return attributes;
  return ok({
    name: name.value.text,
    attributes: attributes.value,
    docComment: joinDocComments(docComment, readTrailingDocComment(cursor)),
    position: name.value.position,
  });
}
