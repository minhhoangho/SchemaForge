import { describe, expect, it } from "vitest";

import { buildSchema, makeEnum } from "../../testing/factories.js";

import { validateEnums } from "./enums.js";

describe("validateEnums", () => {
  it("returns no issues for an enum with distinct values", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: ["active", "inactive"] })],
    });

    expect(validateEnums(schema)).toStrictEqual([]);
  });

  it("reports enum-values-empty for an enum without values", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: [] })],
    });

    expect(validateEnums(schema)).toStrictEqual([
      { code: "enum-values-empty", path: ["enums", "enum_status", "values"] },
    ]);
  });

  it("reports enum-value-duplicate on every value that differs only in case", () => {
    const schema = buildSchema({
      enums: [
        makeEnum({
          id: "enum_status",
          values: ["Active", "inactive", "active"],
        }),
      ],
    });

    expect(validateEnums(schema)).toStrictEqual([
      {
        code: "enum-value-duplicate",
        path: ["enums", "enum_status", "values", 0],
      },
      {
        code: "enum-value-duplicate",
        path: ["enums", "enum_status", "values", 2],
      },
    ]);
  });

  it("does not treat empty values as duplicates", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: ["", ""] })],
    });

    expect(validateEnums(schema)).toStrictEqual([]);
  });

  it("ED-05 reports an enum with no values", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: [] })],
    });

    expect(validateEnums(schema)).toStrictEqual([
      { code: "enum-values-empty", path: ["enums", "enum_status", "values"] },
    ]);
  });

  it("ED-05 reports an enum with duplicate values", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: ["active", "active"] })],
    });

    expect(validateEnums(schema)).toStrictEqual([
      {
        code: "enum-value-duplicate",
        path: ["enums", "enum_status", "values", 0],
      },
      {
        code: "enum-value-duplicate",
        path: ["enums", "enum_status", "values", 1],
      },
    ]);
  });
});
