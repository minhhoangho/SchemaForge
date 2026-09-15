import { describe, expect, it } from "vitest";

import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeSubjectArea,
  makeTable,
} from "../../testing/factories.js";

import { validateNames } from "./names.js";

describe("validateNames", () => {
  it("returns no issues for distinct valid names", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: "users" })],
      columns: [makeColumn({ id: "col_1", tableId: "tbl_1", name: "id" })],
      enums: [makeEnum({ id: "enum_1", name: "status" })],
      indexes: [
        makeIndex({
          id: "idx_1",
          tableId: "tbl_1",
          columnIds: ["col_1"],
          name: "users_id_idx",
        }),
      ],
      subjectAreas: [makeSubjectArea({ id: "area_1", name: "core" })],
    });

    expect(validateNames(schema)).toStrictEqual([]);
  });

  it("reports name-empty for an empty table name", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: "" })],
    });

    expect(validateNames(schema)).toContainEqual({
      code: "name-empty",
      path: ["tables", "tbl_1", "name"],
    });
  });

  it("reports only name-empty for an empty name", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: "" })],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "name-empty", path: ["tables", "tbl_1", "name"] },
    ]);
  });

  it("reports name-empty for an empty schema name at the name path", () => {
    const schema = buildSchema({ name: "" });

    expect(validateNames(schema)).toStrictEqual([
      { code: "name-empty", path: ["name"] },
    ]);
  });

  it("does not report name-invalid for a schema name with surrounding spaces", () => {
    const schema = buildSchema({ name: " padded " });

    expect(validateNames(schema)).toStrictEqual([]);
  });

  it("reports name-invalid for a leading space", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: " users" })],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "name-invalid", path: ["tables", "tbl_1", "name"] },
    ]);
  });

  it("reports name-invalid for a trailing space", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: "users " })],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "name-invalid", path: ["tables", "tbl_1", "name"] },
    ]);
  });

  it("reports name-invalid for a tab inside the name", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: "us\ters" })],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "name-invalid", path: ["tables", "tbl_1", "name"] },
    ]);
  });

  it("reports name-invalid for the DEL character", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: "us\x7Fer" })],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "name-invalid", path: ["tables", "tbl_1", "name"] },
    ]);
  });

  it("accepts a name with an inner space and Vietnamese letters", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: "Đơn hàng" })],
    });

    expect(validateNames(schema)).toStrictEqual([]);
  });

  it("accepts a name that is an SQL keyword", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: "user" })],
    });

    expect(validateNames(schema)).toStrictEqual([]);
  });

  it("accepts a 63-byte name made of Vietnamese letters", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: "ệ".repeat(21) })],
    });

    expect(validateNames(schema)).toStrictEqual([]);
  });

  it("reports name-too-long for a 64-byte name", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: `${"ệ".repeat(21)}a` })],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "name-too-long", path: ["tables", "tbl_1", "name"] },
    ]);
  });

  it("reports both name-invalid and name-too-long when both apply", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: ` ${"ệ".repeat(21)}` })],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "name-invalid", path: ["tables", "tbl_1", "name"] },
      { code: "name-too-long", path: ["tables", "tbl_1", "name"] },
    ]);
  });

  it("reports name issues on enum values at the value index path", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_1", values: ["active", " paused", ""] })],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "name-invalid", path: ["enums", "enum_1", "values", 1] },
      { code: "name-empty", path: ["enums", "enum_1", "values", 2] },
    ]);
  });

  it("checks column, index and subject area names", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1" })],
      columns: [makeColumn({ id: "col_1", tableId: "tbl_1", name: " email" })],
      indexes: [
        makeIndex({
          id: "idx_1",
          tableId: "tbl_1",
          columnIds: ["col_1"],
          name: " idx",
        }),
      ],
      subjectAreas: [makeSubjectArea({ id: "area_1", name: " billing" })],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "name-invalid", path: ["columns", "col_1", "name"] },
      { code: "name-invalid", path: ["indexes", "idx_1", "name"] },
      { code: "name-invalid", path: ["subjectAreas", "area_1", "name"] },
    ]);
  });

  it("reports table-name-duplicate on both tables whose names differ only in case", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "Users" }),
        makeTable({ id: "tbl_2", name: "users" }),
      ],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "table-name-duplicate", path: ["tables", "tbl_1", "name"] },
      { code: "table-name-duplicate", path: ["tables", "tbl_2", "name"] },
    ]);
  });

  it("reports a duplicate on every member of a group of three", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "same" }),
        makeTable({ id: "tbl_2", name: "same" }),
        makeTable({ id: "tbl_3", name: "same" }),
      ],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "table-name-duplicate", path: ["tables", "tbl_1", "name"] },
      { code: "table-name-duplicate", path: ["tables", "tbl_2", "name"] },
      { code: "table-name-duplicate", path: ["tables", "tbl_3", "name"] },
    ]);
  });

  it("reports enum-name-duplicate on both enums with the same name", () => {
    const schema = buildSchema({
      enums: [
        makeEnum({ id: "enum_1", name: "status" }),
        makeEnum({ id: "enum_2", name: "status" }),
      ],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "enum-name-duplicate", path: ["enums", "enum_1", "name"] },
      { code: "enum-name-duplicate", path: ["enums", "enum_2", "name"] },
    ]);
  });

  it("reports enum-name-duplicate on the enum and table-name-duplicate on the table when they share a name", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: "User" })],
      enums: [makeEnum({ id: "enum_1", name: "user" })],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "enum-name-duplicate", path: ["enums", "enum_1", "name"] },
      { code: "table-name-duplicate", path: ["tables", "tbl_1", "name"] },
    ]);
  });

  it("reports column-name-duplicate within one table", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1" })],
      columns: [
        makeColumn({ id: "col_1", tableId: "tbl_1", name: "Email" }),
        makeColumn({ id: "col_2", tableId: "tbl_1", name: "email" }),
      ],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "column-name-duplicate", path: ["columns", "col_1", "name"] },
      { code: "column-name-duplicate", path: ["columns", "col_2", "name"] },
    ]);
  });

  it("does not report columns with the same name in different tables", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1" }), makeTable({ id: "tbl_2" })],
      columns: [
        makeColumn({ id: "col_1", tableId: "tbl_1", name: "id" }),
        makeColumn({ id: "col_2", tableId: "tbl_2", name: "id" }),
      ],
    });

    expect(validateNames(schema)).toStrictEqual([]);
  });

  it("reports index-name-duplicate for indexes on different tables", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_1" }), makeTable({ id: "tbl_2" })],
      columns: [
        makeColumn({ id: "col_1", tableId: "tbl_1" }),
        makeColumn({ id: "col_2", tableId: "tbl_2" }),
      ],
      indexes: [
        makeIndex({
          id: "idx_1",
          tableId: "tbl_1",
          columnIds: ["col_1"],
          name: "by_name",
        }),
        makeIndex({
          id: "idx_2",
          tableId: "tbl_2",
          columnIds: ["col_2"],
          name: "by_name",
        }),
      ],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "index-name-duplicate", path: ["indexes", "idx_1", "name"] },
      { code: "index-name-duplicate", path: ["indexes", "idx_2", "name"] },
    ]);
  });

  it("reports subject-area-name-duplicate", () => {
    const schema = buildSchema({
      subjectAreas: [
        makeSubjectArea({ id: "area_1", name: "billing" }),
        makeSubjectArea({ id: "area_2", name: "billing" }),
      ],
    });

    expect(validateNames(schema)).toStrictEqual([
      {
        code: "subject-area-name-duplicate",
        path: ["subjectAreas", "area_1", "name"],
      },
      {
        code: "subject-area-name-duplicate",
        path: ["subjectAreas", "area_2", "name"],
      },
    ]);
  });

  it("does not treat two empty names as duplicates", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "" }),
        makeTable({ id: "tbl_2", name: "" }),
      ],
    });

    expect(validateNames(schema)).toStrictEqual([
      { code: "name-empty", path: ["tables", "tbl_1", "name"] },
      { code: "name-empty", path: ["tables", "tbl_2", "name"] },
    ]);
  });
});
