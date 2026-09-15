import { describe, expect, it } from "vitest";

import { CURRENT_SCHEMA_VERSION } from "../model/schema-document.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";

import { parseSchemaDocument } from "./parse-schema-document.js";

function makeColumn(
  id: string,
  tableId: string,
  columnType: Record<string, unknown>,
) {
  return {
    id,
    tableId,
    name: id,
    type: columnType,
    isNullable: false,
    defaultValue: null,
    isUnique: false,
    isAutoIncrement: false,
    comment: "",
  };
}

// A hand-written valid document covering all seven element kinds, a
// composite primary key (tbl_1) and a composite foreign key (rel_1).
function makeValidDocument() {
  return {
    version: CURRENT_SCHEMA_VERSION,
    name: "Blog",
    tables: {
      tbl_1: {
        id: "tbl_1",
        name: "users",
        comment: "",
        position: { x: 0, y: 0 },
        subjectAreaId: "area_1",
        columnIds: ["col_1", "col_2"],
        primaryKeyColumnIds: ["col_1", "col_2"],
      },
      tbl_2: {
        id: "tbl_2",
        name: "posts",
        comment: "",
        position: { x: 100, y: 0 },
        subjectAreaId: null,
        columnIds: ["col_3", "col_4", "col_5", "col_6"],
        primaryKeyColumnIds: ["col_3"],
      },
    },
    columns: {
      col_1: makeColumn("col_1", "tbl_1", { kind: "integer" }),
      col_2: makeColumn("col_2", "tbl_1", { kind: "integer" }),
      col_3: makeColumn("col_3", "tbl_2", { kind: "integer" }),
      col_4: makeColumn("col_4", "tbl_2", { kind: "integer" }),
      col_5: makeColumn("col_5", "tbl_2", { kind: "integer" }),
      col_6: makeColumn("col_6", "tbl_2", { kind: "enum", enumId: "enum_1" }),
    },
    relations: {
      rel_1: {
        id: "rel_1",
        kind: "oneToMany",
        fromTableId: "tbl_2",
        toTableId: "tbl_1",
        columnPairs: [
          { fromColumnId: "col_4", toColumnId: "col_1" },
          { fromColumnId: "col_5", toColumnId: "col_2" },
        ],
        onDelete: "cascade",
        onUpdate: "noAction",
      },
    },
    indexes: {
      idx_1: {
        id: "idx_1",
        tableId: "tbl_2",
        name: "idx_posts_user",
        columnIds: ["col_4", "col_5"],
        isUnique: false,
      },
    },
    enums: {
      enum_1: { id: "enum_1", name: "role", values: ["admin", "user"] },
    },
    subjectAreas: {
      area_1: { id: "area_1", name: "Core" },
    },
    notes: {
      note_1: { id: "note_1", text: "todo", position: { x: 0, y: 0 } },
    },
  };
}

// JSON.parse creates a genuine own "__proto__" property; the object-literal
// spelling `{ __proto__: x }` instead sets the prototype and never does.
function addOwnProtoKey(map: unknown): unknown {
  const json = JSON.stringify(map);
  return JSON.parse(`{"__proto__":{"id":"bogus"},${json.slice(1)}`);
}

function withIdMismatch() {
  const document = makeValidDocument();
  const { note_1, ...otherNotes } = document.notes;
  return { ...document, notes: { ...otherNotes, note_9: note_1 } };
}

function withOrphanColumn() {
  const document = makeValidDocument();
  return {
    ...document,
    columns: {
      ...document.columns,
      col_7: makeColumn("col_7", "tbl_missing", { kind: "integer" }),
    },
  };
}

function withMissingColumnInTable() {
  const document = makeValidDocument();
  return {
    ...document,
    tables: {
      ...document.tables,
      tbl_1: {
        ...document.tables.tbl_1,
        columnIds: [...document.tables.tbl_1.columnIds, "col_missing"],
      },
    },
  };
}

function withMissingEnum() {
  const document = makeValidDocument();
  return {
    ...document,
    columns: {
      ...document.columns,
      col_6: {
        ...document.columns.col_6,
        type: { kind: "enum", enumId: "enum_missing" },
      },
    },
  };
}

function withMissingSubjectArea() {
  const document = makeValidDocument();
  return {
    ...document,
    tables: {
      ...document.tables,
      tbl_2: { ...document.tables.tbl_2, subjectAreaId: "area_missing" },
    },
  };
}

function withPrimaryKeyColumnNotInTable() {
  const document = makeValidDocument();
  return {
    ...document,
    tables: {
      ...document.tables,
      tbl_1: {
        ...document.tables.tbl_1,
        primaryKeyColumnIds: [
          ...document.tables.tbl_1.primaryKeyColumnIds,
          "col_3",
        ],
      },
    },
  };
}

