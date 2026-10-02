import type { ColumnId, RelationId, TableId } from "../../model/ids.js";
import { MAX_NAME_BYTES, utf8ByteLength } from "../../model/name-limits.js";
import {
  sortIndexes,
  sortRelations,
  sortTables,
} from "../../model/ordering.js";
import type { ColumnPair, Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { createNameAllocator, truncateToUtf8Bytes } from "./name-allocator.js";

type ConstraintSuffix = "pkey" | "key" | "fkey" | "check" | "idx";

export type SchemaConstraintNames = {
  readonly primaryKeys: ReadonlyMap<TableId, string>;
  readonly uniqueColumns: ReadonlyMap<ColumnId, string>;
  // CHECK constraints of enum columns, written only by SQL Server.
  readonly enumChecks: ReadonlyMap<ColumnId, string>;
  readonly foreignKeys: ReadonlyMap<RelationId, string>;
  // Every auto-increment column, so names match across dialects; only MySQL
  // writes these, for its replacement index (R14).
  readonly autoIncrementIndexes: ReadonlyMap<ColumnId, string>;
};

// 54 bytes + "_" + 8 hex digits = 63 bytes.
const SHORTENED_PREFIX_BYTES = 54;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX_RADIX = 16;
const HASH_HEX_DIGITS = 8;

const REPLACEMENT_CHARACTER = 0xfffd;
const MIN_SURROGATE = 0xd800;
const MAX_SURROGATE = 0xdfff;
const MAX_ONE_BYTE = 0x7f;
const MAX_TWO_BYTES = 0x7ff;
const MAX_THREE_BYTES = 0xffff;
const CONTINUATION_BITS = 6;
const CONTINUATION_MASK = 0x3f;
const CONTINUATION_MARKER = 0x80;
const TWO_BYTE_MARKER = 0xc0;
const THREE_BYTE_MARKER = 0xe0;
const FOUR_BYTE_MARKER = 0xf0;

function continuationByte(codePoint: number, shift: number): number {
  return (
    CONTINUATION_MARKER |
    ((codePoint >> (CONTINUATION_BITS * shift)) & CONTINUATION_MASK)
  );
}

// TextEncoder is banned in core. A lone surrogate encodes as U+FFFD, matching
// utf8ByteLength and TextEncoder.
function codePointUtf8Bytes(character: string): readonly number[] {
  const raw = character.codePointAt(0) ?? REPLACEMENT_CHARACTER;
  const codePoint =
    raw >= MIN_SURROGATE && raw <= MAX_SURROGATE ? REPLACEMENT_CHARACTER : raw;
  if (codePoint <= MAX_ONE_BYTE) {
    return [codePoint];
  }
  if (codePoint <= MAX_TWO_BYTES) {
    return [
      TWO_BYTE_MARKER | (codePoint >> CONTINUATION_BITS),
      continuationByte(codePoint, 0),
    ];
  }
  if (codePoint <= MAX_THREE_BYTES) {
    return [
      THREE_BYTE_MARKER | (codePoint >> (CONTINUATION_BITS * 2)),
      continuationByte(codePoint, 1),
      continuationByte(codePoint, 0),
    ];
  }
  return [
    FOUR_BYTE_MARKER | (codePoint >> (CONTINUATION_BITS * 3)),
    continuationByte(codePoint, 2),
    continuationByte(codePoint, 1),
    continuationByte(codePoint, 0),
  ];
}

/** FNV-1a 32-bit hash of the UTF-8 bytes of `text`, as 8 lowercase hex digits. */
export function fnv1a32Hex(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (const character of text) {
    for (const byte of codePointUtf8Bytes(character)) {
      hash = Math.imul(hash ^ byte, FNV_PRIME) >>> 0;
    }
  }
  return hash.toString(HEX_RADIX).padStart(HASH_HEX_DIGITS, "0");
}

/**
 * PostgreSQL's default constraint name from the original names; a name over
 * 63 UTF-8 bytes is cut to 54 bytes plus "_" and a hash of the full name.
 */
export function buildConstraintName(
  tableName: string,
  columnNames: readonly string[],
  suffix: ConstraintSuffix,
): string {
  const parts =
    suffix === "pkey"
      ? [tableName, suffix]
      : [tableName, ...columnNames, suffix];
  const name = parts.join("_");
  if (utf8ByteLength(name) <= MAX_NAME_BYTES) {
    return name;
  }
  return `${truncateToUtf8Bytes(name, SHORTENED_PREFIX_BYTES)}_${fnv1a32Hex(name)}`;
}

type AllocateConstraintName = (
  tableName: string,
  columnNames: readonly string[],
  suffix: ConstraintSuffix,
) => string;

type TableConstraintNames = Pick<
  SchemaConstraintNames,
  "primaryKeys" | "uniqueColumns" | "enumChecks" | "autoIncrementIndexes"
>;

function allocateTableConstraintNames(
  schema: SchemaDocument,
  allocate: AllocateConstraintName,
): TableConstraintNames {
  const primaryKeys = new Map<TableId, string>();
  const uniqueColumns = new Map<ColumnId, string>();
  const enumChecks = new Map<ColumnId, string>();
  const autoIncrementIndexes = new Map<ColumnId, string>();
  for (const table of sortTables(schema)) {
    if (table.primaryKeyColumnIds.length > 0) {
      primaryKeys.set(table.id, allocate(table.name, [], "pkey"));
    }
    const columns = table.columnIds.flatMap((id) => schema.columns[id] ?? []);
    for (const { id, name, isUnique, isAutoIncrement, type } of columns) {
      if (isUnique) {
        uniqueColumns.set(id, allocate(table.name, [name], "key"));
      }
      if (type.kind === "enum") {
        enumChecks.set(id, allocate(table.name, [name], "check"));
      }
      if (isAutoIncrement) {
        autoIncrementIndexes.set(id, allocate(table.name, [name], "idx"));
      }
    }
  }
  return { primaryKeys, uniqueColumns, enumChecks, autoIncrementIndexes };
}

/**
 * Names every generator-named constraint once per schema, independent of the
 * dialect, so the SQL dialects and Drizzle agree. Table and user index names
 * are reserved and never renamed.
 */
export function allocateConstraintNames(
  schema: SchemaDocument,
  orderColumnPairs: (relation: Relation) => readonly ColumnPair[],
): SchemaConstraintNames {
  // Case-insensitive for every dialect: MySQL and SQL Server's default
  // collation compare these names that way, accent-sensitively.
  const allocator = createNameAllocator({
    reserved: [
      ...sortTables(schema).map((table) => table.name),
      ...sortIndexes(schema).map((index) => index.name),
    ],
    comparison: "caseInsensitive",
    separator: "_",
    maxBytes: MAX_NAME_BYTES,
  });
  const allocate: AllocateConstraintName = (tableName, columnNames, suffix) =>
    allocator.allocate(buildConstraintName(tableName, columnNames, suffix));

  // Table constraints are named before foreign keys, so they win a clash.
  const tableNames = allocateTableConstraintNames(schema, allocate);
  const foreignKeys = new Map(
    sortRelations(schema).map((relation) => [
      relation.id,
      allocate(
        schema.tables[relation.fromTableId]?.name ?? "",
        orderColumnPairs(relation).flatMap(
          (pair) => schema.columns[pair.fromColumnId]?.name ?? [],
        ),
        "fkey",
      ),
    ]),
  );
  return { ...tableNames, foreignKeys };
}
