import { describe, expect, it } from "vitest";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type { ImportDiagnosticCode } from "./import-diagnostic-codes.js";
import type { DraftColumnType } from "./import-draft.js";
import {
  mapSqlType,
  splitSqlServerIdentity,
  type SqlTypeMapping,
} from "./sql-type-mapping.js";

function map(
  rawType: string,
  dialect: SqlDialect,
  overrides: {
    enumNameKeys?: readonly string[];
    hasUuidDefault?: boolean;
  } = {},
): SqlTypeMapping {
  return mapSqlType({
    rawType,
    dialect,
    enumNameKeys: new Set(overrides.enumNameKeys ?? []),
    hasUuidDefault: overrides.hasUuidDefault ?? false,
  });
}

type TypeCase = readonly [
  dialect: SqlDialect,
  rawType: string,
  type: DraftColumnType,
  codes: readonly ImportDiagnosticCode[],
];

const APPROXIMATED = ["type-approximated"] as const;
const PARAMETER_DROPPED = ["type-parameter-dropped"] as const;

describe("mapSqlType", () => {
  it.each<TypeCase>([
    ["postgresql", "smallint", { kind: "smallint" }, []],
    ["postgresql", "int2", { kind: "smallint" }, []],
    ["postgresql", "integer", { kind: "integer" }, []],
    ["postgresql", "int", { kind: "integer" }, []],
    ["postgresql", "int4", { kind: "integer" }, []],
    ["postgresql", "bigint", { kind: "bigint" }, []],
    ["postgresql", "int8", { kind: "bigint" }, []],
    [
      "postgresql",
      "numeric(10, 2)",
      { kind: "decimal", precision: 10, scale: 2 },
      [],
    ],
    [
      "postgresql",
      "decimal(12,4)",
      { kind: "decimal", precision: 12, scale: 4 },
      [],
    ],
    [
      "postgresql",
      "numeric(7)",
      { kind: "decimal", precision: 7, scale: 0 },
      [],
    ],
    ["postgresql", "real", { kind: "real" }, []],
    ["postgresql", "float4", { kind: "real" }, []],
    ["postgresql", "double precision", { kind: "double" }, []],
    ["postgresql", "float8", { kind: "double" }, []],
    ["postgresql", "float(24)", { kind: "real" }, []],
    ["postgresql", "float(25)", { kind: "double" }, []],
    ["postgresql", "boolean", { kind: "boolean" }, []],
    ["postgresql", "bool", { kind: "boolean" }, []],
    ["postgresql", "char(3)", { kind: "char", length: 3 }, []],
    ["postgresql", "character(3)", { kind: "char", length: 3 }, []],
    ["postgresql", "varchar(255)", { kind: "varchar", length: 255 }, []],
    [
      "postgresql",
      "character varying(255)",
      { kind: "varchar", length: 255 },
      [],
    ],
    ["postgresql", "text", { kind: "text" }, []],
    ["postgresql", "varchar", { kind: "text" }, []],
    ["postgresql", "character varying", { kind: "text" }, []],
    ["postgresql", "uuid", { kind: "uuid" }, []],
    ["postgresql", "date", { kind: "date" }, []],
    ["postgresql", "time", { kind: "time" }, []],
    ["postgresql", "time without time zone", { kind: "time" }, []],
    ["postgresql", "time(6)", { kind: "time" }, []],
    ["postgresql", "time(3)", { kind: "time" }, PARAMETER_DROPPED],
    ["postgresql", "timestamp", { kind: "timestamp" }, []],
    ["postgresql", "timestamp without time zone", { kind: "timestamp" }, []],
    ["postgresql", "timestamp(3)", { kind: "timestamp" }, PARAMETER_DROPPED],
    ["postgresql", "timestamptz", { kind: "timestamptz" }, []],
    ["postgresql", "timestamp with time zone", { kind: "timestamptz" }, []],
    [
      "postgresql",
      "timestamp(0) with time zone",
      { kind: "timestamptz" },
      PARAMETER_DROPPED,
    ],
    ["postgresql", "jsonb", { kind: "json" }, []],
    ["postgresql", "json", { kind: "json" }, APPROXIMATED],
    ["postgresql", "bytea", { kind: "binary" }, []],
    ["postgresql", "inet", { kind: "custom", name: "inet" }, []],
    ["postgresql", "money", { kind: "custom", name: "money" }, []],
    ["postgresql", "text[]", { kind: "custom", name: "text[]" }, []],
    [
      "postgresql",
      "geometry(Point,4326)",
      { kind: "custom", name: "geometry(Point,4326)" },
      [],
    ],
    ["postgresql", "timetz", { kind: "custom", name: "timetz" }, []],
    ["postgresql", "numeric", { kind: "custom", name: "numeric" }, []],
    ["mysql", "SMALLINT", { kind: "smallint" }, []],
    ["mysql", "TINYINT", { kind: "smallint" }, APPROXIMATED],
    ["mysql", "INT", { kind: "integer" }, []],
    ["mysql", "INTEGER", { kind: "integer" }, []],
    ["mysql", "MEDIUMINT", { kind: "integer" }, APPROXIMATED],
    ["mysql", "SMALLINT UNSIGNED", { kind: "integer" }, APPROXIMATED],
    ["mysql", "BIGINT", { kind: "bigint" }, []],
    ["mysql", "INT UNSIGNED", { kind: "bigint" }, APPROXIMATED],
    [
      "mysql",
      "DECIMAL(10, 2)",
      { kind: "decimal", precision: 10, scale: 2 },
      [],
    ],
    [
      "mysql",
      "NUMERIC(10, 2)",
      { kind: "decimal", precision: 10, scale: 2 },
      [],
    ],
    [
      "mysql",
      "BIGINT UNSIGNED",
      { kind: "decimal", precision: 20, scale: 0 },
      APPROXIMATED,
    ],
    ["mysql", "FLOAT", { kind: "real" }, []],
    ["mysql", "DOUBLE", { kind: "double" }, []],
    ["mysql", "DOUBLE PRECISION", { kind: "double" }, []],
    ["mysql", "BOOLEAN", { kind: "boolean" }, []],
    ["mysql", "BOOL", { kind: "boolean" }, []],
    ["mysql", "TINYINT(1)", { kind: "boolean" }, []],
    ["mysql", "CHAR(10)", { kind: "char", length: 10 }, []],
    ["mysql", "VARCHAR(255)", { kind: "varchar", length: 255 }, []],
    ["mysql", "LONGTEXT", { kind: "text" }, []],
    ["mysql", "TEXT", { kind: "text" }, APPROXIMATED],
    ["mysql", "TINYTEXT", { kind: "text" }, APPROXIMATED],
    ["mysql", "MEDIUMTEXT", { kind: "text" }, APPROXIMATED],
    ["mysql", "DATE", { kind: "date" }, []],
    ["mysql", "TIME(6)", { kind: "time" }, []],
    ["mysql", "TIME", { kind: "time" }, PARAMETER_DROPPED],
    ["mysql", "DATETIME(6)", { kind: "timestamp" }, []],
    ["mysql", "DATETIME(3)", { kind: "timestamp" }, PARAMETER_DROPPED],
    ["mysql", "TIMESTAMP(6)", { kind: "timestamptz" }, []],
    ["mysql", "TIMESTAMP", { kind: "timestamptz" }, PARAMETER_DROPPED],
    ["mysql", "JSON", { kind: "json" }, []],
    ["mysql", "LONGBLOB", { kind: "binary" }, []],
    ["mysql", "BLOB", { kind: "binary" }, APPROXIMATED],
    ["mysql", "TINYBLOB", { kind: "binary" }, APPROXIMATED],
    ["mysql", "MEDIUMBLOB", { kind: "binary" }, APPROXIMATED],
    ["mysql", "BINARY(16)", { kind: "binary" }, APPROXIMATED],
    ["mysql", "VARBINARY(255)", { kind: "binary" }, APPROXIMATED],
    ["mysql", "INT(11)", { kind: "integer" }, PARAMETER_DROPPED],
    [
      "mysql",
      "INT(10) UNSIGNED",
      { kind: "bigint" },
      ["type-approximated", "type-parameter-dropped"],
    ],
    ["mysql", "SET('a','b')", { kind: "text" }, ["type-not-supported"]],
    ["sqlserver", "smallint", { kind: "smallint" }, []],
    ["sqlserver", "tinyint", { kind: "smallint" }, APPROXIMATED],
    ["sqlserver", "int", { kind: "integer" }, []],
    ["sqlserver", "bigint", { kind: "bigint" }, []],
    [
      "sqlserver",
      "decimal(18, 4)",
      { kind: "decimal", precision: 18, scale: 4 },
      [],
    ],
    [
      "sqlserver",
      "numeric(18, 4)",
      { kind: "decimal", precision: 18, scale: 4 },
      [],
    ],
    ["sqlserver", "real", { kind: "real" }, []],
    ["sqlserver", "float(24)", { kind: "real" }, []],
    ["sqlserver", "float", { kind: "double" }, []],
    ["sqlserver", "float(53)", { kind: "double" }, []],
    ["sqlserver", "bit", { kind: "boolean" }, []],
    ["sqlserver", "nchar(10)", { kind: "char", length: 10 }, []],
    ["sqlserver", "nvarchar(255)", { kind: "varchar", length: 255 }, []],
    ["sqlserver", "char(10)", { kind: "char", length: 10 }, APPROXIMATED],
    [
      "sqlserver",
      "varchar(255)",
      { kind: "varchar", length: 255 },
      APPROXIMATED,
    ],
    ["sqlserver", "nvarchar(max)", { kind: "text" }, []],
    ["sqlserver", "[nvarchar](MAX)", { kind: "text" }, []],
    ["sqlserver", "varchar(max)", { kind: "text" }, APPROXIMATED],
    ["sqlserver", "ntext", { kind: "text" }, APPROXIMATED],
    ["sqlserver", "text", { kind: "text" }, APPROXIMATED],
    ["sqlserver", "uniqueidentifier", { kind: "uuid" }, []],
    ["sqlserver", "date", { kind: "date" }, []],
    ["sqlserver", "time", { kind: "time" }, []],
    ["sqlserver", "time(7)", { kind: "time" }, []],
    ["sqlserver", "time(3)", { kind: "time" }, PARAMETER_DROPPED],
    ["sqlserver", "datetime2", { kind: "timestamp" }, []],
    ["sqlserver", "datetime", { kind: "timestamp" }, APPROXIMATED],
    ["sqlserver", "smalldatetime", { kind: "timestamp" }, APPROXIMATED],
    ["sqlserver", "datetimeoffset", { kind: "timestamptz" }, []],
    ["sqlserver", "varbinary(max)", { kind: "binary" }, []],
    ["sqlserver", "varbinary(16)", { kind: "binary" }, APPROXIMATED],
    ["sqlserver", "binary(16)", { kind: "binary" }, APPROXIMATED],
    ["sqlserver", "image", { kind: "binary" }, APPROXIMATED],
    ["sqlserver", "money", { kind: "custom", name: "money" }, []],
    ["sqlserver", "xml", { kind: "custom", name: "xml" }, []],
    ["sqlserver", "hierarchyid", { kind: "custom", name: "hierarchyid" }, []],
  ])(
    "maps every row of the type table: %s %s",
    (dialect, rawType, type, codes) => {
      expect(map(rawType, dialect)).toStrictEqual({
        type,
        isAutoIncrement: false,
        codes,
      });
    },
  );

  it.each<readonly [rawType: string, type: DraftColumnType]>([
    ["  CHARACTER   VARYING ( 40 ) ", { kind: "varchar", length: 40 }],
    ['"timestamp" WITH TIME ZONE', { kind: "timestamptz" }],
    ["pg_catalog.int4", { kind: "integer" }],
  ])(
    "compares type names ignoring case, quotes, whitespace and a schema: %s",
    (rawType, type) => {
      expect(map(rawType, "postgresql").type).toStrictEqual(type);
    },
  );

  it.each<readonly [rawType: string, type: DraftColumnType]>([
    ["serial", { kind: "integer" }],
    ["bigserial", { kind: "bigint" }],
    ["smallserial", { kind: "smallint" }],
  ])("marks serial types as auto increment: %s", (rawType, type) => {
    expect(map(rawType, "postgresql")).toStrictEqual({
      type,
      isAutoIncrement: true,
      codes: [],
    });
  });

  it("maps mysql char(36) with a uuid default to uuid and without it to char(36)", () => {
    expect([
      map("CHAR(36)", "mysql", { hasUuidDefault: true }).type,
      map("CHAR(36)", "mysql").type,
    ]).toStrictEqual([{ kind: "uuid" }, { kind: "char", length: 36 }]);
  });

  it.each<readonly [rawType: string, enumName: string]>([
    ["status", "status"],
    ['"Status"', "Status"],
    ["public.status", "status"],
    ['public."status"', "status"],
  ])(
    "maps a postgresql type named after an enum to that enum: %s",
    (rawType, enumName) => {
      expect(
        map(rawType, "postgresql", { enumNameKeys: ["status"] }),
      ).toStrictEqual({
        type: { kind: "enum", enumName },
        isAutoIncrement: false,
        codes: [],
      });
    },
  );

  it.each(["citext", "geography(Point, 4326)", "double precision[]"])(
    "keeps a safe unknown type as custom verbatim: %s",
    (rawType) => {
      expect(map(rawType, "postgresql")).toStrictEqual({
        type: { kind: "custom", name: rawType },
        isAutoIncrement: false,
        codes: [],
      });
    },
  );

  it.each([
    "int NOT NULL",
    "public.citext",
    "varchar(abc",
    "int; DROP TABLE t",
    "ENUM('a','b')",
  ])(
    "maps an unsafe unknown type to text with type-not-supported: %s",
    (rawType) => {
      expect(map(rawType, "mysql")).toStrictEqual({
        type: { kind: "text" },
        isAutoIncrement: false,
        codes: ["type-not-supported"],
      });
    },
  );

  it.each([
    "varchar(0)",
    "numeric(0, 0)",
    "float(54)",
    "char(1, 2)",
    "varchar(99999999999999999999)",
  ])(
    "treats a known type with arguments outside its domain as custom: %s",
    (rawType) => {
      expect(map(rawType, "postgresql").type).toStrictEqual({
        kind: "custom",
        name: rawType,
      });
    },
  );

  it.each<TypeCase>([
    [
      "postgresql",
      "TIMESTAMP\n  WITH   time ZONE",
      { kind: "timestamptz" },
      [],
    ],
    ["postgresql", "Double\tPrecision", { kind: "double" }, []],
    [
      "postgresql",
      "character  varying ( 255 )",
      { kind: "varchar", length: 255 },
      [],
    ],
    [
      "postgresql",
      "time  with time zone",
      { kind: "custom", name: "time with time zone" },
      [],
    ],
    [
      "postgresql",
      "bit\nvarying(8)",
      { kind: "custom", name: "bit varying(8)" },
      [],
    ],
  ])(
    "reads multi-word source type text with any whitespace and case: %s %j",
    (dialect, rawType, type, codes) => {
      expect(map(rawType, dialect)).toStrictEqual({
        type,
        isAutoIncrement: false,
        codes,
      });
    },
  );

  it.each<TypeCase>([
    ["postgresql", "doubleprecision", { kind: "double" }, []],
    ["mysql", "doubleprecision", { kind: "double" }, []],
    ["postgresql", "bitvarying", { kind: "custom", name: "bit varying" }, []],
    [
      "postgresql",
      "bitvarying(8)",
      { kind: "custom", name: "bit varying(8)" },
      [],
    ],
  ])(
    "accepts the parser's squashed type names as aliases: %s %s",
    (dialect, rawType, type, codes) => {
      expect(map(rawType, dialect)).toStrictEqual({
        type,
        isAutoIncrement: false,
        codes,
      });
    },
  );

  it.each<TypeCase>([
    ["mysql", "TINYINT UNSIGNED", { kind: "smallint" }, APPROXIMATED],
    ["mysql", "mediumint unsigned", { kind: "integer" }, APPROXIMATED],
    ["mysql", "INTEGER UNSIGNED", { kind: "bigint" }, APPROXIMATED],
    [
      "mysql",
      "DECIMAL(10,2) UNSIGNED",
      { kind: "decimal", precision: 10, scale: 2 },
      APPROXIMATED,
    ],
    ["mysql", "DOUBLE UNSIGNED", { kind: "double" }, APPROXIMATED],
    [
      "mysql",
      "bigint(20) unsigned",
      { kind: "decimal", precision: 20, scale: 0 },
      ["type-approximated", "type-parameter-dropped"],
    ],
    [
      "mysql",
      "int(10) unsigned zerofill",
      { kind: "bigint" },
      ["type-approximated", "type-parameter-dropped"],
    ],
    [
      "mysql",
      "INT ZEROFILL",
      { kind: "bigint" },
      ["type-approximated", "type-parameter-dropped"],
    ],
    [
      "mysql",
      "SMALLINT(5) UNSIGNED ZEROFILL",
      { kind: "integer" },
      ["type-approximated", "type-parameter-dropped"],
    ],
  ])(
    "maps mysql unsigned and zerofill modifiers: %s %s",
    (dialect, rawType, type, codes) => {
      expect(map(rawType, dialect)).toStrictEqual({
        type,
        isAutoIncrement: false,
        codes,
      });
    },
  );
});

describe("splitSqlServerIdentity", () => {
  it.each<
    readonly [
      rawType: string,
      typeName: string,
      identity: { readonly seed: string; readonly step: string } | null,
    ]
  >([
    ["bigint IDENTITY(1,1)", "bigint", { seed: "1", step: "1" }],
    ["int identity ( 100 , 5 )", "int", { seed: "100", step: "5" }],
    ["[int] IDENTITY(-1, 1)", "[int]", { seed: "-1", step: "1" }],
    ["int IDENTITY", "int", { seed: "1", step: "1" }],
    ["int", "int", null],
    ["int IDENTITY(1)", "int IDENTITY(1)", null],
    ["IDENTITY(1, 1)", "IDENTITY(1, 1)", null],
    ["int IDENTITY(1, 1) NOT NULL", "int IDENTITY(1, 1) NOT NULL", null],
    ["int 'open", "int 'open", null],
  ])(
    "splits a sql server identity clause: %s",
    (rawType, typeName, identity) => {
      expect(splitSqlServerIdentity(rawType)).toStrictEqual({
        typeName,
        identity,
      });
    },
  );
});
