import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { parseSchemaDocument } from "../parse/parse-schema-document.js";
import { isJsonObject } from "../parse/json-object.js";
import {
  PROPERTY_RUNS,
  PROPERTY_SEED,
  keyOrderArbitrary,
  schemaDocumentArbitrary,
  withShuffledKeys,
} from "../testing/arbitraries.js";
import { makeColumn, makeTable } from "../testing/factories.js";
import { createSampleSchema } from "../testing/sample-schema.js";
import { unwrapOk } from "../testing/unwrap-result.js";
import { columnDefaultShape } from "./column-default.js";
import type { ColumnDefault } from "./column-default.js";
import { columnTypeShape } from "./column-type.js";
import type { ColumnType } from "./column-type.js";
import { columnFieldsShape } from "./column.js";
import { createEmptySchema } from "./create-empty-schema.js";
import { enumFieldsShape } from "./enum.js";
import { noteFieldsShape } from "./note.js";
import { positionShape } from "./position.js";
import { columnPairShape, relationFieldsShape } from "./relation.js";
import {
  CURRENT_SCHEMA_VERSION,
  schemaDocumentShape,
} from "./schema-document.js";
import type { SchemaDocument } from "./schema-document.js";
import {
  SERIALIZED_FIELD_ORDER,
  serializeSchemaDocument,
} from "./serialize-schema-document.js";
import { subjectAreaFieldsShape } from "./subject-area.js";
import { indexFieldsShape } from "./table-index.js";
import { tableFieldsShape } from "./table.js";

const PROPERTY_PARAMETERS = { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS };
const PROPERTY_TIMEOUT_MS = 60_000;

// Every map lists its elements in reverse id order, and every object (nested
// ones included) lists its fields in reverse declaration order, so only a
// serializer that reorders both can produce the expected output. "tbl_B"
// sorts before "tbl_a" by code unit but after it under a locale collation.
const SCRAMBLED_DOCUMENT: SchemaDocument = {
  notes: {
    note_b: { position: { y: 40, x: 30 }, text: "second", id: "note_b" },
    note_a: { position: { y: 20, x: 10 }, text: "first", id: "note_a" },
  },
  subjectAreas: {
    area_b: { name: "sales", id: "area_b" },
    area_a: { name: "billing", id: "area_a" },
  },
  enums: {
    enum_b: { values: ["draft"], name: "post_status", id: "enum_b" },
    enum_a: { values: ["active"], name: "user_status", id: "enum_a" },
  },
  indexes: {
    idx_b: {
      isUnique: false,
      columnIds: ["col_c"],
      name: "posts_author",
      tableId: "tbl_a",
      id: "idx_b",
    },
    idx_a: {
      isUnique: true,
      columnIds: ["col_b"],
      name: "users_email",
      tableId: "tbl_B",
      id: "idx_a",
    },
  },
  relations: {
    rel_b: {
      onUpdate: "noAction",
      onDelete: "cascade",
      columnPairs: [{ toColumnId: "col_a", fromColumnId: "col_c" }],
      toTableId: "tbl_B",
      fromTableId: "tbl_a",
      kind: "oneToOne",
      id: "rel_b",
    },
    rel_a: {
      onUpdate: "cascade",
      onDelete: "setNull",
      columnPairs: [{ toColumnId: "col_a", fromColumnId: "col_c" }],
      toTableId: "tbl_B",
      fromTableId: "tbl_a",
      kind: "oneToMany",
      id: "rel_a",
    },
  },
  columns: {
    col_c: {
      comment: "",
      isAutoIncrement: false,
      isUnique: false,
      defaultValue: { kind: "currentTimestamp" },
      isNullable: true,
      type: { kind: "uuid" },
      name: "author_id",
      tableId: "tbl_a",
      id: "col_c",
    },
    col_b: {
      comment: "login",
      isAutoIncrement: false,
      isUnique: true,
      defaultValue: { value: "none", kind: "literal" },
      isNullable: false,
      type: { length: 255, kind: "varchar" },
      name: "email",
      tableId: "tbl_B",
      id: "col_b",
    },
    col_a: {
      comment: "",
      isAutoIncrement: true,
      isUnique: false,
      defaultValue: null,
      isNullable: false,
      type: { scale: 2, precision: 10, kind: "decimal" },
      name: "id",
      tableId: "tbl_B",
      id: "col_a",
    },
  },
  tables: {
    tbl_a: {
      primaryKeyColumnIds: [],
      columnIds: ["col_c"],
      subjectAreaId: "area_b",
      position: { y: 4, x: 3 },
      comment: "",
      name: "posts",
      id: "tbl_a",
    },
    tbl_B: {
      primaryKeyColumnIds: ["col_a"],
      columnIds: ["col_a", "col_b"],
      subjectAreaId: "area_a",
      position: { y: 2, x: 1 },
      comment: "people",
      name: "users",
      id: "tbl_B",
    },
  },
  name: "scrambled",
  version: CURRENT_SCHEMA_VERSION,
};

