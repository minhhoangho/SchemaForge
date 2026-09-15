import { describe, expect, it } from "vitest";

import { createEnumId } from "../../model/ids.js";
import type { ColumnType } from "../../model/column-type.js";
import type { SchemaDocument } from "../../model/schema-document.js";

import { isValidDefaultLiteral } from "./default-literals.js";

const NO_ENUMS: SchemaDocument["enums"] = {};

const STATUS_ENUM_ID = createEnumId(() => "status");
const ENUMS: SchemaDocument["enums"] = {
  [STATUS_ENUM_ID]: {
    id: STATUS_ENUM_ID,
    name: "status",
    values: ["active", "archived"],
  },
};

function acceptsAll(
  type: ColumnType,
  typeName: string,
  values: readonly string[],
  enums: SchemaDocument["enums"] = NO_ENUMS,
): void {
  it.each(values)(`accepts %j for ${typeName}`, (value) => {
    expect(isValidDefaultLiteral(type, value, enums)).toBe(true);
  });
}

function rejectsAll(
  type: ColumnType,
  typeName: string,
  values: readonly string[],
  enums: SchemaDocument["enums"] = NO_ENUMS,
): void {
  it.each(values)(`rejects %j for ${typeName}`, (value) => {
    expect(isValidDefaultLiteral(type, value, enums)).toBe(false);
  });
}

describe("isValidDefaultLiteral", () => {
  describe("smallint", () => {
    const type: ColumnType = { kind: "smallint" };
    acceptsAll(type, "smallint", ["32767", "-32768", "0"]);
    rejectsAll(type, "smallint", ["32768", "-32769", "01", "+1", "1.0", ""]);
  });

  describe("integer", () => {
    const type: ColumnType = { kind: "integer" };
    acceptsAll(type, "integer", ["2147483647", "-2147483648"]);
    rejectsAll(type, "integer", ["2147483648", "-2147483649"]);
  });

  describe("bigint", () => {
    const type: ColumnType = { kind: "bigint" };
    acceptsAll(type, "bigint", ["9223372036854775807", "-9223372036854775808"]);
    rejectsAll(type, "bigint", ["9223372036854775808", "-9223372036854775809"]);
  });

  describe("decimal(3, 2)", () => {
    const type: ColumnType = { kind: "decimal", precision: 3, scale: 2 };
    acceptsAll(type, "decimal(3, 2)", ["9.99", "0.5", "-1.25", "007.5"]);
    rejectsAll(type, "decimal(3, 2)", [
      "10.0",
      "1.234",
      "1.",
      ".5",
      "1e2",
      "abc",
    ]);
  });

  describe("decimal(2, 3)", () => {
    const type: ColumnType = { kind: "decimal", precision: 2, scale: 3 };
    acceptsAll(type, "decimal(2, 3)", ["12.3456"]);
    rejectsAll(type, "decimal(2, 3)", ["1e2", ""]);
  });

  describe("real", () => {
    const type: ColumnType = { kind: "real" };
    acceptsAll(type, "real", ["1.5e-3", "-2"]);
    rejectsAll(type, "real", ["NaN", "Infinity", "1,5"]);
  });

  describe("double", () => {
    const type: ColumnType = { kind: "double" };
    acceptsAll(type, "double", ["1.5e-3", "-2"]);
    rejectsAll(type, "double", ["NaN", "Infinity"]);
  });

  describe("boolean", () => {
    const type: ColumnType = { kind: "boolean" };
    acceptsAll(type, "boolean", ["true", "false"]);
    rejectsAll(type, "boolean", ["TRUE", "1", ""]);
  });

  describe("varchar(3)", () => {
    const type: ColumnType = { kind: "varchar", length: 3 };
    acceptsAll(type, "varchar(3)", ["ệệệ", ""]);
    rejectsAll(type, "varchar(3)", ["abcd"]);
  });

  describe("char(2)", () => {
    const type: ColumnType = { kind: "char", length: 2 };
    acceptsAll(type, "char(2)", ["ab"]);
    rejectsAll(type, "char(2)", ["abc"]);
  });

  describe("text", () => {
    const type: ColumnType = { kind: "text" };
    acceptsAll(type, "text", ["anything", ""]);
  });

  describe("custom", () => {
    const type: ColumnType = { kind: "custom", name: "money" };
    acceptsAll(type, "custom", ["anything", ""]);
  });

  describe("uuid", () => {
    const type: ColumnType = { kind: "uuid" };
    acceptsAll(type, "uuid", [
      "123e4567-e89b-12d3-a456-426614174000",
      "123E4567-E89B-12D3-A456-426614174000",
    ]);
    rejectsAll(type, "uuid", ["123e4567-e89b-12d3-a456", "not-a-uuid", ""]);
  });

  describe("date", () => {
    const type: ColumnType = { kind: "date" };
    acceptsAll(type, "date", ["2024-02-29", "0001-01-01", "9999-12-31"]);
    rejectsAll(type, "date", [
      "2023-02-29",
      "1900-02-29",
      "2024-13-01",
      "2024-04-31",
      "0000-01-01",
      "2024-1-01",
    ]);
  });

  describe("time", () => {
    const type: ColumnType = { kind: "time" };
    acceptsAll(type, "time", ["23:59:59", "00:00:00.123456"]);
    rejectsAll(type, "time", ["24:00:00", "12:60:00", "12:00"]);
  });

  describe("timestamp", () => {
    const type: ColumnType = { kind: "timestamp" };
    acceptsAll(type, "timestamp", ["2024-02-29T13:45:00"]);
    rejectsAll(type, "timestamp", [
      "2024-02-29 13:45:00",
      "2024-02-29T13:45:00Z",
      "2023-02-29T13:45:00",
    ]);
  });

  describe("timestamptz", () => {
    const type: ColumnType = { kind: "timestamptz" };
    acceptsAll(type, "timestamptz", [
      "2024-02-29T13:45:00Z",
      "2024-02-29T13:45:00.5+07:00",
    ]);
    rejectsAll(type, "timestamptz", [
      "2024-02-29T13:45:00",
      "2024-02-29T13:45:00+24:00",
      "2024-02-29 13:45:00Z",
    ]);
  });

  describe("json", () => {
    const type: ColumnType = { kind: "json" };
    acceptsAll(type, "json", ['{"a":1}', "[]", '"text"', "null"]);
    rejectsAll(type, "json", ["{a:1}", ""]);
  });

  describe("binary", () => {
    const type: ColumnType = { kind: "binary" };
    rejectsAll(type, "binary", ["anything", "", "0"]);
  });

  describe("enum", () => {
    const type: ColumnType = { kind: "enum", enumId: STATUS_ENUM_ID };
    acceptsAll(type, "enum", ["active", "archived"], ENUMS);
    rejectsAll(type, "enum", ["Active", "deleted", ""], ENUMS);
  });
});
