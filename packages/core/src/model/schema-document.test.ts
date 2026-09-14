import { describe, expect, expectTypeOf, it } from "vitest";

import type { TableId } from "./ids.js";
import { schemaDocumentShape } from "./schema-document.js";
import type { IdMap, SchemaDocument } from "./schema-document.js";
import type { Table } from "./table.js";

const EMPTY_DOCUMENT = {
  version: 1,
  name: "Blog",
  tables: {},
  columns: {},
  relations: {},
  indexes: {},
  enums: {},
  subjectAreas: {},
  notes: {},
};

const TABLE = {
  id: "tbl_1",
  name: "users",
  comment: "",
  position: { x: 0, y: 0 },
  subjectAreaId: null,
  columnIds: ["col_1"],
  primaryKeyColumnIds: [],
};

describe("schemaDocumentShape", () => {
  it("accepts a document with all seven empty maps", () => {
    expect(schemaDocumentShape.safeParse(EMPTY_DOCUMENT).data).toStrictEqual(
      EMPTY_DOCUMENT,
    );
  });

  it("rejects a document with a newer version literal", () => {
    expect(
      schemaDocumentShape.safeParse({ ...EMPTY_DOCUMENT, version: 2 }).success,
    ).toBe(false);
  });

  it("rejects a document missing the notes map", () => {
    const documentWithoutNotes = {
      version: 1,
      name: "Blog",
      tables: {},
      columns: {},
      relations: {},
      indexes: {},
      enums: {},
      subjectAreas: {},
    };

    expect(schemaDocumentShape.safeParse(documentWithoutNotes).success).toBe(
      false,
    );
  });

  it("rejects a map key that is not an id of that element kind", () => {
    expect(
      schemaDocumentShape.safeParse({
        ...EMPTY_DOCUMENT,
        tables: { col_1: TABLE },
      }).success,
    ).toBe(false);
  });

  it("freezes the parsed document and its nested arrays", () => {
    const document = schemaDocumentShape.parse({
      ...EMPTY_DOCUMENT,
      tables: { tbl_1: TABLE },
    });
    const table = document.tables.tbl_1;

    expect(table?.columnIds).toStrictEqual(["col_1"]);
    expect([
      Object.isFrozen(document),
      Object.isFrozen(document.tables),
      Object.isFrozen(table),
      Object.isFrozen(table?.columnIds),
    ]).toStrictEqual([true, true, true, true]);
  });

  it("infers tables as IdMap of TableId to Table", () => {
    expectTypeOf<SchemaDocument["tables"]>().toEqualTypeOf<
      IdMap<TableId, Table>
    >();
  });
});
