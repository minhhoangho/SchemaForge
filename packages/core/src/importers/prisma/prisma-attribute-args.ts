import type { PrismaAttribute, PrismaValue } from "./prisma-ast.js";

export function findAttribute(
  attributes: readonly PrismaAttribute[],
  name: string,
): PrismaAttribute | undefined {
  return attributes.find((attribute) => attribute.name === name);
}

/** The first positional argument, else the argument named `name`. */
function mainArgument(
  attribute: PrismaAttribute,
  name: string,
): PrismaValue | undefined {
  return (
    attribute.args.find((argument) => argument.name === null)?.value ??
    attribute.args.find((argument) => argument.name === name)?.value
  );
}

/** The database name given by `@map("x")` or `@@map("x")`, else `fallback`. */
export function mappedName(
  attributes: readonly PrismaAttribute[],
  fallback: string,
): string {
  const map = findAttribute(attributes, "map");
  const value = map === undefined ? undefined : mainArgument(map, "name");
  return value?.kind === "string" ? value.value : fallback;
}

/** The `map:` argument of `@@unique` or `@@index`: the database index name. */
export function constraintName(attribute: PrismaAttribute): string | null {
  const value = attribute.args.find(
    (argument) => argument.name === "map",
  )?.value;
  return value?.kind === "string" ? value.value : null;
}

export type FieldList = {
  readonly fieldNames: readonly string[];
  // An item such as `a(sort: Desc)` carries per-field options.
  readonly hasItemOptions: boolean;
};

/**
 * The fields of `@@id([a, b])`, `@@unique(fields: [a])` and the like; null
 * when the list is missing, empty or holds something other than field names.
 */
export function readFieldList(attribute: PrismaAttribute): FieldList | null {
  const value = mainArgument(attribute, "fields");
  if (value?.kind !== "array" || value.items.length === 0) {
    return null;
  }
  const fieldNames = value.items.flatMap((item) =>
    item.kind === "identifier" || item.kind === "call" ? [item.name] : [],
  );
  if (fieldNames.length !== value.items.length) {
    return null;
  }
  return {
    fieldNames,
    hasItemOptions: value.items.some(
      (item) => item.kind === "call" && item.args.length > 0,
    ),
  };
}

/** True when a named argument other than `kept` is present, such as `sort:`. */
export function hasNamedOption(
  attribute: PrismaAttribute,
  kept: ReadonlySet<string>,
): boolean {
  return attribute.args.some(
    (argument) => argument.name !== null && !kept.has(argument.name),
  );
}
