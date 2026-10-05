import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type { ReferentialAction, RelationKind } from "../../model/relation.js";
import type { ImportDiagnosticCode } from "../shared/import-diagnostic-codes.js";
import type { DraftRelation } from "../shared/import-draft.js";
import type {
  PrismaAttribute,
  PrismaBlock,
  PrismaField,
  PrismaPosition,
  PrismaValue,
} from "./prisma-ast.js";

export type PrismaRelationsContext = {
  readonly provider: SqlDialect;
  readonly tableNameByModel: ReadonlyMap<string, string>;
  readonly columnNameByField: ReadonlyMap<string, ReadonlyMap<string, string>>;
};

export type PrismaRelationsResult = {
  readonly relations: readonly {
    readonly relation: DraftRelation;
    readonly codes: readonly ImportDiagnosticCode[];
  }[];
  readonly dropped: readonly {
    readonly code: ImportDiagnosticCode;
    readonly position: PrismaPosition;
  }[];
};

type ModelBlock = Extract<PrismaBlock, { readonly fields: unknown }>;
type BuiltRelation = PrismaRelationsResult["relations"][number];
type DroppedRelation = PrismaRelationsResult["dropped"][number];

const RELATION_ATTRIBUTE = "relation";
const PRISMA_ACTIONS: ReadonlyMap<string, ReferentialAction> = new Map([
  ["Cascade", "cascade"],
  ["Restrict", "restrict"],
  ["NoAction", "noAction"],
  ["SetNull", "setNull"],
  ["SetDefault", "setDefault"],
]);

function findAttribute(
  attributes: readonly PrismaAttribute[],
  name: string,
): PrismaAttribute | undefined {
  return attributes.find((attribute) => attribute.name === name);
}

function namedArgument(
  attribute: PrismaAttribute | undefined,
  name: string,
): PrismaValue | undefined {
  return attribute?.args.find((argument) => argument.name === name)?.value;
}

// `@@id([a, b])` or `@@id(fields: [a, b])`; an item may carry options, `a(sort: Desc)`.
function attributeFieldNames(attribute: PrismaAttribute): readonly string[] {
  const value =
    namedArgument(attribute, "fields") ??
    attribute.args.find((argument) => argument.name === null)?.value;
  if (value?.kind !== "array") {
    return [];
  }
  return value.items.flatMap((item) =>
    item.kind === "identifier" || item.kind === "call" ? [item.name] : [],
  );
}

// `fields:` and `references:` hold plain field names only.
function identifierList(value: PrismaValue | undefined): readonly string[] {
  if (value?.kind !== "array") {
    return [];
  }
  const names = value.items.flatMap((item) =>
    item.kind === "identifier" ? [item.name] : [],
  );
  return names.length === value.items.length ? names : [];
}

function relationName(field: PrismaField): string | null {
  const relation = findAttribute(field.attributes, RELATION_ATTRIBUTE);
  const value =
    namedArgument(relation, "name") ??
    relation?.args.find((argument) => argument.name === null)?.value;
  return value?.kind === "string" ? value.value : null;
}

function hasForeignKey(field: PrismaField): boolean {
  const relation = findAttribute(field.attributes, RELATION_ATTRIBUTE);
  return namedArgument(relation, "fields") !== undefined;
}

// The field on the other model that names the same relation without `fields`.
function findBackField(
  model: ModelBlock,
  field: PrismaField,
  target: ModelBlock,
): PrismaField | undefined {
  const name = relationName(field);
  return target.fields.find(
    (candidate) =>
      candidate !== field &&
      candidate.typeName === model.name &&
      !hasForeignKey(candidate) &&
      relationName(candidate) === name,
  );
}

function isSameSet(
  names: readonly string[],
  others: readonly string[],
): boolean {
  const set = new Set(names);
  return set.size === new Set(others).size && others.every((n) => set.has(n));
}

// Prisma requires a back relation; without one the kind follows the
// uniqueness of the foreign key fields, as for SQL (spec section 6).
function inferKind(
  model: ModelBlock,
  fieldNames: readonly string[],
): RelationKind {
  const fieldKey = model.fields
    .filter((field) => findAttribute(field.attributes, "id") !== undefined)
    .map((field) => field.name);
  const uniqueFields = model.fields
    .filter((field) => findAttribute(field.attributes, "unique") !== undefined)
    .map((field) => [field.name]);
  const blockKeys = model.blockAttributes
    .filter(
      (attribute) => attribute.name === "id" || attribute.name === "unique",
    )
    .map(attributeFieldNames);
  const isUnique = [fieldKey, ...uniqueFields, ...blockKeys].some(
    (key) => key.length > 0 && isSameSet(fieldNames, key),
  );
  return isUnique ? "oneToOne" : "oneToMany";
}

