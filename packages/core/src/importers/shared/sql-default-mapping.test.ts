import { describe, expect, it } from "vitest";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type { ColumnDefault } from "../../model/column-default.js";
import type { ImportDiagnosticCode } from "./import-diagnostic-codes.js";
import type { DraftColumnType } from "./import-draft.js";
import {
  mapSqlDefault,
  type RawSqlDefault,
  type SqlDefaultMapping,
} from "./sql-default-mapping.js";

const TEXT: DraftColumnType = { kind: "text" };
const INTEGER: DraftColumnType = { kind: "integer" };
const BOOLEAN: DraftColumnType = { kind: "boolean" };
const TIMESTAMP: DraftColumnType = { kind: "timestamp" };
const TIMESTAMPTZ: DraftColumnType = { kind: "timestamptz" };
const UUID: DraftColumnType = { kind: "uuid" };

const NOT_SUPPORTED: SqlDefaultMapping = {
  defaultValue: null,
  isAutoIncrement: false,
  codes: ["default-not-supported"],
};

function expression(text: string): RawSqlDefault {
  return { kind: "expression", text };
}

function mapped(
  defaultValue: ColumnDefault | null,
  codes: readonly ImportDiagnosticCode[] = [],
): SqlDefaultMapping {
  return { defaultValue, isAutoIncrement: false, codes };
}

function literal(value: string): SqlDefaultMapping {
  return mapped({ kind: "literal", value });
}

const CURRENT_TIMESTAMP = mapped({ kind: "currentTimestamp" });
const GENERATE_UUID = mapped({ kind: "generateUuid" });

type DefaultCase = readonly [
  dialect: SqlDialect | "any",
  raw: RawSqlDefault,
  columnType: DraftColumnType,
  expected: SqlDefaultMapping,
];

