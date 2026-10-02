import type { ColumnId, EnumId, RelationId, TableId } from "../../model/ids.js";
import { sortEnums, sortRelations, sortTables } from "../../model/ordering.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import {
  toCamelCaseIdentifier,
  toPascalCaseIdentifier,
  withReservedWordSuffix,
} from "./identifiers.js";
import { createNameAllocator } from "./name-allocator.js";
import type { NameAllocator } from "./name-allocator.js";

export type RelationFieldNames = {
  readonly columnFieldNames: ReadonlyMap<ColumnId, string>;
  // Field on the `fromTableId` model.
  readonly forwardFieldNames: ReadonlyMap<RelationId, string>;
  // Field on the `toTableId` model.
  readonly inverseFieldNames: ReadonlyMap<RelationId, string>;
  // Only relations that need a name: self-references and repeated table pairs.
  readonly relationNames: ReadonlyMap<RelationId, string>;
};

const ENUM_FALLBACK = "Enum";
const TABLE_FALLBACK = "Table";
const FIELD_FALLBACK = "field";
const ID_SUFFIXES: readonly string[] = ["_id", " id", "Id"];

function createCodeNameAllocator(): NameAllocator {
  return createNameAllocator({
    reserved: [],
    comparison: "exact",
    separator: "",
    maxBytes: null,
  });
}

/** Model names for enums (first) and tables, unique in one namespace. */
export function allocateModelNames(
  schema: SchemaDocument,
  reservedWords: readonly string[],
): {
  readonly enumNames: ReadonlyMap<EnumId, string>;
  readonly tableNames: ReadonlyMap<TableId, string>;
} {
  const allocator = createCodeNameAllocator();
  const allocate = (name: string, fallback: string): string =>
    allocator.allocate(
      withReservedWordSuffix(
        toPascalCaseIdentifier(name, fallback),
        reservedWords,
      ),
    );
  const enumNames = new Map(
    sortEnums(schema).map((element) => [
      element.id,
      allocate(element.name, ENUM_FALLBACK),
    ]),
  );
  const tableNames = new Map(
    sortTables(schema).map((table) => [
      table.id,
      allocate(table.name, TABLE_FALLBACK),
    ]),
  );
  return { enumNames, tableNames };
}

function tableName(schema: SchemaDocument, tableId: TableId): string {
  return schema.tables[tableId]?.name ?? "";
}

// `author_id` -> `author`; otherwise the target table name.
function forwardFieldBase(schema: SchemaDocument, relation: Relation): string {
  const [onlyPair, ...otherPairs] = relation.columnPairs;
  const columnName =
    onlyPair === undefined || otherPairs.length > 0
      ? ""
      : (schema.columns[onlyPair.fromColumnId]?.name ?? "");
  const suffix = ID_SUFFIXES.find(
    (candidate) =>
      columnName.endsWith(candidate) && columnName.length > candidate.length,
  );
  const baseName =
    suffix === undefined
      ? tableName(schema, relation.toTableId)
      : columnName.slice(0, -suffix.length);
  return toCamelCaseIdentifier(baseName, FIELD_FALLBACK);
}

function tablePairKey(relation: Relation): string {
  const { fromTableId, toTableId } = relation;
  return fromTableId < toTableId
    ? `${fromTableId} ${toTableId}`
    : `${toTableId} ${fromTableId}`;
}

function needsRelationName(
  relation: Relation,
  pairCounts: ReadonlyMap<string, number>,
): boolean {
  return (
    relation.fromTableId === relation.toTableId ||
    (pairCounts.get(tablePairKey(relation)) ?? 0) > 1
  );
}

function buildRelationNames(
  relations: readonly Relation[],
  tableModelNames: ReadonlyMap<TableId, string>,
  forwardFieldNames: ReadonlyMap<RelationId, string>,
): ReadonlyMap<RelationId, string> {
  const pairCounts = new Map<string, number>();
  relations.forEach((relation) => {
    const key = tablePairKey(relation);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  });
  return new Map(
    relations
      .filter((relation) => needsRelationName(relation, pairCounts))
      .map((relation) => {
        const modelName = tableModelNames.get(relation.fromTableId);
        if (modelName === undefined) {
          throw new RangeError(
            `No model name for table ${relation.fromTableId}`,
          );
        }
        const fieldName = forwardFieldNames.get(relation.id) ?? "";
        return [relation.id, `${modelName}_${fieldName}`];
      }),
  );
}

/**
 * Field names of Prisma and Drizzle models (spec section 5): column fields,
 * then the forward and inverse relation fields, each unique per model.
 */
export function buildRelationFieldNames(
  schema: SchemaDocument,
  tableModelNames: ReadonlyMap<TableId, string>,
): RelationFieldNames {
  const tables = sortTables(schema);
  const allocators = new Map(
    tables.map((table) => [table.id, createCodeNameAllocator()]),
  );
  const allocateIn = (tableId: TableId, preferred: string): string =>
    (allocators.get(tableId) ?? createCodeNameAllocator()).allocate(preferred);
  const columnFieldNames = new Map(
    tables.flatMap((table) =>
      table.columnIds.map((columnId) => [
        columnId,
        allocateIn(
          table.id,
          toCamelCaseIdentifier(
            schema.columns[columnId]?.name ?? "",
            FIELD_FALLBACK,
          ),
        ),
      ]),
    ),
  );
  const relations = sortRelations(schema);
  const forwardFieldNames = new Map(
    relations.map((relation) => [
      relation.id,
      allocateIn(relation.fromTableId, forwardFieldBase(schema, relation)),
    ]),
  );
  const inverseFieldNames = new Map(
    relations.map((relation) => [
      relation.id,
      allocateIn(
        relation.toTableId,
        toCamelCaseIdentifier(
          tableName(schema, relation.fromTableId),
          FIELD_FALLBACK,
        ),
      ),
    ]),
  );
  return {
    columnFieldNames,
    forwardFieldNames,
    inverseFieldNames,
    relationNames: buildRelationNames(
      relations,
      tableModelNames,
      forwardFieldNames,
    ),
  };
}