const MAP_NAMES = [
  "tables",
  "columns",
  "relations",
  "indexes",
  "enums",
  "subjectAreas",
  "notes",
] as const;

function childAt(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    return value[Number(key)];
  }
  return isJsonObject(value) ? value[key] : undefined;
}

function keysAt(
  serialized: string,
  path: readonly string[],
): readonly string[] {
  const value = path.reduce<unknown>(childAt, JSON.parse(serialized));
  return isJsonObject(value) ? Object.keys(value) : [];
}

function columnTypeKeys(kind: ColumnType["kind"]): readonly string[] {
  const branch = columnTypeShape
    .unwrap()
    .options.find((option) => option.shape.kind.value === kind);
  return branch === undefined ? [] : Object.keys(branch.shape);
}

function columnDefaultKeys(kind: ColumnDefault["kind"]): readonly string[] {
  const branch = columnDefaultShape
    .unwrap()
    .options.find((option) => option.shape.kind.value === kind);
  return branch === undefined ? [] : Object.keys(branch.shape);
}

describe("serializeSchemaDocument", () => {
  it("writes an empty document as JSON indented by two spaces", () => {
    expect(serializeSchemaDocument(createEmptySchema("blog"))).toBe(
      [
        "{",
        '  "version": 1,',
        '  "name": "blog",',
        '  "tables": {},',
        '  "columns": {},',
        '  "relations": {},',
        '  "indexes": {},',
        '  "enums": {},',
        '  "subjectAreas": {},',
        '  "notes": {}',
        "}",
        "",
      ].join("\n"),
    );
  });

  it("writes root keys in declaration order", () => {
    expect(
      keysAt(serializeSchemaDocument(SCRAMBLED_DOCUMENT), []),
    ).toStrictEqual([
      "version",
      "name",
      "tables",
      "columns",
      "relations",
      "indexes",
      "enums",
      "subjectAreas",
      "notes",
    ]);
  });

  it("sorts the elements of each map by id", () => {
    const serialized = serializeSchemaDocument(SCRAMBLED_DOCUMENT);

    expect(
      Object.fromEntries(
        MAP_NAMES.map((mapName) => [mapName, keysAt(serialized, [mapName])]),
      ),
    ).toStrictEqual({
      tables: ["tbl_B", "tbl_a"],
      columns: ["col_a", "col_b", "col_c"],
      relations: ["rel_a", "rel_b"],
      indexes: ["idx_a", "idx_b"],
      enums: ["enum_a", "enum_b"],
      subjectAreas: ["area_a", "area_b"],
      notes: ["note_a", "note_b"],
    });
  });

  it.each([
    ["table", ["tables", "tbl_a"], Object.keys(tableFieldsShape.shape)],
    [
      "table position",
      ["tables", "tbl_a", "position"],
      Object.keys(positionShape.unwrap().shape),
    ],
    ["column", ["columns", "col_a"], Object.keys(columnFieldsShape.shape)],
    [
      "decimal column type",
      ["columns", "col_a", "type"],
      columnTypeKeys("decimal"),
    ],
    [
      "varchar column type",
      ["columns", "col_b", "type"],
      columnTypeKeys("varchar"),
    ],
    [
      "literal column default",
      ["columns", "col_b", "defaultValue"],
      columnDefaultKeys("literal"),
    ],
    [
      "relation",
      ["relations", "rel_a"],
      Object.keys(relationFieldsShape.shape),
    ],
    [
      "column pair",
      ["relations", "rel_a", "columnPairs", "0"],
      Object.keys(columnPairShape.unwrap().shape),
    ],
    ["index", ["indexes", "idx_a"], Object.keys(indexFieldsShape.shape)],
    ["enum", ["enums", "enum_a"], Object.keys(enumFieldsShape.shape)],
    [
      "subject area",
      ["subjectAreas", "area_a"],
      Object.keys(subjectAreaFieldsShape.shape),
    ],
    ["note", ["notes", "note_a"], Object.keys(noteFieldsShape.shape)],
    [
      "note position",
      ["notes", "note_a", "position"],
      Object.keys(positionShape.unwrap().shape),
    ],
  ])("writes %s fields in zod shape order", (_label, path, expectedKeys) => {
    expect(
      keysAt(serializeSchemaDocument(SCRAMBLED_DOCUMENT), path),
    ).toStrictEqual(expectedKeys);
  });

  it("ends with exactly one newline and has no byte order mark", () => {
    const serialized = serializeSchemaDocument(createSampleSchema());

    expect([serialized.at(0), serialized.slice(-2)]).toStrictEqual([
      "{",
      "}\n",
    ]);
  });

  it(
    "serializes the same document with shuffled map keys to the same string",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(
          schemaDocumentArbitrary(),
          keyOrderArbitrary(),
          (schema, order) => {
            expect(
              serializeSchemaDocument(withShuffledKeys(schema, order)),
            ).toBe(serializeSchemaDocument(schema));
          },
        ),
        PROPERTY_PARAMETERS,
      );
    },
  );

  it("keeps positions, subject areas and notes", () => {
    const schema = createSampleSchema();

    expect(
      unwrapOk(
        parseSchemaDocument(JSON.parse(serializeSchemaDocument(schema))),
      ),
    ).toStrictEqual(schema);
  });

  it("throws when an element has a field the model does not declare", () => {
    const column = {
      ...makeColumn({ id: "col_a", tableId: "tbl_a" }),
      extra: true,
    };
    const document: SchemaDocument = {
      ...createEmptySchema("blog"),
      tables: {
        tbl_a: { ...makeTable({ id: "tbl_a" }), columnIds: ["col_a"] },
      },
      columns: { col_a: column },
    };

    expect(() => serializeSchemaDocument(document)).toThrow(
      'serializeSchemaDocument: unexpected field "extra"',
    );
  });
});

