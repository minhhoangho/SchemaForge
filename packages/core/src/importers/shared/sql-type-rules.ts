import type { SqlDialect } from "../../generators/shared/generator-types.js";
import {
  APPROXIMATED,
  customAlias,
  decimal,
  displayWidth,
  firstOf,
  floatBits,
  fractionalSeconds,
  mapped,
  mysqlChar,
  plain,
  serial,
  sizedBinary,
  unbounded,
  withLength,
  type TypeRule,
} from "./sql-type-rule-builders.js";

const MYSQL_BOOLEAN_WIDTH = "1";
// Fractional second digits the model's time types keep, per dialect default.
const POSTGRESQL_PRECISION = 6;
const MYSQL_PRECISION = 6;
const MYSQL_IMPLICIT_PRECISION = 0;
const SQLSERVER_PRECISION = 7;
const BIGINT_UNSIGNED_DIGITS = 20;

const POSTGRESQL_TYPES: ReadonlyMap<string, TypeRule> = new Map([
  ...["smallint", "int2"].map(
    (name) => [name, plain({ kind: "smallint" })] as const,
  ),
  ...["integer", "int", "int4"].map(
    (name) => [name, plain({ kind: "integer" })] as const,
  ),
  ...["bigint", "int8"].map(
    (name) => [name, plain({ kind: "bigint" })] as const,
  ),
  ["smallserial", serial({ kind: "smallint" })],
  ["serial", serial({ kind: "integer" })],
  ["bigserial", serial({ kind: "bigint" })],
  ["numeric", decimal],
  ["decimal", decimal],
  ...["real", "float4"].map((name) => [name, plain({ kind: "real" })] as const),
  ...["double precision", "doubleprecision", "float8"].map(
    (name) => [name, plain({ kind: "double" })] as const,
  ),
  ["float", floatBits],
  ...["boolean", "bool"].map(
    (name) => [name, plain({ kind: "boolean" })] as const,
  ),
  ...["char", "character"].map((name) => [name, withLength("char")] as const),
  ...["varchar", "character varying"].map(
    (name) =>
      [name, firstOf(plain({ kind: "text" }), withLength("varchar"))] as const,
  ),
  ["text", plain({ kind: "text" })],
  ["uuid", plain({ kind: "uuid" })],
  ["date", plain({ kind: "date" })],
  ...["time", "time without time zone"].map(
    (name) =>
      [
        name,
        fractionalSeconds(
          { kind: "time" },
          POSTGRESQL_PRECISION,
          POSTGRESQL_PRECISION,
        ),
      ] as const,
  ),
  ...["timestamp", "timestamp without time zone"].map(
    (name) =>
      [
        name,
        fractionalSeconds(
          { kind: "timestamp" },
          POSTGRESQL_PRECISION,
          POSTGRESQL_PRECISION,
        ),
      ] as const,
  ),
  ...["timestamptz", "timestamp with time zone"].map(
    (name) =>
      [
        name,
        fractionalSeconds(
          { kind: "timestamptz" },
          POSTGRESQL_PRECISION,
          POSTGRESQL_PRECISION,
        ),
      ] as const,
  ),
  ["jsonb", plain({ kind: "json" })],
  ["json", plain({ kind: "json" }, APPROXIMATED)],
  ["bytea", plain({ kind: "binary" })],
  ["bitvarying", customAlias("bit varying")],
]);

