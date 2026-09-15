import { describe, expect, it } from "vitest";

import { buildSchema, makeColumn, makeTable } from "../../testing/factories.js";

import { validateColumnDefaults } from "./column-defaults.js";

describe("validateColumnDefaults", () => {
  it("returns no issues for a column without a default", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [makeColumn({ id: "col_id", tableId: "tbl_users" })],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([]);
  });

  it("accepts currentTimestamp on a timestamp column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_created_at",
          tableId: "tbl_users",
          type: { kind: "timestamp" },
          defaultValue: { kind: "currentTimestamp" },
        }),
      ],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([]);
  });

  it("accepts currentTimestamp on a timestamptz column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_created_at",
          tableId: "tbl_users",
          type: { kind: "timestamptz" },
          defaultValue: { kind: "currentTimestamp" },
        }),
      ],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([]);
  });

  it("reports column-default-incompatible for currentTimestamp on a date column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_created_at",
          tableId: "tbl_users",
          type: { kind: "date" },
          defaultValue: { kind: "currentTimestamp" },
        }),
      ],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([
      {
        code: "column-default-incompatible",
        path: ["columns", "col_created_at", "defaultValue"],
      },
    ]);
  });

  it("accepts generateUuid on a uuid column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "uuid" },
          defaultValue: { kind: "generateUuid" },
        }),
      ],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([]);
  });

  it("reports column-default-incompatible for generateUuid on a varchar column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          type: { kind: "varchar", length: 36 },
          defaultValue: { kind: "generateUuid" },
        }),
      ],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([
      {
        code: "column-default-incompatible",
        path: ["columns", "col_id", "defaultValue"],
      },
    ]);
  });

  it("reports column-default-incompatible for a literal on a binary column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_files" })],
      columns: [
        makeColumn({
          id: "col_data",
          tableId: "tbl_files",
          type: { kind: "binary" },
          defaultValue: { kind: "literal", value: "" },
        }),
      ],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([
      {
        code: "column-default-incompatible",
        path: ["columns", "col_data", "defaultValue"],
      },
    ]);
  });

  it("reports column-default-invalid for a malformed literal at the defaultValue path", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_age",
          tableId: "tbl_users",
          type: { kind: "integer" },
          defaultValue: { kind: "literal", value: "not-a-number" },
        }),
      ],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([
      {
        code: "column-default-invalid",
        path: ["columns", "col_age", "defaultValue"],
      },
    ]);
  });

  it("accepts a literal that is one of the enum values", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_status",
          tableId: "tbl_users",
          type: { kind: "enum", enumId: "enum_status" },
          defaultValue: { kind: "literal", value: "active" },
        }),
      ],
      enums: [
        { id: "enum_status", name: "status", values: ["active", "archived"] },
      ],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([]);
  });

  it("reports column-default-invalid for a literal that differs from the enum value in case", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_status",
          tableId: "tbl_users",
          type: { kind: "enum", enumId: "enum_status" },
          defaultValue: { kind: "literal", value: "Active" },
        }),
      ],
      enums: [
        { id: "enum_status", name: "status", values: ["active", "archived"] },
      ],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([
      {
        code: "column-default-invalid",
        path: ["columns", "col_status", "defaultValue"],
      },
    ]);
  });

  it("reports column-default-invalid for a literal removed from the enum values", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_status",
          tableId: "tbl_users",
          type: { kind: "enum", enumId: "enum_status" },
          defaultValue: { kind: "literal", value: "deleted" },
        }),
      ],
      enums: [
        { id: "enum_status", name: "status", values: ["active", "archived"] },
      ],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([
      {
        code: "column-default-invalid",
        path: ["columns", "col_status", "defaultValue"],
      },
    ]);
  });

  it("returns issues sorted by path", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_b",
          tableId: "tbl_users",
          type: { kind: "integer" },
          defaultValue: { kind: "literal", value: "bad" },
        }),
        makeColumn({
          id: "col_a",
          tableId: "tbl_users",
          type: { kind: "integer" },
          defaultValue: { kind: "literal", value: "bad" },
        }),
      ],
    });

    expect(validateColumnDefaults(schema)).toStrictEqual([
      {
        code: "column-default-invalid",
        path: ["columns", "col_a", "defaultValue"],
      },
      {
        code: "column-default-invalid",
        path: ["columns", "col_b", "defaultValue"],
      },
    ]);
  });
});
