import {
  SQL_DIALECTS,
  type SqlDialect,
} from "../../generators/shared/generator-types.js";
import type {
  DraftDiagnostic,
  DraftEnum,
  DraftIndex,
  DraftRelation,
  DraftTable,
  ImportDraft,
} from "../shared/import-draft.js";
import type { PrismaBlock, PrismaSchema } from "./prisma-ast.js";
import { findAttribute, mappedName } from "./prisma-attribute-args.js";
import {
  buildModelDraft,
  type ModelBlock,
  type PrismaDraftNames,
} from "./prisma-draft-model.js";
import { buildPrismaRelations } from "./prisma-relations.js";

type EnumBlock = Extract<PrismaBlock, { readonly values: unknown }>;
type DatasourceBlock = Extract<PrismaBlock, { readonly properties: unknown }>;

type DraftParts = {
  readonly tables: DraftTable[];
  readonly indexes: DraftIndex[];
  readonly enums: DraftEnum[];
  readonly diagnostics: DraftDiagnostic[];
};

const DEFAULT_PROVIDER: SqlDialect = "postgresql";

function findDatasource(
  blocks: readonly PrismaBlock[],
): DatasourceBlock | undefined {
  return blocks.find(
    (block): block is DatasourceBlock => block.kind === "datasource",
  );
}

// Without a datasource, or with a provider other than the three dialects, the
// schema reads as PostgreSQL (spec section 6).
function readProvider(blocks: readonly PrismaBlock[]): {
  readonly provider: SqlDialect;
  readonly diagnostics: readonly DraftDiagnostic[];
} {
  const datasource = findDatasource(blocks);
  const property = datasource?.properties.find(
    ({ name }) => name === "provider",
  );
  const value = property?.value;
  const provider =
    value?.kind === "string"
      ? SQL_DIALECTS.find((dialect) => dialect === value.value)
      : undefined;
  if (provider !== undefined) {
    return { provider, diagnostics: [] };
  }
  const location = property?.position ?? datasource?.position ?? null;
  return {
    provider: DEFAULT_PROVIDER,
    diagnostics: [{ code: "provider-not-supported", location, target: null }],
  };
}

function collectNames(
  blocks: readonly PrismaBlock[],
  provider: SqlDialect,
): PrismaDraftNames {
  const models = blocks.filter(
    (block): block is ModelBlock => block.kind === "model",
  );
  const enums = blocks.filter(
    (block): block is EnumBlock => block.kind === "enum",
  );
  return {
    provider,
    modelNames: new Set(models.map(({ name }) => name)),
    compositeTypeNames: new Set(
      blocks.flatMap((block) => (block.kind === "type" ? [block.name] : [])),
    ),
    tableNameByModel: new Map(
      models.map((model) => [
        model.name,
        mappedName(model.blockAttributes, model.name),
      ]),
    ),
    columnNameByField: new Map(
      models.map((model) => [
        model.name,
        new Map(
          model.fields.map((field) => [
            field.name,
            mappedName(field.attributes, field.name),
          ]),
        ),
      ]),
    ),
    enumNamesByPrismaName: new Map(
      enums.map((block) => [
        block.name,
        mappedName(block.blockAttributes, block.name),
      ]),
    ),
    enumValuesByPrismaName: new Map(
      enums.map((block) => [
        block.name,
        new Map(
          block.values.map((value) => [
            value.name,
            mappedName(value.attributes, value.name),
          ]),
        ),
      ]),
    ),
  };
}

// The model keeps no comment or namespace for an enum or its values.
function addEnum(
  block: EnumBlock,
  names: PrismaDraftNames,
  parts: DraftParts,
): void {
  const target = { kind: "enum", index: parts.enums.length } as const;
  const commented = [block, ...block.values].filter(
    ({ docComment }) => docComment !== null,
  );
  for (const { position } of commented) {
    parts.diagnostics.push({
      code: "comment-dropped",
      location: position,
      target,
    });
  }
  const schema = findAttribute(block.blockAttributes, "schema");
  if (schema !== undefined) {
    parts.diagnostics.push({
      code: "namespace-dropped",
      location: schema.position,
      target,
    });
  }
  const values = names.enumValuesByPrismaName.get(block.name);
  parts.enums.push({
    name: names.enumNamesByPrismaName.get(block.name) ?? block.name,
    values: block.values.map(({ name }) => values?.get(name) ?? name),
    location: block.position,
  });
}

function addModel(
  model: ModelBlock,
  names: PrismaDraftNames,
  parts: DraftParts,
): void {
  const built = buildModelDraft(model, names, {
    tableIndex: parts.tables.length,
    firstIndex: parts.indexes.length,
  });
  parts.tables.push(built.table);
  parts.indexes.push(...built.indexes);
  parts.diagnostics.push(...built.diagnostics);
}

function addBlock(
  block: PrismaBlock,
  names: PrismaDraftNames,
  parts: DraftParts,
): void {
  switch (block.kind) {
    case "datasource":
    case "generator":
      return;
    case "enum":
      addEnum(block, names, parts);
      return;
    case "model":
      addModel(block, names, parts);
      return;
    case "view":
      parts.diagnostics.push({
        code: "view-not-supported",
        location: block.position,
        target: null,
      });
      return;
    case "type":
      parts.diagnostics.push({
        code: "composite-type-not-supported",
        location: block.position,
        target: null,
      });
      return;
    default: {
      const unreachable: never = block;
      return unreachable;
    }
  }
}

function readRelations(
  blocks: readonly PrismaBlock[],
  names: PrismaDraftNames,
): {
  readonly relations: readonly DraftRelation[];
  readonly diagnostics: readonly DraftDiagnostic[];
} {
  const result = buildPrismaRelations(blocks, names);
  return {
    relations: result.relations.map(({ relation }) => relation),
    diagnostics: [
      ...result.relations.flatMap(({ relation, codes }, index) =>
        codes.map((code) => ({
          code,
          location: relation.location,
          target: { kind: "relation", index } as const,
        })),
      ),
      ...result.dropped.map(({ code, position }) => ({
        code,
        location: position,
        target: null,
      })),
    ],
  };
}

/**
 * Translates a parsed Prisma schema into an import draft (import / export
 * spec, section 6). Generators are skipped; the datasource provider decides
 * how scalar types and `@db.*` read.
 */
export function buildPrismaDraft(schema: PrismaSchema): ImportDraft {
  const { blocks } = schema;
  const provider = readProvider(blocks);
  const names = collectNames(blocks, provider.provider);
  const parts: DraftParts = {
    tables: [],
    indexes: [],
    enums: [],
    diagnostics: [...provider.diagnostics],
  };
  for (const block of blocks) {
    addBlock(block, names, parts);
  }
  const relations = readRelations(blocks, names);
  return {
    name: null,
    tables: parts.tables,
    indexes: parts.indexes,
    relations: relations.relations,
    enums: parts.enums,
    subjectAreas: [],
    notes: [],
    diagnostics: [...parts.diagnostics, ...relations.diagnostics],
  };
}