const MYSQL_TYPES: ReadonlyMap<string, TypeRule> = new Map([
  ["smallint", displayWidth({ kind: "smallint" })],
  [
    "tinyint",
    firstOf(
      (args) =>
        args?.length === 1 && args[0] === MYSQL_BOOLEAN_WIDTH
          ? mapped({ kind: "boolean" })
          : null,
      displayWidth({ kind: "smallint" }, APPROXIMATED),
    ),
  ],
  ["int", displayWidth({ kind: "integer" })],
  ["integer", displayWidth({ kind: "integer" })],
  ["mediumint", displayWidth({ kind: "integer" }, APPROXIMATED)],
  ["smallint unsigned", displayWidth({ kind: "integer" }, APPROXIMATED)],
  ["bigint", displayWidth({ kind: "bigint" })],
  ...["int unsigned", "integer unsigned"].map(
    (name) => [name, displayWidth({ kind: "bigint" }, APPROXIMATED)] as const,
  ),
  [
    "bigint unsigned",
    displayWidth(
      { kind: "decimal", precision: BIGINT_UNSIGNED_DIGITS, scale: 0 },
      APPROXIMATED,
    ),
  ],
  ["decimal", decimal],
  ["numeric", decimal],
  ["float", plain({ kind: "real" })],
  ...["double", "double precision", "doubleprecision"].map(
    (name) => [name, plain({ kind: "double" })] as const,
  ),
  ...["boolean", "bool"].map(
    (name) => [name, plain({ kind: "boolean" })] as const,
  ),
  ["char", mysqlChar],
  ["varchar", withLength("varchar")],
  ["longtext", plain({ kind: "text" })],
  ...["text", "tinytext", "mediumtext"].map(
    (name) => [name, plain({ kind: "text" }, APPROXIMATED)] as const,
  ),
  ["date", plain({ kind: "date" })],
  [
    "time",
    fractionalSeconds(
      { kind: "time" },
      MYSQL_IMPLICIT_PRECISION,
      MYSQL_PRECISION,
    ),
  ],
  [
    "datetime",
    fractionalSeconds(
      { kind: "timestamp" },
      MYSQL_IMPLICIT_PRECISION,
      MYSQL_PRECISION,
    ),
  ],
  [
    "timestamp",
    fractionalSeconds(
      { kind: "timestamptz" },
      MYSQL_IMPLICIT_PRECISION,
      MYSQL_PRECISION,
    ),
  ],
  ["json", plain({ kind: "json" })],
  ["longblob", plain({ kind: "binary" })],
  ...["blob", "tinyblob", "mediumblob"].map(
    (name) => [name, plain({ kind: "binary" }, APPROXIMATED)] as const,
  ),
  ...["binary", "varbinary"].map((name) => [name, sizedBinary] as const),
]);

const SQLSERVER_TYPES: ReadonlyMap<string, TypeRule> = new Map([
  ["smallint", plain({ kind: "smallint" })],
  ["tinyint", plain({ kind: "smallint" }, APPROXIMATED)],
  ["int", plain({ kind: "integer" })],
  ["bigint", plain({ kind: "bigint" })],
  ["decimal", decimal],
  ["numeric", decimal],
  ["real", plain({ kind: "real" })],
  ["float", firstOf(plain({ kind: "double" }), floatBits)],
  ["bit", plain({ kind: "boolean" })],
  ["nchar", withLength("char")],
  ["nvarchar", firstOf(unbounded({ kind: "text" }), withLength("varchar"))],
  ["char", withLength("char", APPROXIMATED)],
  [
    "varchar",
    firstOf(
      unbounded({ kind: "text" }, APPROXIMATED),
      withLength("varchar", APPROXIMATED),
    ),
  ],
  ...["ntext", "text"].map(
    (name) => [name, plain({ kind: "text" }, APPROXIMATED)] as const,
  ),
  ["uniqueidentifier", plain({ kind: "uuid" })],
  ["date", plain({ kind: "date" })],
  [
    "time",
    fractionalSeconds(
      { kind: "time" },
      SQLSERVER_PRECISION,
      SQLSERVER_PRECISION,
    ),
  ],
  [
    "datetime2",
    fractionalSeconds(
      { kind: "timestamp" },
      SQLSERVER_PRECISION,
      SQLSERVER_PRECISION,
    ),
  ],
  ...["datetime", "smalldatetime"].map(
    (name) => [name, plain({ kind: "timestamp" }, APPROXIMATED)] as const,
  ),
  [
    "datetimeoffset",
    fractionalSeconds(
      { kind: "timestamptz" },
      SQLSERVER_PRECISION,
      SQLSERVER_PRECISION,
    ),
  ],
  ["varbinary", firstOf(unbounded({ kind: "binary" }), sizedBinary)],
  ["binary", sizedBinary],
  ["image", plain({ kind: "binary" }, APPROXIMATED)],
]);

// The type table of the import / export spec, section 5 "Ánh xạ kiểu", keyed
// by the lowercased type words without arguments.
export const SQL_TYPE_RULES: Readonly<
  Record<SqlDialect, ReadonlyMap<string, TypeRule>>
> = {
  postgresql: POSTGRESQL_TYPES,
  mysql: MYSQL_TYPES,
  sqlserver: SQLSERVER_TYPES,
};
