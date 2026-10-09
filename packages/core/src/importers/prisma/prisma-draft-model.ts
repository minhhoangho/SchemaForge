import type { ImportDiagnosticCode } from "../shared/import-diagnostic-codes.js";
import type {
  DraftColumn,
  DraftDiagnostic,
  DraftIndex,
  DraftTable,
  DraftTarget,
} from "../shared/import-draft.js";
import type { PrismaBlock, PrismaField, PrismaPosition } from "./prisma-ast.js";
import {
  findAttribute,
  hasNamedOption,
  readFieldList,
} from "./prisma-attribute-args.js";
import { buildIndexes, hasDroppedOptions } from "./prisma-draft-indexes.js";
import {
  mapPrismaScalarField,
  type PrismaFieldContext,
} from "./prisma-type-mapping.js";

export type ModelBlock = Extract<PrismaBlock, { readonly fields: unknown }>;

/** Names after `@@map` and `@map`, keyed by Prisma name (spec section 6). */
export type PrismaDraftNames = PrismaFieldContext & {
  readonly modelNames: ReadonlySet<string>;
  readonly compositeTypeNames: ReadonlySet<string>;
  readonly tableNameByModel: ReadonlyMap<string, string>;
  readonly columnNameByField: ReadonlyMap<string, ReadonlyMap<string, string>>;
};

export type ModelDraft = {
  readonly table: DraftTable;
  readonly indexes: readonly DraftIndex[];
  readonly diagnostics: readonly DraftDiagnostic[];
};

/** Where the model's table and its first index land in the draft arrays. */
export type ModelPlacement = {
  readonly tableIndex: number;
  readonly firstIndex: number;
};

type ModelContext = ModelPlacement & {
  readonly model: ModelBlock;
  readonly names: PrismaDraftNames;
  readonly diagnostics: DraftDiagnostic[];
};

// `map:` names a constraint; it has no place in the model, and dropping it
// loses no structure.
const KEY_ARGUMENTS: ReadonlySet<string> = new Set(["map"]);
const PRIMARY_KEY_FIELD = "primaryKeyColumnIds";

function report(
  context: ModelContext,
  code: ImportDiagnosticCode,
  location: PrismaPosition,
  target: DraftTarget | null,
): void {
  context.diagnostics.push({ code, location, target });
}

function columnNameOf(context: ModelContext, fieldName: string): string {
  return (
    context.names.columnNameByField.get(context.model.name)?.get(fieldName) ??
    fieldName
  );
}

function columnTarget(
  context: ModelContext,
  columnIndex: number,
  field: string | null,
): DraftTarget {
  const target: DraftTarget = {
    kind: "column",
    tableIndex: context.tableIndex,
    columnIndex,
  };
  return field === null ? target : { ...target, field };
}

function reportFieldAttributes(
  context: ModelContext,
  field: PrismaField,
  columnIndex: number,
): void {
  const id = findAttribute(field.attributes, "id");
  if (id !== undefined && hasNamedOption(id, KEY_ARGUMENTS)) {
    report(context, "index-option-dropped", id.position, {
      kind: "table",
      tableIndex: context.tableIndex,
      field: PRIMARY_KEY_FIELD,
    });
  }
  const unique = findAttribute(field.attributes, "unique");
  if (unique !== undefined && hasNamedOption(unique, KEY_ARGUMENTS)) {
    report(
      context,
      "index-option-dropped",
      unique.position,
      columnTarget(context, columnIndex, "isUnique"),
    );
  }
  const updatedAt = findAttribute(field.attributes, "updatedAt");
  if (updatedAt !== undefined) {
    report(
      context,
      "updated-at-not-supported",
      updatedAt.position,
      columnTarget(context, columnIndex, null),
    );
  }
}

function buildColumn(
  context: ModelContext,
  field: PrismaField,
  columnIndex: number,
): DraftColumn {
  const mapping = mapPrismaScalarField(field, context.names);
  for (const diagnostic of mapping.diagnostics) {
    report(
      context,
      diagnostic.code,
      diagnostic.position,
      columnTarget(context, columnIndex, diagnostic.field),
    );
  }
  reportFieldAttributes(context, field, columnIndex);
  return {
    name: columnNameOf(context, field.name),
    type: mapping.type,
    isNullable: field.isOptional,
    isUnique: findAttribute(field.attributes, "unique") !== undefined,
    isAutoIncrement: mapping.isAutoIncrement,
    defaultValue: mapping.defaultValue,
    comment: field.docComment ?? "",
    location: field.position,
  };
}

// Relation fields are read by buildPrismaRelations; a composite type field has
// no column to become.
function columnFields(context: ModelContext): readonly PrismaField[] {
  const { names } = context;
  return context.model.fields.filter((field) => {
    if (names.compositeTypeNames.has(field.typeName)) {
      report(context, "composite-type-not-supported", field.position, null);
      return false;
    }
    return !names.modelNames.has(field.typeName);
  });
}

function readPrimaryKey(
  context: ModelContext,
  fields: readonly PrismaField[],
): readonly string[] {
  const keyFields = fields.filter(
    (field) => findAttribute(field.attributes, "id") !== undefined,
  );
  if (keyFields.length > 0) {
    return keyFields.map((field) => columnNameOf(context, field.name));
  }
  const id = findAttribute(context.model.blockAttributes, "id");
  if (id === undefined) {
    return [];
  }
  const list = readFieldList(id);
  if (list === null) {
    report(context, "reference-not-found", id.position, null);
    return [];
  }
  if (hasDroppedOptions(id, list)) {
    report(context, "index-option-dropped", id.position, {
      kind: "table",
      tableIndex: context.tableIndex,
      field: PRIMARY_KEY_FIELD,
    });
  }
  return list.fieldNames.map((name) => columnNameOf(context, name));
}

function reportNamespace(context: ModelContext): void {
  const schema = findAttribute(context.model.blockAttributes, "schema");
  if (schema !== undefined) {
    report(context, "namespace-dropped", schema.position, {
      kind: "table",
      tableIndex: context.tableIndex,
    });
  }
}

/**
 * The table, columns, key and indexes of one `model` block (spec section 6
 * "Tên, kiểu, thuộc tính"). `@@ignore` and `@ignore` are ignored: the table
 * and column still exist in the database.
 */
export function buildModelDraft(
  model: ModelBlock,
  names: PrismaDraftNames,
  placement: ModelPlacement,
): ModelDraft {
  const context: ModelContext = { ...placement, model, names, diagnostics: [] };
  const tableName = names.tableNameByModel.get(model.name) ?? model.name;
  const fields = columnFields(context);
  const columns = fields.map((field, columnIndex) =>
    buildColumn(context, field, columnIndex),
  );
  const primaryKeyColumnNames = readPrimaryKey(context, fields);
  reportNamespace(context);
  const indexes = buildIndexes(
    {
      fields: model.fields,
      blockAttributes: model.blockAttributes,
      isMysql: names.provider === "mysql",
      firstIndex: placement.firstIndex,
      columnNameOf: (fieldName) => columnNameOf(context, fieldName),
      diagnostics: context.diagnostics,
    },
    { name: tableName, columns, primaryKeyColumnNames },
  );
  return {
    table: {
      name: tableName,
      comment: model.docComment ?? "",
      subjectAreaName: null,
      columns,
      primaryKeyColumnNames,
      location: model.position,
    },
    indexes,
    diagnostics: context.diagnostics,
  };
}
