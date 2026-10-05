import type { ColumnDefault } from "./column-default.js";
import type { ColumnType } from "./column-type.js";
import type { Column } from "./column.js";
import type { Note } from "./note.js";
import type { Relation } from "./relation.js";
import type { SchemaDocument } from "./schema-document.js";
import type { Table } from "./table.js";

const JSON_INDENT = 2;

type JsonRecord = Readonly<Record<string, unknown>>;

/**
 * Field order of every object in a serialized document: the declaration order
 * of the matching Zod shape (one list per branch for unions). Tests pin each
 * list to its shape, so a model field added without updating it fails a test.
 */
export const SERIALIZED_FIELD_ORDER = {
  document: [
    "version",
    "name",
    "tables",
    "columns",
    "relations",
    "indexes",
    "enums",
    "subjectAreas",
    "notes",
  ],
  table: [
    "id",
    "name",
    "comment",
    "position",
    "subjectAreaId",
    "columnIds",
    "primaryKeyColumnIds",
  ],
  position: ["x", "y"],
  column: [
    "id",
    "tableId",
    "name",
    "type",
    "isNullable",
    "defaultValue",
    "isUnique",
    "isAutoIncrement",
    "comment",
  ],
  columnType: {
    smallint: ["kind"],
    integer: ["kind"],
    bigint: ["kind"],
    decimal: ["kind", "precision", "scale"],
    real: ["kind"],
    double: ["kind"],
    boolean: ["kind"],
    char: ["kind", "length"],
    varchar: ["kind", "length"],
    text: ["kind"],
    uuid: ["kind"],
    date: ["kind"],
    time: ["kind"],
    timestamp: ["kind"],
    timestamptz: ["kind"],
    json: ["kind"],
    binary: ["kind"],
    enum: ["kind", "enumId"],
    custom: ["kind", "name"],
  } satisfies Readonly<Record<ColumnType["kind"], readonly string[]>>,
  columnDefault: {
    literal: ["kind", "value"],
    currentTimestamp: ["kind"],
    generateUuid: ["kind"],
  } satisfies Readonly<Record<ColumnDefault["kind"], readonly string[]>>,
  relation: [
    "id",
    "kind",
    "fromTableId",
    "toTableId",
    "columnPairs",
    "onDelete",
    "onUpdate",
  ],
  columnPair: ["fromColumnId", "toColumnId"],
  index: ["id", "tableId", "name", "columnIds", "isUnique"],
  enum: ["id", "name", "values"],
  subjectArea: ["id", "name"],
  note: ["id", "text", "position"],
} as const;

// A parsed document is strict, so a field missing from the list means the
// list is out of date: a programmer error, not an expected failure.
function orderFields(value: JsonRecord, keys: readonly string[]): JsonRecord {
  const unexpectedKey = Object.keys(value).find((key) => !keys.includes(key));
  if (unexpectedKey !== undefined) {
    throw new Error(
      `serializeSchemaDocument: unexpected field ${JSON.stringify(unexpectedKey)}`,
    );
  }
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}

function serializeTable(table: Table): JsonRecord {
  return orderFields(
    {
      ...table,
      position: orderFields(table.position, SERIALIZED_FIELD_ORDER.position),
    },
    SERIALIZED_FIELD_ORDER.table,
  );
}

function serializeColumn(column: Column): JsonRecord {
  const { type, defaultValue } = column;
  return orderFields(
    {
      ...column,
      type: orderFields(type, SERIALIZED_FIELD_ORDER.columnType[type.kind]),
      defaultValue:
        defaultValue === null
          ? null
          : orderFields(
              defaultValue,
              SERIALIZED_FIELD_ORDER.columnDefault[defaultValue.kind],
            ),
    },
    SERIALIZED_FIELD_ORDER.column,
  );
}

function serializeRelation(relation: Relation): JsonRecord {
  return orderFields(
    {
      ...relation,
      columnPairs: relation.columnPairs.map((pair) =>
        orderFields(pair, SERIALIZED_FIELD_ORDER.columnPair),
      ),
    },
    SERIALIZED_FIELD_ORDER.relation,
  );
}

function serializeNote(note: Note): JsonRecord {
  return orderFields(
    {
      ...note,
      position: orderFields(note.position, SERIALIZED_FIELD_ORDER.position),
    },
    SERIALIZED_FIELD_ORDER.note,
  );
}

// Ids carry a prefix, so no key is an array index that JavaScript would move
// to the front of the object regardless of insertion order.
function serializeMap<Element>(
  map: Readonly<Record<string, Element>>,
  serializeElement: (element: Element) => JsonRecord,
): JsonRecord {
  return Object.fromEntries(
    Object.entries(map)
      .toSorted(([left], [right]) => (left < right ? -1 : Number(left > right)))
      .map(([id, element]) => [id, serializeElement(element)]),
  );
}

/**
 * Writes a document as JSON whose bytes depend only on its content: root keys
 * and element fields in Zod declaration order, map elements by id (code unit
 * order), arrays as they are. Indented by two spaces, one trailing newline.
 */
export function serializeSchemaDocument(document: SchemaDocument): string {
  const ordered = orderFields(
    {
      ...document,
      tables: serializeMap(document.tables, serializeTable),
      columns: serializeMap(document.columns, serializeColumn),
      relations: serializeMap(document.relations, serializeRelation),
      indexes: serializeMap(document.indexes, (index) =>
        orderFields(index, SERIALIZED_FIELD_ORDER.index),
      ),
      enums: serializeMap(document.enums, (element) =>
        orderFields(element, SERIALIZED_FIELD_ORDER.enum),
      ),
      subjectAreas: serializeMap(document.subjectAreas, (area) =>
        orderFields(area, SERIALIZED_FIELD_ORDER.subjectArea),
      ),
      notes: serializeMap(document.notes, serializeNote),
    },
    SERIALIZED_FIELD_ORDER.document,
  );
  return `${JSON.stringify(ordered, null, JSON_INDENT)}\n`;
}