function withPrimaryKeyColumnListedTwice() {
  const document = makeValidDocument();
  return {
    ...document,
    tables: {
      ...document.tables,
      tbl_1: {
        ...document.tables.tbl_1,
        primaryKeyColumnIds: [
          ...document.tables.tbl_1.primaryKeyColumnIds,
          "col_1",
        ],
      },
    },
  };
}

function withColumnOwnershipMismatch() {
  const document = makeValidDocument();
  return {
    ...document,
    tables: {
      ...document.tables,
      tbl_1: { ...document.tables.tbl_1, columnIds: ["col_1"] },
    },
  };
}

const invariantCases = [
  {
    name: "id-mismatch",
    code: "id-mismatch",
    path: ["notes", "note_9", "id"],
    build: withIdMismatch,
  },
  {
    name: "table-not-found",
    code: "table-not-found",
    path: ["columns", "col_7", "tableId"],
    build: withOrphanColumn,
  },
  {
    name: "column-not-found",
    code: "column-not-found",
    path: ["tables", "tbl_1", "columnIds", 2],
    build: withMissingColumnInTable,
  },
  {
    name: "enum-not-found",
    code: "enum-not-found",
    path: ["columns", "col_6", "type", "enumId"],
    build: withMissingEnum,
  },
  {
    name: "subject-area-not-found",
    code: "subject-area-not-found",
    path: ["tables", "tbl_2", "subjectAreaId"],
    build: withMissingSubjectArea,
  },
  {
    name: "column-not-in-table",
    code: "column-not-in-table",
    path: ["tables", "tbl_1", "primaryKeyColumnIds", 2],
    build: withPrimaryKeyColumnNotInTable,
  },
  {
    name: "column-listed-twice",
    code: "column-listed-twice",
    path: ["tables", "tbl_1", "primaryKeyColumnIds", 2],
    build: withPrimaryKeyColumnListedTwice,
  },
  {
    name: "column-ownership-mismatch",
    code: "column-ownership-mismatch",
    path: ["tables", "tbl_1", "columnIds"],
    build: withColumnOwnershipMismatch,
  },
] as const;