// `Model[]` on the other side is one-to-many; `Model?` is one-to-one.
function backFieldKind(backField: PrismaField): RelationKind {
  return backField.isList ? "oneToMany" : "oneToOne";
}

function defaultOnDelete(
  provider: SqlDialect,
  hasNullableField: boolean,
): ReferentialAction {
  if (hasNullableField) {
    return "setNull";
  }
  return provider === "sqlserver" ? "noAction" : "restrict";
}

function readAction(
  relation: PrismaAttribute,
  name: string,
): ReferentialAction | undefined {
  const value = namedArgument(relation, name);
  return value?.kind === "identifier"
    ? PRISMA_ACTIONS.get(value.name)
    : undefined;
}

function columnName(
  context: PrismaRelationsContext,
  modelName: string,
  fieldName: string,
): string {
  return context.columnNameByField.get(modelName)?.get(fieldName) ?? fieldName;
}

function buildRelation(
  model: ModelBlock,
  field: PrismaField,
  target: ModelBlock,
  relation: PrismaAttribute,
  context: PrismaRelationsContext,
): BuiltRelation | DroppedRelation {
  const fieldNames = identifierList(namedArgument(relation, "fields"));
  const references = identifierList(namedArgument(relation, "references"));
  if (fieldNames.length === 0 || fieldNames.length !== references.length) {
    return { code: "reference-not-found", position: relation.position };
  }
  const backField = findBackField(model, field, target);
  const hasNullableField = model.fields.some(
    (candidate) => candidate.isOptional && fieldNames.includes(candidate.name),
  );
  const kind =
    backField === undefined
      ? inferKind(model, fieldNames)
      : backFieldKind(backField);
  return {
    relation: {
      fromTableName: context.tableNameByModel.get(model.name) ?? model.name,
      toTableName: context.tableNameByModel.get(target.name) ?? target.name,
      columnPairs: fieldNames.map((name, index) => ({
        fromColumnName: columnName(context, model.name, name),
        toColumnName: columnName(context, target.name, references[index] ?? ""),
      })),
      kind,
      onDelete:
        readAction(relation, "onDelete") ??
        defaultOnDelete(context.provider, hasNullableField),
      onUpdate:
        readAction(relation, "onUpdate") ??
        (context.provider === "sqlserver" ? "noAction" : "cascade"),
      location: field.position,
    },
    codes: backField === undefined ? ["back-relation-missing"] : [],
  };
}

/**
 * Reads the relations that `@relation(fields, references)` defines (import /
 * export spec, section 6 "Quan hệ"). Relation and field names are not kept.
 */
export function buildPrismaRelations(
  blocks: readonly PrismaBlock[],
  context: PrismaRelationsContext,
): PrismaRelationsResult {
  const models = blocks.flatMap((block) =>
    block.kind === "model" ? [block] : [],
  );
  const modelsByName = new Map(models.map((model) => [model.name, model]));
  const relations: BuiltRelation[] = [];
  const dropped: DroppedRelation[] = [];
  // Both sides of an implicit many-to-many name it; it is reported once.
  const reportedFields = new Set<PrismaField>();
  for (const model of models) {
    for (const field of model.fields) {
      const target = modelsByName.get(field.typeName);
      const read =
        target === undefined || reportedFields.has(field)
          ? null
          : readRelationField(model, field, target, context, reportedFields);
      if (read !== null && "relation" in read) relations.push(read);
      else if (read !== null) dropped.push(read);
    }
  }
  return { relations, dropped };
}

// A field without `fields` is the back side of a relation read elsewhere,
// unless both sides are lists: an implicit many-to-many.
function readRelationField(
  model: ModelBlock,
  field: PrismaField,
  target: ModelBlock,
  context: PrismaRelationsContext,
  reportedFields: Set<PrismaField>,
): BuiltRelation | DroppedRelation | null {
  const relation = findAttribute(field.attributes, RELATION_ATTRIBUTE);
  if (relation !== undefined && hasForeignKey(field)) {
    return buildRelation(model, field, target, relation, context);
  }
  const backField = findBackField(model, field, target);
  if (!field.isList || backField?.isList !== true) {
    return null;
  }
  reportedFields.add(backField);
  return {
    code: "implicit-many-to-many-not-supported",
    position: field.position,
  };
}
