import {
  createImplicitForeignKeyIndexCheck,
  type ForeignKeyColumns,
  type ImplicitForeignKeyIndexCheck,
} from "../shared/implicit-foreign-key-index.js";
import type { ImportDiagnosticCode } from "../shared/import-diagnostic-codes.js";
import type {
  DraftDiagnostic,
  DraftIndex,
  DraftTable,
  DraftTarget,
} from "../shared/import-draft.js";
import type { PrismaAttribute, PrismaField } from "./prisma-ast.js";
import {
  constraintName,
  findAttribute,
  hasNamedOption,
  readFieldList,
  type FieldList,
} from "./prisma-attribute-args.js";

/** What the indexes of one `model` block are read from. */
export type IndexContext = {
  readonly fields: readonly PrismaField[];
  readonly blockAttributes: readonly PrismaAttribute[];
  readonly isMysql: boolean;
  readonly firstIndex: number;
  readonly columnNameOf: (fieldName: string) => string;
  readonly diagnostics: DraftDiagnostic[];
};

export type IndexedTable = Pick<
  DraftTable,
  "name" | "columns" | "primaryKeyColumnNames"
>;

type IndexKind = {
  readonly isUnique: boolean;
  readonly codes: readonly ImportDiagnosticCode[];
};

type IndexAttribute = {
  readonly attribute: PrismaAttribute;
  readonly kind: IndexKind;
  readonly list: FieldList | null;
};

// `map:` names a constraint and `name:` the Prisma Client accessor; neither
// has a place in the model, and dropping them loses no structure.
const BLOCK_KEY_ARGUMENTS: ReadonlySet<string> = new Set([
  "fields",
  "name",
  "map",
]);
const INDEX_KINDS: ReadonlyMap<string, IndexKind> = new Map([
  ["unique", { isUnique: true, codes: [] }],
  ["index", { isUnique: false, codes: [] }],
  ["fulltext", { isUnique: false, codes: ["index-type-dropped"] }],
]);

/** Whether `@@id`, `@@unique` or `@@index` carries an option the model drops. */
export function hasDroppedOptions(
  attribute: PrismaAttribute,
  list: FieldList,
): boolean {
  return list.hasItemOptions || hasNamedOption(attribute, BLOCK_KEY_ARGUMENTS);
}

// MySQL names the index it creates for a foreign key after the constraint:
// `map` of @relation, else Prisma's default `<table>_<columns>_fkey`, which
// `prisma db pull` leaves out (spec section 6, `@@index(map:)`).
function readForeignKeys(
  context: IndexContext,
  tableName: string,
): readonly ForeignKeyColumns[] {
  if (!context.isMysql) {
    return [];
  }
  return context.fields.flatMap((field) => {
    const relation = findAttribute(field.attributes, "relation");
    const value = relation?.args.find(({ name }) => name === "fields")?.value;
    const items = value?.kind === "array" ? value.items : [];
    const columnNames = items.flatMap((item) =>
      item.kind === "identifier" ? [context.columnNameOf(item.name)] : [],
    );
    // A back relation field has no `fields`, so no foreign key of its own.
    if (
      relation === undefined ||
      items.length === 0 ||
      columnNames.length !== items.length
    ) {
      return [];
    }
    const defaultName = `${tableName}_${columnNames.join("_")}_fkey`;
    return [{ name: constraintName(relation) ?? defaultName, columnNames }];
  });
}

function readIndexAttributes(
  attributes: readonly PrismaAttribute[],
): readonly IndexAttribute[] {
  return attributes.flatMap((attribute): IndexAttribute[] => {
    const kind = INDEX_KINDS.get(attribute.name);
    return kind === undefined
      ? []
      : [{ attribute, kind, list: readFieldList(attribute) }];
  });
}

// The keys of the table: its primary key, unique columns and every index.
function createIndexCheck(
  context: IndexContext,
  table: IndexedTable,
  attributes: readonly IndexAttribute[],
): ImplicitForeignKeyIndexCheck {
  return createImplicitForeignKeyIndexCheck(
    readForeignKeys(context, table.name),
    () => [
      table.primaryKeyColumnNames,
      ...table.columns
        .filter(({ isUnique }) => isUnique)
        .map(({ name }) => [name]),
      ...attributes.flatMap(({ list }) =>
        list === null
          ? []
          : [list.fieldNames.map((name) => context.columnNameOf(name))],
      ),
    ],
  );
}

type ReadIndex = {
  readonly index: DraftIndex;
  readonly codes: readonly ImportDiagnosticCode[];
};

// The index of one attribute with a field list; null when it is the index
// MySQL creates for a foreign key. The database creates that one with no
// option, so an index with one is the user's.
function readIndex(
  context: IndexContext,
  tableName: string,
  { attribute, kind, list }: IndexAttribute & { readonly list: FieldList },
  isImplicitForeignKeyIndex: ImplicitForeignKeyIndexCheck,
): ReadIndex | null {
  const name = constraintName(attribute);
  const columnNames = list.fieldNames.map((field) =>
    context.columnNameOf(field),
  );
  const hasOptions = hasDroppedOptions(attribute, list);
  if (
    attribute.name === "index" &&
    !hasOptions &&
    isImplicitForeignKeyIndex(name, columnNames)
  ) {
    return null;
  }
  return {
    index: {
      tableName,
      name,
      columnNames,
      isUnique: kind.isUnique,
      location: attribute.position,
    },
    codes: hasOptions ? [...kind.codes, "index-option-dropped"] : kind.codes,
  };
}

/**
 * The `@@unique`, `@@index` and `@@fulltext` of a model (spec section 6). All
 * are read before the first diagnostic, so the target of an index kept after
 * a dropped one is its position among the kept ones.
 */
export function buildIndexes(
  context: IndexContext,
  table: IndexedTable,
): readonly DraftIndex[] {
  const attributes = readIndexAttributes(context.blockAttributes);
  const isImplicit = createIndexCheck(context, table, attributes);
  const indexes: DraftIndex[] = [];
  for (const entry of attributes) {
    const location = entry.attribute.position;
    if (entry.list === null) {
      context.diagnostics.push({
        code: "reference-not-found",
        location,
        target: null,
      });
      continue;
    }
    const read = readIndex(
      context,
      table.name,
      { ...entry, list: entry.list },
      isImplicit,
    );
    if (read === null) {
      continue;
    }
    const target: DraftTarget = {
      kind: "index",
      index: context.firstIndex + indexes.length,
    };
    read.codes.forEach((code) => {
      context.diagnostics.push({ code, location, target });
    });
    indexes.push(read.index);
  }
  return indexes;
}