describe("parseSchemaDocument", () => {
  it("returns the document for valid input", () => {
    const document = makeValidDocument();

    expect(unwrapOk(parseSchemaDocument(document))).toStrictEqual(document);
  });

  it("returns a document equal to its JSON round trip", () => {
    const parsed = unwrapOk(parseSchemaDocument(makeValidDocument()));
    const roundTripped: unknown = JSON.parse(JSON.stringify(parsed));

    expect(parsed).toStrictEqual(roundTripped);
  });

  it("returns a frozen document", () => {
    const parsed = unwrapOk(parseSchemaDocument(makeValidDocument()));

    expect(Object.isFrozen(parsed)).toBe(true);
  });

  it("returns invalid-shape at version when input is not an object", () => {
    expect(unwrapError(parseSchemaDocument("not-an-object"))).toStrictEqual([
      { code: "invalid-shape", path: ["version"] },
    ]);
  });

  it("returns invalid-shape at version when version is missing", () => {
    expect(unwrapError(parseSchemaDocument({ name: "Blog" }))).toStrictEqual([
      { code: "invalid-shape", path: ["version"] },
    ]);
  });

  it("returns invalid-shape at version when version is 0", () => {
    expect(unwrapError(parseSchemaDocument({ version: 0 }))).toStrictEqual([
      { code: "invalid-shape", path: ["version"] },
    ]);
  });

  it("returns invalid-shape at version when version is not an integer", () => {
    expect(unwrapError(parseSchemaDocument({ version: 1.5 }))).toStrictEqual([
      { code: "invalid-shape", path: ["version"] },
    ]);
  });

  it("returns version-unsupported when version is newer than the current version", () => {
    expect(
      unwrapError(parseSchemaDocument({ version: CURRENT_SCHEMA_VERSION + 1 })),
    ).toStrictEqual([{ code: "version-unsupported", path: ["version"] }]);
  });

  it("returns invalid-shape for an extra root field", () => {
    const brokenDocument = { ...makeValidDocument(), extraRoot: true };

    expect(unwrapError(parseSchemaDocument(brokenDocument))).toStrictEqual([
      { code: "invalid-shape", path: ["extraRoot"] },
    ]);
  });

  it("returns invalid-shape for an extra field on a table", () => {
    const document = makeValidDocument();
    const brokenDocument = {
      ...document,
      tables: {
        ...document.tables,
        tbl_1: { ...document.tables.tbl_1, extra: true },
      },
    };

    expect(unwrapError(parseSchemaDocument(brokenDocument))).toStrictEqual([
      { code: "invalid-shape", path: ["tables", "tbl_1", "extra"] },
    ]);
  });

  it("returns invalid-shape for an unknown column type kind", () => {
    const document = makeValidDocument();
    const brokenDocument = {
      ...document,
      columns: {
        ...document.columns,
        col_1: { ...document.columns.col_1, type: { kind: "bogus" } },
      },
    };

    expect(unwrapError(parseSchemaDocument(brokenDocument))).toStrictEqual([
      { code: "invalid-shape", path: ["columns", "col_1", "type", "kind"] },
    ]);
  });

  it("returns invalid-shape for a non-finite position", () => {
    const document = makeValidDocument();
    const brokenDocument = {
      ...document,
      tables: {
        ...document.tables,
        tbl_1: {
          ...document.tables.tbl_1,
          position: { x: Number.POSITIVE_INFINITY, y: 0 },
        },
      },
    };

    expect(unwrapError(parseSchemaDocument(brokenDocument))).toStrictEqual([
      { code: "invalid-shape", path: ["tables", "tbl_1", "position", "x"] },
    ]);
  });

  it("returns invalid-shape for an empty index column list", () => {
    const document = makeValidDocument();
    const brokenDocument = {
      ...document,
      indexes: {
        ...document.indexes,
        idx_1: { ...document.indexes.idx_1, columnIds: [] },
      },
    };

    expect(unwrapError(parseSchemaDocument(brokenDocument))).toStrictEqual([
      { code: "invalid-shape", path: ["indexes", "idx_1", "columnIds"] },
    ]);
  });

  it("returns invalid-shape for a malformed id key", () => {
    const document = makeValidDocument();
    const { tbl_1, ...otherTables } = document.tables;
    const brokenDocument = {
      ...document,
      tables: { ...otherTables, bogus: tbl_1 },
    };

    expect(unwrapError(parseSchemaDocument(brokenDocument))).toStrictEqual([
      { code: "invalid-shape", path: ["tables", "bogus"] },
    ]);
  });

  it("returns invalid-shape at tables __proto__ when a map has a __proto__ key", () => {
    const document = makeValidDocument();
    const brokenDocument = {
      ...document,
      tables: addOwnProtoKey(document.tables),
    };

    expect(unwrapError(parseSchemaDocument(brokenDocument))).toStrictEqual([
      { code: "invalid-shape", path: ["tables", "__proto__"] },
    ]);
  });

  it("returns invalid-shape for a constructor key in a map", () => {
    const document = makeValidDocument();
    const { enum_1, ...otherEnums } = document.enums;
    const brokenDocument = {
      ...document,
      enums: { ...otherEnums, constructor: enum_1 },
    };

    expect(unwrapError(parseSchemaDocument(brokenDocument))).toStrictEqual([
      { code: "invalid-shape", path: ["enums", "constructor"] },
    ]);
  });

  it.each(invariantCases)(
    "returns $code with the path of the offending element",
    ({ code, path, build }) => {
      expect(unwrapError(parseSchemaDocument(build()))).toStrictEqual([
        { code, path },
      ]);
    },
  );

  it("returns every invariant error sorted by path", () => {
    const document = withIdMismatch();
    const combinedDocument = {
      ...document,
      columns: {
        ...document.columns,
        col_7: makeColumn("col_7", "tbl_missing", { kind: "integer" }),
      },
    };

    expect(unwrapError(parseSchemaDocument(combinedDocument))).toStrictEqual([
      { code: "table-not-found", path: ["columns", "col_7", "tableId"] },
      { code: "id-mismatch", path: ["notes", "note_9", "id"] },
    ]);
  });

  it("does not report invariant errors when the shape is invalid", () => {
    const document = withOrphanColumn();
    const brokenDocument = {
      ...document,
      columns: {
        ...document.columns,
        col_1: { ...document.columns.col_1, type: { kind: "bogus" } },
      },
    };

    expect(unwrapError(parseSchemaDocument(brokenDocument))).toStrictEqual([
      { code: "invalid-shape", path: ["columns", "col_1", "type", "kind"] },
    ]);
  });

  it("ED-04 rejects an imported document whose index uses a column that does not exist", () => {
    const document = makeValidDocument();
    const brokenDocument = {
      ...document,
      indexes: {
        ...document.indexes,
        idx_1: {
          ...document.indexes.idx_1,
          columnIds: [...document.indexes.idx_1.columnIds, "col_missing"],
        },
      },
    };

    expect(unwrapError(parseSchemaDocument(brokenDocument))).toStrictEqual([
      { code: "column-not-found", path: ["indexes", "idx_1", "columnIds", 2] },
    ]);
  });
});
