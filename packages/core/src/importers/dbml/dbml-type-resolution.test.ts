import { describe, expect, it } from "vitest";

import { resolveDbmlType, toDbmlDatabaseType } from "./dbml-type-resolution.js";

const ENUM_NAME_KEYS: ReadonlySet<string> = new Set(["status", "money"]);

function resolve(rawType: string, isQuoted: boolean) {
  return resolveDbmlType({
    rawType,
    isQuoted,
    enumNameKeys: ENUM_NAME_KEYS,
    databaseType: "postgresql",
  });
}

describe("resolveDbmlType", () => {
  it.each([
    {
      rawType: "Status",
      type: { kind: "enum", enumName: "Status" },
    },
    {
      rawType: "varchar(255)",
      type: { kind: "custom", name: "varchar(255)" },
    },
    {
      rawType: "geometry(Point, 4326)",
      type: { kind: "custom", name: "geometry(Point, 4326)" },
    },
  ] as const)(
    "resolves a quoted type to an enum or a verbatim custom type ($rawType)",
    ({ rawType, type }) => {
      expect(resolve(rawType, true)).toStrictEqual({
        type,
        isAutoIncrement: false,
        codes: [],
      });
    },
  );

  it.each([
    { rawType: "smallint", type: { kind: "smallint" } },
    { rawType: "integer", type: { kind: "integer" } },
    { rawType: "bigint", type: { kind: "bigint" } },
    {
      rawType: "decimal(12,2)",
      type: { kind: "decimal", precision: 12, scale: 2 },
    },
    { rawType: "real", type: { kind: "real" } },
    { rawType: "double", type: { kind: "double" } },
    { rawType: "boolean", type: { kind: "boolean" } },
    { rawType: "char(3)", type: { kind: "char", length: 3 } },
    { rawType: "varchar(255)", type: { kind: "varchar", length: 255 } },
    { rawType: "text", type: { kind: "text" } },
    { rawType: "uuid", type: { kind: "uuid" } },
    { rawType: "date", type: { kind: "date" } },
    { rawType: "time", type: { kind: "time" } },
    { rawType: "timestamp", type: { kind: "timestamp" } },
    { rawType: "timestamptz", type: { kind: "timestamptz" } },
    { rawType: "json", type: { kind: "json" } },
    { rawType: "binary", type: { kind: "binary" } },
  ] as const)(
    "resolves an unquoted generic type name as written by generateDbml ($rawType)",
    ({ rawType, type }) => {
      expect(
        resolveDbmlType({
          rawType,
          isQuoted: false,
          enumNameKeys: ENUM_NAME_KEYS,
          databaseType: "mysql",
        }),
      ).toStrictEqual({ type, isAutoIncrement: false, codes: [] });
    },
  );

  it("resolves an unquoted enum name before the sql mapping", () => {
    expect(resolve("money", false)).toStrictEqual({
      type: { kind: "enum", enumName: "money" },
      isAutoIncrement: false,
      codes: [],
    });
  });

  it.each([
    {
      rawType: "int4",
      databaseType: "postgresql",
      expected: {
        type: { kind: "integer" },
        isAutoIncrement: false,
        codes: [],
      },
    },
    {
      rawType: "serial",
      databaseType: "postgresql",
      expected: { type: { kind: "integer" }, isAutoIncrement: true, codes: [] },
    },
    {
      rawType: "tinyint(1)",
      databaseType: "mysql",
      expected: {
        type: { kind: "boolean" },
        isAutoIncrement: false,
        codes: [],
      },
    },
    {
      rawType: "nvarchar(50)",
      databaseType: "sqlserver",
      expected: {
        type: { kind: "varchar", length: 50 },
        isAutoIncrement: false,
        codes: [],
      },
    },
  ] as const)(
    "resolves an unquoted native type through the sql mapping of the database type ($rawType, $databaseType)",
    ({ rawType, databaseType, expected }) => {
      expect(
        resolveDbmlType({
          rawType,
          isQuoted: false,
          enumNameKeys: ENUM_NAME_KEYS,
          databaseType,
        }),
      ).toStrictEqual(expected);
    },
  );

  it("keeps an unknown unquoted type with a safe name as custom", () => {
    expect(resolve("tsvector", false)).toStrictEqual({
      type: { kind: "custom", name: "tsvector" },
      isAutoIncrement: false,
      codes: [],
    });
  });

  it("maps an unsafe unknown type to text with type-not-supported", () => {
    expect(resolve("int NOT NULL", false)).toStrictEqual({
      type: { kind: "text" },
      isAutoIncrement: false,
      codes: ["type-not-supported"],
    });
  });

  it.each([
    { rawType: "decimal(0,0)" },
    { rawType: "varchar(0)" },
    { rawType: "char(0)" },
    { rawType: "varchar(99999999999999999999)" },
    { rawType: "decimal(99999999999999999999,2)" },
  ])(
    "keeps a generic name with arguments outside the model as custom ($rawType)",
    ({ rawType }) => {
      expect(resolve(rawType, false)).toStrictEqual({
        type: { kind: "custom", name: rawType },
        isAutoIncrement: false,
        codes: [],
      });
    },
  );
});

describe("toDbmlDatabaseType", () => {
  it.each([
    { databaseType: "PostgreSQL", expected: "postgresql" },
    { databaseType: "MySQL", expected: "mysql" },
    { databaseType: "SQL Server", expected: "sqlserver" },
  ] as const)(
    "reads the project database type $databaseType",
    ({ databaseType, expected }) => {
      expect(toDbmlDatabaseType(databaseType)).toBe(expected);
    },
  );

  it.each([{ databaseType: "Oracle" }, { databaseType: null }])(
    "falls back to postgresql for an unknown database type ($databaseType)",
    ({ databaseType }) => {
      expect(toDbmlDatabaseType(databaseType)).toBe("postgresql");
    },
  );
});