describe("mapSqlDefault", () => {
  it.each<DefaultCase>([
    ["postgresql", { kind: "string", text: "it''s" }, TEXT, literal("it's")],
    ["postgresql", { kind: "number", text: "42" }, INTEGER, literal("42")],
    ["mysql", { kind: "number", text: "-1.5" }, TEXT, literal("-1.5")],
    ["postgresql", { kind: "boolean", text: "true" }, BOOLEAN, literal("true")],
    ["mysql", expression("FALSE"), BOOLEAN, literal("false")],
    ["sqlserver", { kind: "number", text: "1" }, BOOLEAN, literal("true")],
    ["sqlserver", expression("((0))"), BOOLEAN, literal("false")],
    ["sqlserver", expression("((2))"), BOOLEAN, literal("2")],
    ["postgresql", expression("'abc'"), INTEGER, literal("abc")],
    ["postgresql", expression("NULL"), TEXT, mapped(null)],
    ["mysql", expression("null"), INTEGER, mapped(null)],
    ["postgresql", expression("now()"), TIMESTAMPTZ, CURRENT_TIMESTAMP],
    [
      "postgresql",
      expression("CURRENT_TIMESTAMP"),
      TIMESTAMP,
      CURRENT_TIMESTAMP,
    ],
    [
      "postgresql",
      expression("CURRENT_TIMESTAMP(3)"),
      TIMESTAMP,
      CURRENT_TIMESTAMP,
    ],
    ["postgresql", expression("LOCALTIMESTAMP"), TIMESTAMP, CURRENT_TIMESTAMP],
    ["mysql", expression("NOW()"), TIMESTAMP, CURRENT_TIMESTAMP],
    [
      "mysql",
      expression("CURRENT_TIMESTAMP(6)"),
      TIMESTAMPTZ,
      CURRENT_TIMESTAMP,
    ],
    ["sqlserver", expression("(sysdatetime())"), TIMESTAMP, CURRENT_TIMESTAMP],
    [
      "sqlserver",
      expression("sysdatetimeoffset()"),
      TIMESTAMPTZ,
      CURRENT_TIMESTAMP,
    ],
    ["sqlserver", expression("(getdate())"), TIMESTAMP, CURRENT_TIMESTAMP],
    ["sqlserver", expression("getutcdate()"), TIMESTAMP, CURRENT_TIMESTAMP],
    ["postgresql", expression("gen_random_uuid()"), UUID, GENERATE_UUID],
    ["postgresql", expression("uuid_generate_v4()"), UUID, GENERATE_UUID],
    [
      "postgresql",
      expression("public.uuid_generate_v4()"),
      UUID,
      GENERATE_UUID,
    ],
    ["mysql", expression("(UUID())"), UUID, GENERATE_UUID],
    ["mysql", expression("uuid()"), UUID, GENERATE_UUID],
    ["sqlserver", expression("(newid())"), UUID, GENERATE_UUID],
    [
      "sqlserver",
      expression("(newsequentialid())"),
      UUID,
      mapped({ kind: "generateUuid" }, ["default-approximated"]),
    ],
    ["postgresql", expression("lower('A')"), TEXT, NOT_SUPPORTED],
    ["postgresql", expression("1 + 1"), INTEGER, NOT_SUPPORTED],
    ["sqlserver", expression("newid()"), TEXT, NOT_SUPPORTED],
    ["postgresql", expression("gen_random_uuid(1)"), UUID, NOT_SUPPORTED],
    ["postgresql", expression("now"), TIMESTAMP, NOT_SUPPORTED],
    ["postgresql", expression("'open"), TEXT, NOT_SUPPORTED],
    ["postgresql", expression(""), TEXT, NOT_SUPPORTED],
  ])(
    "maps every row of the default table: %s %j on %j",
    (dialect, raw, columnType, expected) => {
      expect(mapSqlDefault({ raw, columnType, dialect })).toStrictEqual(
        expected,
      );
    },
  );

  // mysqldump writes DEFAULT '1' and '0' on TINYINT(1), which maps to boolean.
  it.each<DefaultCase>([
    ["mysql", { kind: "string", text: "1" }, BOOLEAN, literal("true")],
    ["mysql", { kind: "string", text: "0" }, BOOLEAN, literal("false")],
    ["mysql", expression("'1'"), BOOLEAN, literal("true")],
  ])(
    "maps a MySQL string 1 or 0 on a boolean column to a boolean: %s %j",
    (dialect, raw, columnType, expected) => {
      expect(mapSqlDefault({ raw, columnType, dialect })).toStrictEqual(
        expected,
      );
    },
  );

  it.each<DefaultCase>([
    ["mysql", { kind: "string", text: "1" }, INTEGER, literal("1")],
    ["mysql", { kind: "string", text: "2" }, BOOLEAN, literal("2")],
    ["postgresql", { kind: "string", text: "1" }, BOOLEAN, literal("1")],
    ["sqlserver", { kind: "string", text: "0" }, BOOLEAN, literal("0")],
    ["any", { kind: "string", text: "1" }, BOOLEAN, literal("1")],
  ])(
    "keeps a string 1 or 0 as text outside a MySQL boolean column: %s %j on %j",
    (dialect, raw, columnType, expected) => {
      expect(mapSqlDefault({ raw, columnType, dialect })).toStrictEqual(
        expected,
      );
    },
  );

  it.each<RawSqlDefault>([
    { kind: "number", text: "12345678901234567890.123" },
    expression("12345678901234567890.123"),
  ])(
    "keeps a large decimal literal text without losing precision: %j",
    (raw) => {
      expect(
        mapSqlDefault({
          raw,
          columnType: { kind: "decimal", precision: 38, scale: 3 },
          dialect: "postgresql",
        }),
      ).toStrictEqual(literal("12345678901234567890.123"));
    },
  );

  it.each<readonly [dialect: SqlDialect, text: string, value: string]>([
    ["sqlserver", "((0))", "0"],
    ["sqlserver", "(N'a')", "a"],
    ["sqlserver", "N'it''s'", "it's"],
    ["postgresql", "'a'::status", "a"],
    ["postgresql", "'x'::character varying", "x"],
    ["postgresql", "('-1'::integer)", "-1"],
    ["postgresql", "(-1)", "-1"],
    ["postgresql", "'{}'::text[]", "{}"],
    ["postgresql", "(('2020-01-01'::text)::date)", "2020-01-01"],
    ["postgresql", `${"(".repeat(20_000)}1${")".repeat(20_000)}`, "1"],
  ])(
    "strips wrapping parentheses, n prefixes and postgresql casts: %s %s",
    (dialect, text, value) => {
      expect(
        mapSqlDefault({ raw: expression(text), columnType: TEXT, dialect }),
      ).toStrictEqual(literal(value));
    },
  );

  it.each<DraftColumnType>([
    { kind: "smallint" },
    { kind: "integer" },
    { kind: "bigint" },
  ])(
    "maps nextval on an integer column to auto increment: %j",
    (columnType) => {
      expect(
        mapSqlDefault({
          raw: expression("nextval('public.users_id_seq'::regclass)"),
          columnType,
          dialect: "postgresql",
        }),
      ).toStrictEqual({
        defaultValue: null,
        isAutoIncrement: true,
        codes: ["sequence-default-as-auto-increment"],
      });
    },
  );

  it("drops nextval on a non-integer column with default-not-supported", () => {
    expect(
      mapSqlDefault({
        raw: expression("nextval('s')"),
        columnType: TEXT,
        dialect: "postgresql",
      }),
    ).toStrictEqual(NOT_SUPPORTED);
  });

  it.each<DraftColumnType>([{ kind: "date" }, TEXT, { kind: "time" }])(
    "drops a timestamp function on a non-timestamp column with default-not-supported: %j",
    (columnType) => {
      expect(
        mapSqlDefault({
          raw: expression("now()"),
          columnType,
          dialect: "postgresql",
        }),
      ).toStrictEqual(NOT_SUPPORTED);
    },
  );

  it.each<
    readonly [
      text: string,
      columnType: DraftColumnType,
      expected: SqlDefaultMapping,
    ]
  >([
    ["now()", TIMESTAMP, CURRENT_TIMESTAMP],
    ["getdate()", TIMESTAMP, CURRENT_TIMESTAMP],
    ["CURRENT_TIMESTAMP(6)", TIMESTAMPTZ, CURRENT_TIMESTAMP],
    ["sysdatetimeoffset()", TIMESTAMPTZ, CURRENT_TIMESTAMP],
    ["gen_random_uuid()", UUID, GENERATE_UUID],
    ["(UUID())", UUID, GENERATE_UUID],
    ["newid()", UUID, GENERATE_UUID],
    ["N'a'", TEXT, literal("a")],
    ["'a'::status", TEXT, literal("a")],
  ])(
    "accepts expressions of all three dialects for dbml: %s",
    (text, columnType, expected) => {
      expect(
        mapSqlDefault({ raw: expression(text), columnType, dialect: "any" }),
      ).toStrictEqual(expected);
    },
  );

  it.each<
    readonly [dialect: SqlDialect, text: string, columnType: DraftColumnType]
  >([
    ["postgresql", "getdate()", TIMESTAMP],
    ["mysql", "newid()", UUID],
    ["sqlserver", "now()", TIMESTAMP],
    ["mysql", "nextval('s')", INTEGER],
  ])(
    "drops an expression of another dialect: %s %s",
    (dialect, text, columnType) => {
      expect(
        mapSqlDefault({ raw: expression(text), columnType, dialect }),
      ).toStrictEqual(NOT_SUPPORTED);
    },
  );

  it.each<RawSqlDefault>([
    { kind: "boolean", text: "null" },
    { kind: "boolean", text: "NULL" },
    { kind: "number", text: "null" },
    expression("Null"),
  ])("treats null of any non-string kind as no default: %j", (raw) => {
    expect(
      mapSqlDefault({ raw, columnType: INTEGER, dialect: "postgresql" }),
    ).toStrictEqual(mapped(null));
  });

  it("keeps the string null as a literal", () => {
    expect(
      mapSqlDefault({
        raw: { kind: "string", text: "null" },
        columnType: TEXT,
        dialect: "postgresql",
      }),
    ).toStrictEqual(literal("null"));
  });

  it.each(["-5", "- 5", "-12345678901234567890.5"])(
    "keeps a signed number expression as a number literal: %s",
    (text) => {
      expect(
        mapSqlDefault({
          raw: expression(text),
          columnType: INTEGER,
          dialect: "postgresql",
        }),
      ).toStrictEqual(literal(text.replace(" ", "")));
    },
  );

  it.each<readonly [dialect: SqlDialect | "any", text: string, value: string]>([
    ["postgresql", "it''s", "it's"],
    ["sqlserver", "it''s", "it's"],
    ["mysql", "it''s", "it's"],
    ["mysql", "it\\'s", "it's"],
    ["mysql", "C:\\\\dir", "C:\\dir"],
    ["postgresql", "C:\\dir", "C:\\dir"],
    ["postgresql", "a'b", "a'b"],
    ["any", "it''s", "it''s"],
  ])(
    "unescapes the sql quoting kept in a string default: %s %s",
    (dialect, text, value) => {
      expect(
        mapSqlDefault({
          raw: { kind: "string", text },
          columnType: TEXT,
          dialect,
        }),
      ).toStrictEqual(literal(value));
    },
  );

  it.each<DefaultCase>([
    [
      "postgresql",
      expression("'2026-01-02 03:04:05'::timestamp without time zone"),
      TIMESTAMP,
      literal("2026-01-02T03:04:05"),
    ],
    [
      "postgresql",
      expression("'2026-01-01 20:04:05.123+00'::timestamp with time zone"),
      TIMESTAMPTZ,
      literal("2026-01-01T20:04:05.123+00:00"),
    ],
    [
      "postgresql",
      expression("'2026-01-01 20:04:05-05:30'::timestamp with time zone"),
      TIMESTAMPTZ,
      literal("2026-01-01T20:04:05-05:30"),
    ],
    [
      "mysql",
      { kind: "string", text: "2026-01-02 03:04:05.000000" },
      TIMESTAMP,
      literal("2026-01-02T03:04:05.000000"),
    ],
    [
      "mysql",
      { kind: "string", text: "2026-01-01 20:04:05.123000" },
      TIMESTAMPTZ,
      literal("2026-01-01T20:04:05.123000"),
    ],
  ])(
    "rewrites a dump timestamp literal to the model's iso form: %s %o",
    (dialect, raw, columnType, expected) => {
      expect(mapSqlDefault({ raw, columnType, dialect })).toStrictEqual(
        expected,
      );
    },
  );

  it.each<
    readonly [
      dialect: SqlDialect | "any",
      text: string,
      columnType: DraftColumnType,
    ]
  >([
    ["postgresql", "2026-01-02T03:04:05", TIMESTAMP],
    ["postgresql", "2026-01-02  03:04:05", TIMESTAMP],
    ["postgresql", "2026-01-02 03:04", TIMESTAMP],
    ["postgresql", "2026-01-02 03:04:05.", TIMESTAMP],
    ["mysql", "2026-01-02 03:04:05+0", TIMESTAMPTZ],
    ["mysql", "2026-01-02 03:04:05Z", TIMESTAMPTZ],
    ["mysql", "2026-01-02 03:04:05", TEXT],
    ["any", "2026-01-02 03:04:05", TIMESTAMP],
  ])(
    "keeps a string that is not a dump timestamp literal as is: %s %s",
    (dialect, text, columnType) => {
      expect(
        mapSqlDefault({ raw: { kind: "string", text }, columnType, dialect }),
      ).toStrictEqual(literal(text));
    },
  );

  it.each<readonly [text: string, value: string]>([
    ["(_utf8mb4'a\\\\b')", "a\\b"],
    ["_utf8mb4'it\\'s'", "it's"],
    ["(_latin1 'x')", "x"],
    ['(_utf8mb4\'{"note":"it\\\'s"}\')', '{"note":"it\'s"}'],
  ])("strips a mysql charset introducer before a string: %s", (text, value) => {
    expect(
      mapSqlDefault({
        raw: expression(text),
        columnType: TEXT,
        dialect: "mysql",
      }),
    ).toStrictEqual(literal(value));
  });

  it.each<readonly [dialect: SqlDialect | "any", text: string]>([
    ["mysql", "(_utf8mb4'a' COLLATE utf8mb4_bin)"],
    ["mysql", "(concat(_utf8mb4'a', _utf8mb4'b'))"],
    ["mysql", "(_utf8mb4'a' _utf8mb4'b')"],
    ["mysql", "(_ 'a')"],
    ["mysql", "(utf8mb4'a')"],
    ["postgresql", "_utf8mb4'a'"],
    ["any", "_utf8mb4'a'"],
  ])(
    "drops an introducer that is not before exactly one mysql string: %s %s",
    (dialect, text) => {
      expect(
        mapSqlDefault({ raw: expression(text), columnType: TEXT, dialect }),
      ).toStrictEqual(NOT_SUPPORTED);
    },
  );
});