describe("SERIALIZED_FIELD_ORDER", () => {
  it.each([
    [
      "document",
      SERIALIZED_FIELD_ORDER.document,
      schemaDocumentShape.unwrap().shape,
    ],
    ["table", SERIALIZED_FIELD_ORDER.table, tableFieldsShape.shape],
    ["position", SERIALIZED_FIELD_ORDER.position, positionShape.unwrap().shape],
    ["column", SERIALIZED_FIELD_ORDER.column, columnFieldsShape.shape],
    ["relation", SERIALIZED_FIELD_ORDER.relation, relationFieldsShape.shape],
    [
      "column pair",
      SERIALIZED_FIELD_ORDER.columnPair,
      columnPairShape.unwrap().shape,
    ],
    ["index", SERIALIZED_FIELD_ORDER.index, indexFieldsShape.shape],
    ["enum", SERIALIZED_FIELD_ORDER.enum, enumFieldsShape.shape],
    [
      "subject area",
      SERIALIZED_FIELD_ORDER.subjectArea,
      subjectAreaFieldsShape.shape,
    ],
    ["note", SERIALIZED_FIELD_ORDER.note, noteFieldsShape.shape],
  ])("lists the same keys as the %s zod shape", (_label, keys, shape) => {
    expect(keys).toStrictEqual(Object.keys(shape));
  });

  it("lists the same keys as each column type zod branch", () => {
    expect(SERIALIZED_FIELD_ORDER.columnType).toStrictEqual(
      Object.fromEntries(
        columnTypeShape
          .unwrap()
          .options.map((option) => [
            option.shape.kind.value,
            Object.keys(option.shape),
          ]),
      ),
    );
  });

  it("lists the same keys as each column default zod branch", () => {
    expect(SERIALIZED_FIELD_ORDER.columnDefault).toStrictEqual(
      Object.fromEntries(
        columnDefaultShape
          .unwrap()
          .options.map((option) => [
            option.shape.kind.value,
            Object.keys(option.shape),
          ]),
      ),
    );
  });
});
