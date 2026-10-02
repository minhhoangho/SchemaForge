import { describe, expect, it } from "vitest";

import type { ColumnType } from "../../model/column-type.js";
import { buildSchema, makeEnum } from "../../testing/factories.js";
import { isValidDefaultLiteral } from "../../validation/rules/default-literals.js";
import type { JsonFieldType, JsonValue } from "./json-representation.js";
import {
  BASE64_PATTERN,
  BIGINT_STRING_PATTERN,
  LOCAL_DATE_TIME_PATTERN,
  TIME_PATTERN,
  decimalStringPattern,
  isValidJsonValue,
  toJsonFieldType,
} from "./json-representation.js";

const ENUMS = buildSchema({
  enums: [makeEnum({ id: "enum_status", values: ["active", "archived"] })],
}).enums;

const STATUS: ColumnType = { kind: "enum", enumId: "enum_status" };
const DECIMAL_3_2: ColumnType = { kind: "decimal", precision: 3, scale: 2 };

describe("toJsonFieldType", () => {
  it.each<{ type: ColumnType; expected: JsonFieldType }>([
    { type: { kind: "smallint" }, expected: { kind: "smallint" } },
    { type: { kind: "integer" }, expected: { kind: "int32" } },
    { type: { kind: "bigint" }, expected: { kind: "bigintString" } },
    {
      type: DECIMAL_3_2,
      expected: { kind: "decimalString", precision: 3, scale: 2 },
    },
    { type: { kind: "real" }, expected: { kind: "float" } },
    { type: { kind: "double" }, expected: { kind: "double" } },
    { type: { kind: "boolean" }, expected: { kind: "boolean" } },
    {
      type: { kind: "char", length: 2 },
      expected: { kind: "string", maxLength: 2 },
    },
    {
      type: { kind: "varchar", length: 255 },
      expected: { kind: "string", maxLength: 255 },
    },
    { type: { kind: "text" }, expected: { kind: "string", maxLength: null } },
    { type: { kind: "uuid" }, expected: { kind: "uuid" } },
    { type: { kind: "date" }, expected: { kind: "date" } },
    { type: { kind: "time" }, expected: { kind: "time" } },
    { type: { kind: "timestamp" }, expected: { kind: "localDateTime" } },
    { type: { kind: "timestamptz" }, expected: { kind: "offsetDateTime" } },
    { type: { kind: "json" }, expected: { kind: "json" } },
    { type: { kind: "binary" }, expected: { kind: "base64" } },
    { type: STATUS, expected: { kind: "enum", enumId: "enum_status" } },
    {
      type: { kind: "custom", name: "inet" },
      expected: { kind: "unknown" },
    },
  ])(
    "maps every column type to its json field type ($type.kind)",
    ({ type, expected }) => {
      expect(toJsonFieldType(type)).toStrictEqual(expected);
    },
  );
});

describe("isValidJsonValue", () => {
  it.each<{ type: ColumnType; value: JsonValue }>([
    { type: { kind: "smallint" }, value: -32768 },
    { type: { kind: "smallint" }, value: 32767 },
    { type: { kind: "integer" }, value: 2147483647 },
    { type: { kind: "bigint" }, value: "9223372036854775807" },
    { type: DECIMAL_3_2, value: "-1.25" },
    { type: { kind: "real" }, value: 1.5 },
    { type: { kind: "double" }, value: -2 },
    { type: { kind: "boolean" }, value: false },
    { type: { kind: "varchar", length: 2 }, value: "ab" },
    { type: { kind: "text" }, value: "" },
    { type: { kind: "uuid" }, value: "123e4567-e89b-12d3-a456-426614174000" },
    { type: { kind: "date" }, value: "2024-02-29" },
    { type: { kind: "time" }, value: "23:59:59.5" },
    { type: { kind: "timestamp" }, value: "2024-01-31T12:30:00" },
    { type: { kind: "timestamptz" }, value: "2024-01-31T12:30:00+07:00" },
    { type: { kind: "json" }, value: { tags: ["a", 1, false, null] } },
    { type: { kind: "binary" }, value: "aGVsbG8=" },
    { type: STATUS, value: "archived" },
    { type: { kind: "custom", name: "inet" }, value: "10.0.0.1" },
  ])(
    "accepts json values by column type ($type.kind, $value)",
    ({ type, value }) => {
      expect(isValidJsonValue(type, value, ENUMS)).toBe(true);
    },
  );

  it.each<{ type: ColumnType; value: JsonValue }>([
    { type: { kind: "smallint" }, value: 32768 },
    { type: { kind: "smallint" }, value: "1" },
    { type: { kind: "integer" }, value: 1.5 },
    { type: { kind: "integer" }, value: 2147483648 },
    { type: { kind: "bigint" }, value: 1 },
    { type: DECIMAL_3_2, value: "10.0" },
    { type: { kind: "real" }, value: "1.5" },
    { type: { kind: "double" }, value: true },
    { type: { kind: "boolean" }, value: "true" },
    { type: { kind: "varchar", length: 2 }, value: "abc" },
    { type: { kind: "uuid" }, value: "123e4567-e89b-12d3-a456" },
    { type: { kind: "date" }, value: "2023-02-29" },
    { type: { kind: "timestamp" }, value: "2024-01-31T12:30:00Z" },
    { type: { kind: "binary" }, value: "not base64!" },
    { type: STATUS, value: "Active" },
  ])(
    "rejects json values by column type ($type.kind, $value)",
    ({ type, value }) => {
      expect(isValidJsonValue(type, value, ENUMS)).toBe(false);
    },
  );

  it.each<ColumnType>([
    { kind: "integer" },
    { kind: "text" },
    { kind: "json" },
    { kind: "custom", name: "inet" },
  ])(
    "treats null as invalid so callers check nullability first ($kind)",
    (type) => {
      expect(isValidJsonValue(type, null, ENUMS)).toBe(false);
    },
  );
});

