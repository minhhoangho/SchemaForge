import type { Column } from "../model/column.js";
import type { ColumnType } from "../model/column-type.js";
import type { Enum } from "../model/enum.js";
import type { ColumnId, EnumId, GenerateId, TableId } from "../model/ids.js";
import {
  createColumnId,
  createEnumId,
  createIndexId,
  createRelationId,
  createTableId,
} from "../model/ids.js";
import type { ReferentialAction, Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";
import type { Table } from "../model/table.js";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "./factories.js";

export type LargeSchemaOptions = { readonly tableCount: number };

const SCHEMA_NAME = "Large";
const MIN_TABLE_COUNT = 2;
const COLUMNS_PER_TABLE = 20;
const TABLES_PER_ENUM = 10;
const VALUES_PER_ENUM = 5;
const COMPOSITE_KEY_INTERVAL = 10;
const SKIP_DISTANCE = 7;
const UNIQUE_INDEX_INTERVAL = 4;
const TABLE_NUMBER_WIDTH = 3;
const ENUM_NUMBER_WIDTH = 2;
const FIELD_NUMBER_WIDTH = 2;
const TABLE_GRID_WIDTH = 10;
const TABLE_SPACING = 400;

const BIGINT: ColumnType = { kind: "bigint" };
const INTEGER: ColumnType = { kind: "integer" };

// The enum comes first so every table has an enum column, and the first two
// fields are the indexed ones.
const FIELD_TYPES: readonly ColumnType[] = [
  INTEGER,
  { kind: "varchar", length: 100 },
  { kind: "text" },
  { kind: "boolean" },
  { kind: "decimal", precision: 12, scale: 2 },
  { kind: "timestamptz" },
  { kind: "uuid" },
  { kind: "date" },
  { kind: "json" },
  { kind: "double" },
  { kind: "smallint" },
  { kind: "char", length: 10 },
  { kind: "time" },
  { kind: "timestamp" },
  { kind: "real" },
  { kind: "binary" },
];

type LargeTable = {
  readonly table: Table;
  readonly columns: readonly Column[];
  readonly keyColumnIds: readonly ColumnId[];
  readonly nextColumnIds: readonly ColumnId[];
  readonly skipColumnIds: readonly ColumnId[];
  readonly indexColumnIds: readonly ColumnId[];
};

type ColumnFields = Omit<Partial<Column>, "id" | "tableId"> &
  Pick<Column, "name" | "type">;

// Wraps around the list; only an empty list, a bug in this file, can throw.
function itemAt<Item>(items: readonly Item[], index: number): Item {
  const item = items[index % items.length];
  if (item === undefined) {
    throw new Error(`The large schema has no item ${String(index)}`);
  }
  return item;
}

function formatNumber(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function tableName(index: number): string {
  return `table_${formatNumber(index, TABLE_NUMBER_WIDTH)}`;
}

function hasCompositeKey(index: number): boolean {
  return index % COMPOSITE_KEY_INTERVAL === 0;
}

// floor(1.5 * n) relations: one ring edge per table plus floor(n / 2) skip
// edges, so for an odd n the last even table has no skip edge.
function hasSkipRelation(index: number, tableCount: number): boolean {
  return index % 2 === 0 && index + 1 < tableCount;
}

function keyFields(index: number): readonly ColumnFields[] {
  return hasCompositeKey(index)
    ? [
        { name: "id", type: BIGINT },
        { name: "part", type: INTEGER },
      ]
    : [{ name: "id", type: BIGINT, isAutoIncrement: true }];
}

// Foreign key columns mirror the target's key, prefixed by the relation's role.
function foreignKeyFields(
  prefix: string,
  targetIndex: number,
  isNullable: boolean,
): readonly ColumnFields[] {
  return keyFields(targetIndex).map((field) => ({
    name: `${prefix}_${field.name}`,
    type: field.type,
    isNullable,
  }));
}

function fieldColumns(count: number, enumId: EnumId): readonly ColumnFields[] {
  const types: readonly ColumnType[] = [
    { kind: "enum", enumId },
    ...FIELD_TYPES,
  ];
  return Array.from({ length: count }, (_, fieldIndex) => ({
    name: `field_${formatNumber(fieldIndex, FIELD_NUMBER_WIDTH)}`,
    type: itemAt(types, fieldIndex),
  }));
}

function buildLargeTable(
  generateId: GenerateId,
  index: number,
  tableCount: number,
  enums: readonly Enum[],
): LargeTable {
  const tableId: TableId = createTableId(generateId);
  const toColumns = (fields: readonly ColumnFields[]): readonly Column[] =>
    fields.map((field) =>
      makeColumn({ ...field, id: createColumnId(generateId), tableId }),
    );
  const keys = toColumns(keyFields(index));
  // The ring is nullable so the seed generator can still load every table.
  const next = toColumns(
    foreignKeyFields("next", (index + 1) % tableCount, true),
  );
  const skip = hasSkipRelation(index, tableCount)
    ? toColumns(
        foreignKeyFields("skip", (index + SKIP_DISTANCE) % tableCount, false),
      )
    : [];
  const fieldCount =
    COLUMNS_PER_TABLE - keys.length - next.length - skip.length;
  const enumId = itemAt(enums, index).id;
  const fields = toColumns(fieldColumns(fieldCount, enumId));
  const ids = (columns: readonly Column[]): readonly ColumnId[] =>
    columns.map((column) => column.id);
  return {
    table: makeTable({
      id: tableId,
      name: tableName(index),
      position: {
        x: (index % TABLE_GRID_WIDTH) * TABLE_SPACING,
        y: Math.floor(index / TABLE_GRID_WIDTH) * TABLE_SPACING,
      },
      primaryKeyColumnIds: ids(keys),
    }),
    columns: [...keys, ...next, ...skip, ...fields],
    keyColumnIds: ids(keys),
    nextColumnIds: ids(next),
    skipColumnIds: ids(skip),
    indexColumnIds: ids(fields.slice(0, 2)),
  };
}

function buildEnums(
  generateId: GenerateId,
  tableCount: number,
): readonly Enum[] {
  const enumCount = Math.max(1, Math.floor(tableCount / TABLES_PER_ENUM));
  return Array.from({ length: enumCount }, (_, enumIndex) =>
    makeEnum({
      id: createEnumId(generateId),
      name: `enum_${formatNumber(enumIndex, ENUM_NUMBER_WIDTH)}`,
      values: Array.from(
        { length: VALUES_PER_ENUM },
        (_, valueIndex) => `value_${String(valueIndex)}`,
      ),
    }),
  );
}

function buildRelation(
  generateId: GenerateId,
  from: LargeTable,
  fromColumnIds: readonly ColumnId[],
  to: LargeTable,
  onDelete: ReferentialAction,
): Relation {
  return makeRelation({
    id: createRelationId(generateId),
    fromTableId: from.table.id,
    toTableId: to.table.id,
    columnPairs: fromColumnIds.map((fromColumnId, pairIndex) => ({
      fromColumnId,
      toColumnId: itemAt(to.keyColumnIds, pairIndex),
    })),
    onDelete,
  });
}

function buildRelations(
  generateId: GenerateId,
  tables: readonly LargeTable[],
): readonly Relation[] {
  return tables.flatMap((table, index) => {
    const ring = buildRelation(
      generateId,
      table,
      table.nextColumnIds,
      itemAt(tables, index + 1),
      "cascade",
    );
    if (table.skipColumnIds.length === 0) {
      return [ring];
    }
    const skipTarget = itemAt(tables, index + SKIP_DISTANCE);
    return [
      ring,
      buildRelation(
        generateId,
        table,
        table.skipColumnIds,
        skipTarget,
        "noAction",
      ),
    ];
  });
}

function buildIndexes(
  generateId: GenerateId,
  tables: readonly LargeTable[],
): readonly Index[] {
  return tables.map((table, index) =>
    makeIndex({
      id: createIndexId(generateId),
      tableId: table.table.id,
      name: `index_${formatNumber(index, TABLE_NUMBER_WIDTH)}`,
      columnIds: table.indexColumnIds,
      isUnique: index % UNIQUE_INDEX_INTERVAL === UNIQUE_INDEX_INTERVAL - 1,
    }),
  );
}

/**
 * Returns a semantically valid schema of `tableCount` tables for benchmarks
 * and property tests (code generators spec, section 9): 20 columns per table,
 * floor(1.5 * tableCount) relations with composite keys and a cascade ring,
 * one index per table and one enum per ten tables. Every call with the same
 * options returns an equal schema.
 */
export function createLargeSchema(options: LargeSchemaOptions): SchemaDocument {
  const { tableCount } = options;
  if (!Number.isInteger(tableCount) || tableCount < MIN_TABLE_COUNT) {
    throw new RangeError(
      `tableCount must be an integer of at least ${String(MIN_TABLE_COUNT)}, got ${String(tableCount)}`,
    );
  }
  const generateId = createCounterIdGenerator();
  const enums = buildEnums(generateId, tableCount);
  const tables = Array.from({ length: tableCount }, (_, index) =>
    buildLargeTable(generateId, index, tableCount, enums),
  );
  return buildSchema({
    name: SCHEMA_NAME,
    tables: tables.map((table) => table.table),
    columns: tables.flatMap((table) => table.columns),
    relations: buildRelations(generateId, tables),
    indexes: buildIndexes(generateId, tables),
    enums,
  });
}
