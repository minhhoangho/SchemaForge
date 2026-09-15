import { describe, expect, it } from "vitest";

import type { ColumnPair } from "../model/relation.js";

import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeIndex,
  makeNote,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "./factories.js";

describe("createCounterIdGenerator", () => {
  it("returns ids 1, 2 and 3 from a new counter generator", () => {
    const generateId = createCounterIdGenerator();

    expect([generateId(), generateId(), generateId()]).toStrictEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("starts every counter generator from 1", () => {
    const first = createCounterIdGenerator();
    first();
    first();
    const second = createCounterIdGenerator();

    expect(second()).toBe("1");
  });
});

describe("makeTable", () => {
  it("derives the default name from the id without its prefix", () => {
    expect(makeTable({ id: "tbl_order_items" }).name).toBe("order_items");
  });

  it("applies overrides on top of the table defaults", () => {
    expect(
      makeTable({
        id: "tbl_1",
        comment: "primary table",
        subjectAreaId: "area_1",
      }),
    ).toStrictEqual({
      id: "tbl_1",
      name: "1",
      comment: "primary table",
      position: { x: 0, y: 0 },
      subjectAreaId: "area_1",
      primaryKeyColumnIds: [],
      columnIds: [],
    });
  });
});

describe("makeColumn", () => {
  it("creates an integer, non-nullable column by default", () => {
    expect(makeColumn({ id: "col_email", tableId: "tbl_1" })).toStrictEqual({
      id: "col_email",
      tableId: "tbl_1",
      name: "email",
      type: { kind: "integer" },
      isNullable: false,
      defaultValue: null,
      isUnique: false,
      isAutoIncrement: false,
      comment: "",
    });
  });
});

describe("makeRelation", () => {
  it("creates a one-to-many relation with noAction by default", () => {
    const columnPairs: readonly ColumnPair[] = [
      { fromColumnId: "col_1", toColumnId: "col_2" },
    ];

    expect(
      makeRelation({
        id: "rel_1",
        fromTableId: "tbl_1",
        toTableId: "tbl_2",
        columnPairs,
      }),
    ).toStrictEqual({
      id: "rel_1",
      kind: "oneToMany",
      fromTableId: "tbl_1",
      toTableId: "tbl_2",
      columnPairs,
      onDelete: "noAction",
      onUpdate: "noAction",
    });
  });
});

describe("makeIndex", () => {
  it("creates a non-unique index with a name derived from the id by default", () => {
    expect(
      makeIndex({
        id: "idx_users_email",
        tableId: "tbl_1",
        columnIds: ["col_1"],
      }),
    ).toStrictEqual({
      id: "idx_users_email",
      tableId: "tbl_1",
      columnIds: ["col_1"],
      name: "users_email",
      isUnique: false,
    });
  });
});

describe("makeEnum", () => {
  it("creates an enum with one active value by default", () => {
    expect(makeEnum({ id: "enum_status" })).toStrictEqual({
      id: "enum_status",
      name: "status",
      values: ["active"],
    });
  });
});

describe("makeSubjectArea", () => {
  it("derives the subject area name from the id by default", () => {
    expect(makeSubjectArea({ id: "area_billing" })).toStrictEqual({
      id: "area_billing",
      name: "billing",
    });
  });
});

describe("makeNote", () => {
  it("creates a note with default text and position", () => {
    expect(makeNote({ id: "note_1" })).toStrictEqual({
      id: "note_1",
      text: "note",
      position: { x: 0, y: 0 },
    });
  });
});

describe("buildSchema", () => {
  it("uses test as the default schema name", () => {
    expect(buildSchema({}).name).toBe("test");
  });

  it("builds a document containing every given element keyed by id", () => {
    const subjectArea = makeSubjectArea({ id: "area_1" });
    const table = makeTable({
      id: "tbl_1",
      subjectAreaId: "area_1",
      primaryKeyColumnIds: ["col_1"],
    });
    const column = makeColumn({ id: "col_1", tableId: "tbl_1" });
    const relation = makeRelation({
      id: "rel_1",
      fromTableId: "tbl_1",
      toTableId: "tbl_1",
      columnPairs: [{ fromColumnId: "col_1", toColumnId: "col_1" }],
    });
    const index = makeIndex({
      id: "idx_1",
      tableId: "tbl_1",
      columnIds: ["col_1"],
    });
    const enumElement = makeEnum({ id: "enum_1" });
    const note = makeNote({ id: "note_1" });

    const schema = buildSchema({
      subjectAreas: [subjectArea],
      tables: [table],
      columns: [column],
      relations: [relation],
      indexes: [index],
      enums: [enumElement],
      notes: [note],
    });

    expect(schema.subjectAreas).toStrictEqual({ area_1: subjectArea });
    expect(schema.tables).toStrictEqual({
      tbl_1: { ...table, columnIds: ["col_1"] },
    });
    expect(schema.columns).toStrictEqual({ col_1: column });
    expect(schema.relations).toStrictEqual({ rel_1: relation });
    expect(schema.indexes).toStrictEqual({ idx_1: index });
    expect(schema.enums).toStrictEqual({ enum_1: enumElement });
    expect(schema.notes).toStrictEqual({ note_1: note });
  });

  it("derives table columnIds from the order of the columns array", () => {
    const table = makeTable({ id: "tbl_1" });
    const columnB = makeColumn({ id: "col_b", tableId: "tbl_1" });
    const columnA = makeColumn({ id: "col_a", tableId: "tbl_1" });

    const schema = buildSchema({
      tables: [table],
      columns: [columnB, columnA],
    });

    expect(schema.tables.tbl_1?.columnIds).toStrictEqual(["col_b", "col_a"]);
  });

  it("throws when two elements of the same kind share an id", () => {
    expect(() =>
      buildSchema({
        tables: [
          makeTable({ id: "tbl_1" }),
          makeTable({ id: "tbl_1", comment: "dup" }),
        ],
      }),
    ).toThrow(Error);
  });

  it("throws with the structural error codes when the document is invalid", () => {
    expect(() =>
      buildSchema({
        tables: [
          makeTable({ id: "tbl_1", primaryKeyColumnIds: ["col_missing"] }),
        ],
      }),
    ).toThrow(/column-not-found/);
  });
});