describe("decimalStringPattern", () => {
  it.each<{ precision: number; scale: number; value: string }>([
    { precision: 3, scale: 2, value: "9.99" },
    { precision: 3, scale: 2, value: "0.5" },
    { precision: 3, scale: 2, value: "-1.25" },
    { precision: 3, scale: 2, value: "007.5" },
    { precision: 3, scale: 2, value: "10.0" },
    { precision: 3, scale: 2, value: "1.234" },
    { precision: 3, scale: 2, value: "1." },
    { precision: 3, scale: 2, value: ".5" },
    { precision: 3, scale: 2, value: "1e2" },
    { precision: 2, scale: 2, value: "0" },
    { precision: 2, scale: 2, value: "0.5" },
    { precision: 2, scale: 2, value: "-0.12" },
    { precision: 2, scale: 2, value: "00.5" },
    { precision: 2, scale: 2, value: "1.0" },
    { precision: 2, scale: 2, value: "0.123" },
    { precision: 2, scale: 3, value: "12.3456" },
    { precision: 5, scale: 0, value: "12345" },
    { precision: 5, scale: 0, value: "1.0" },
  ])(
    "builds a decimal pattern that agrees with isValidDefaultLiteral (decimal($precision, $scale), $value)",
    ({ precision, scale, value }) => {
      const pattern = new RegExp(decimalStringPattern(precision, scale));

      expect(pattern.test(value)).toBe(
        isValidDefaultLiteral({ kind: "decimal", precision, scale }, value, {}),
      );
    },
  );

  it.each([
    { precision: 3, scale: 2, expected: "^-?0*[0-9]{1,1}(\\.[0-9]{1,2})?$" },
    { precision: 5, scale: 0, expected: "^-?0*[0-9]{1,5}$" },
    { precision: 2, scale: 2, expected: "^-?0+(\\.[0-9]{1,2})?$" },
    { precision: 2, scale: 3, expected: "^-?[0-9]+(\\.[0-9]+)?$" },
  ])(
    "builds the decimal pattern for decimal($precision, $scale)",
    ({ precision, scale, expected }) => {
      expect(decimalStringPattern(precision, scale)).toBe(expected);
    },
  );
});

describe("json string patterns", () => {
  it.each([
    { value: "0", isMatch: true },
    { value: "-42", isMatch: true },
    { value: "9223372036854775807", isMatch: true },
    { value: "+1", isMatch: false },
    { value: "007", isMatch: false },
    { value: "1.0", isMatch: false },
  ])(
    "matches bigint strings but not a plus sign or leading zeros ($value)",
    ({ value, isMatch }) => {
      expect(new RegExp(BIGINT_STRING_PATTERN).test(value)).toBe(isMatch);
    },
  );

  it.each([
    { value: "2024-01-31T12:30:00", isMatch: true },
    { value: "2024-01-31T23:59:59.123456", isMatch: true },
    { value: "2024-01-31T12:30:00Z", isMatch: false },
    { value: "2024-01-31T12:30:00+07:00", isMatch: false },
    { value: "2024-01-31 12:30:00", isMatch: false },
    { value: "2024-01-31T24:00:00", isMatch: false },
  ])(
    "matches local date-times without a time zone ($value)",
    ({ value, isMatch }) => {
      expect(new RegExp(LOCAL_DATE_TIME_PATTERN).test(value)).toBe(isMatch);
    },
  );

  it.each([
    { value: "00:00:00", isMatch: true },
    { value: "23:59:59.5", isMatch: true },
    { value: "24:00:00", isMatch: false },
    { value: "12:30", isMatch: false },
  ])(
    "matches times of day with optional fractional seconds ($value)",
    ({ value, isMatch }) => {
      expect(new RegExp(TIME_PATTERN).test(value)).toBe(isMatch);
    },
  );

  it.each([
    { value: "", isMatch: true },
    { value: "aGk=", isMatch: true },
    { value: "aGVsbG8gd29ybGQ=", isMatch: true },
    { value: "aGk", isMatch: false },
    { value: "aG=k", isMatch: false },
  ])("matches padded base64 strings ($value)", ({ value, isMatch }) => {
    expect(new RegExp(BASE64_PATTERN).test(value)).toBe(isMatch);
  });
});
