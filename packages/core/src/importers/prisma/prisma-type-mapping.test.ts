import { describe, expect, it } from "vitest";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type { ColumnDefault } from "../../model/column-default.js";
import { unwrapOk } from "../../testing/unwrap-result.js";
import type { ImportDiagnosticCode } from "../shared/import-diagnostic-codes.js";
import type { DraftColumnType } from "../shared/import-draft.js";
import type { PrismaField } from "./prisma-ast.js";
import { parsePrismaSchema } from "./prisma-parser.js";
import {
  mapPrismaScalarField,
  type PrismaFieldMapping,
} from "./prisma-type-mapping.js";

// The field sits on line 2 at column 3 of the parsed model.
function parseField(line: string): PrismaField {
  const schema = unwrapOk(parsePrismaSchema(`model M {\n  ${line}\n}\n`));
  const field = schema.blocks.flatMap((block) =>
    block.kind === "model" ? block.fields : [],
  )[0];
  if (field === undefined) {
    throw new Error(`No field parsed from ${line}`);
  }
  return field;
}

function mapField(
  line: string,
  provider: SqlDialect = "postgresql",
): PrismaFieldMapping {
  return mapPrismaScalarField(parseField(line), {
    provider,
    enumNamesByPrismaName: new Map([["Role", "role_db"]]),
    enumValuesByPrismaName: new Map([
      [
        "Role",
        new Map([
          ["ADMIN", "admin"],
          ["USER", "USER"],
        ]),
      ],
    ]),
  });
}

type TypeSummary = {
  readonly type: DraftColumnType;
  readonly codes: readonly ImportDiagnosticCode[];
};

function typeOf(line: string, provider: SqlDialect): TypeSummary {
  const mapping = mapField(line, provider);
  return {
    type: mapping.type,
    codes: mapping.diagnostics.map((diagnostic) => diagnostic.code),
  };
}

type DefaultSummary = {
  readonly defaultValue: ColumnDefault | null;
  readonly isAutoIncrement: boolean;
  readonly codes: readonly ImportDiagnosticCode[];
};

function defaultOf(line: string, provider: SqlDialect): DefaultSummary {
  const mapping = mapField(line, provider);
  return {
    defaultValue: mapping.defaultValue,
    isAutoIncrement: mapping.isAutoIncrement,
    codes: mapping.diagnostics.map((diagnostic) => diagnostic.code),
  };
}

function typed(
  type: DraftColumnType,
  codes: readonly ImportDiagnosticCode[] = [],
): TypeSummary {
  return { type, codes };
}

function defaulted(
  defaultValue: ColumnDefault | null,
  codes: readonly ImportDiagnosticCode[] = [],
  isAutoIncrement = false,
): DefaultSummary {
  return { defaultValue, isAutoIncrement, codes };
}

function literal(value: string): DefaultSummary {
  return defaulted({ kind: "literal", value });
}

const NOT_SUPPORTED = defaulted(null, ["default-not-supported"]);
const GENERATE_UUID = defaulted({ kind: "generateUuid" });

describe("mapPrismaScalarField", () => {
  it.each<readonly [SqlDialect, string, TypeSummary]>([
    ["postgresql", "a Int", typed({ kind: "integer" })],
    ["postgresql", "a Int @db.SmallInt", typed({ kind: "smallint" })],
    ["postgresql", "a BigInt", typed({ kind: "bigint" })],
    [
      "postgresql",
      "a Decimal",
      typed({ kind: "decimal", precision: 65, scale: 30 }),
    ],
    [
      "postgresql",
      "a Decimal @db.Decimal(10, 2)",
      typed({ kind: "decimal", precision: 10, scale: 2 }),
    ],
    ["postgresql", "a Float", typed({ kind: "double" })],
    ["postgresql", "a Float @db.Real", typed({ kind: "real" })],
    ["postgresql", "a Boolean", typed({ kind: "boolean" })],
    ["postgresql", "a String", typed({ kind: "text" })],
    [
      "postgresql",
      "a String @db.VarChar(255)",
      typed({ kind: "varchar", length: 255 }),
    ],
    [
      "postgresql",
      "a String @db.Char(10)",
      typed({ kind: "char", length: 10 }),
    ],
    ["postgresql", "a String @db.Uuid", typed({ kind: "uuid" })],
    ["postgresql", "a String @db.Text", typed({ kind: "text" })],
    ["postgresql", "a DateTime", typed({ kind: "timestamp" })],
    [
      "postgresql",
      "a DateTime @db.Timestamptz(6)",
      typed({ kind: "timestamptz" }),
    ],
    ["postgresql", "a DateTime @db.Timestamp(6)", typed({ kind: "timestamp" })],
    ["postgresql", "a DateTime @db.Date", typed({ kind: "date" })],
    ["postgresql", "a DateTime @db.Time(6)", typed({ kind: "time" })],
    ["postgresql", "a Json", typed({ kind: "json" })],
    ["postgresql", "a Bytes", typed({ kind: "binary" })],
    ["postgresql", "a Role", typed({ kind: "enum", enumName: "role_db" })],
    [
      "postgresql",
      'a Unsupported("circle")',
      typed({ kind: "custom", name: "circle" }),
    ],
    ["mysql", "a Int", typed({ kind: "integer" })],
    ["mysql", "a Int @db.SmallInt", typed({ kind: "smallint" })],
    ["mysql", "a BigInt", typed({ kind: "bigint" })],
    [
      "mysql",
      "a Decimal",
      typed({ kind: "decimal", precision: 65, scale: 30 }),
    ],
    ["mysql", "a Float", typed({ kind: "double" })],
    ["mysql", "a Float @db.Float", typed({ kind: "real" })],
    ["mysql", "a Boolean", typed({ kind: "boolean" })],
    ["mysql", "a String", typed({ kind: "varchar", length: 191 })],
    [
      "mysql",
      "a String @db.VarChar(50)",
      typed({ kind: "varchar", length: 50 }),
    ],
    ["mysql", "a String @db.Char(10)", typed({ kind: "char", length: 10 })],
    ["mysql", "a String @db.LongText", typed({ kind: "text" })],
    [
      "mysql",
      "a String @db.Text",
      typed({ kind: "text" }, ["type-approximated"]),
    ],
    ["mysql", "a DateTime", typed({ kind: "timestamp" })],
    ["mysql", "a DateTime @db.Timestamp(6)", typed({ kind: "timestamptz" })],
    ["mysql", "a DateTime @db.DateTime(6)", typed({ kind: "timestamp" })],
    ["mysql", "a DateTime @db.Date", typed({ kind: "date" })],
    ["mysql", "a DateTime @db.Time(6)", typed({ kind: "time" })],
    ["mysql", "a Json", typed({ kind: "json" })],
    ["mysql", "a Bytes", typed({ kind: "binary" })],
    ["mysql", "a Bytes @db.LongBlob", typed({ kind: "binary" })],
    ["mysql", "a Role", typed({ kind: "enum", enumName: "role_db" })],
    [
      "mysql",
      "a Int @db.UnsignedInt",
      typed({ kind: "bigint" }, ["type-approximated"]),
    ],
    ["sqlserver", "a Int", typed({ kind: "integer" })],
    ["sqlserver", "a Int @db.SmallInt", typed({ kind: "smallint" })],
    ["sqlserver", "a BigInt", typed({ kind: "bigint" })],
    [
      "sqlserver",
      "a Decimal",
      typed({ kind: "decimal", precision: 32, scale: 16 }),
    ],
    [
      "sqlserver",
      "a Decimal @db.Decimal(10, 2)",
      typed({ kind: "decimal", precision: 10, scale: 2 }),
    ],
    ["sqlserver", "a Float", typed({ kind: "double" })],
    ["sqlserver", "a Float @db.Real", typed({ kind: "real" })],
    ["sqlserver", "a Boolean", typed({ kind: "boolean" })],
    ["sqlserver", "a Boolean @db.Bit", typed({ kind: "boolean" })],
    ["sqlserver", "a String", typed({ kind: "varchar", length: 1000 })],
    [
      "sqlserver",
      "a String @db.NVarChar(100)",
      typed({ kind: "varchar", length: 100 }),
    ],
    [
      "sqlserver",
      "a String @db.NChar(10)",
      typed({ kind: "char", length: 10 }),
    ],
    ["sqlserver", "a String @db.NVarChar(Max)", typed({ kind: "text" })],
    ["sqlserver", "a String @db.UniqueIdentifier", typed({ kind: "uuid" })],
    ["sqlserver", "a DateTime", typed({ kind: "timestamp" })],
    [
      "sqlserver",
      "a DateTime @db.DateTimeOffset",
      typed({ kind: "timestamptz" }),
    ],
    ["sqlserver", "a DateTime @db.DateTime2", typed({ kind: "timestamp" })],
    ["sqlserver", "a DateTime @db.Date", typed({ kind: "date" })],
    ["sqlserver", "a DateTime @db.Time", typed({ kind: "time" })],
    ["sqlserver", "a Bytes", typed({ kind: "binary" })],
  ])("maps every row of the type table: %s %s", (provider, line, expected) => {
    expect(typeOf(line, provider)).toStrictEqual(expected);
  });

  it.each<readonly [SqlDialect, string, TypeSummary]>([
    [
      "postgresql",
      "a String @db.Inet",
      typed({ kind: "custom", name: "inet" }),
    ],
    [
      "postgresql",
      "a Decimal @db.Money",
      typed({ kind: "custom", name: "money" }),
    ],
    [
      "postgresql",
      "a String @db.Bit(3)",
      typed({ kind: "custom", name: "bit(3)" }),
    ],
    ["sqlserver", "a String @db.Xml", typed({ kind: "custom", name: "xml" })],
  ])(
    "maps unknown native types to custom: %s %s",
    (provider, line, expected) => {
      expect(typeOf(line, provider)).toStrictEqual(expected);
    },
  );

  it("drops a precision parameter that differs from the model default", () => {
    expect(mapField("a DateTime @db.Timestamp(3)")).toStrictEqual({
      type: { kind: "timestamp" },
      isAutoIncrement: false,
      defaultValue: null,
      diagnostics: [
        {
          code: "type-parameter-dropped",
          field: "type",
          position: { line: 2, column: 14 },
        },
      ],
    });
  });

  it.each<readonly [string, DraftColumnType]>([
    ["a String @db.Char(36) @default(uuid())", { kind: "uuid" }],
    [
      'a String @db.Char(36) @default(dbgenerated("(uuid())"))',
      { kind: "uuid" },
    ],
    [
      'a String @db.Char(36) @default(dbgenerated("(now())"))',
      { kind: "char", length: 36 },
    ],
    [
      "a String @db.Char(36) @default(dbgenerated(1))",
      { kind: "char", length: 36 },
    ],
    ["a String @db.Char(36)", { kind: "char", length: 36 }],
  ])("maps mysql char(36) with a uuid default to uuid: %s", (line, type) => {
    expect(mapField(line, "mysql").type).toStrictEqual(type);
  });

  it("keeps the db pull uuid default of a mysql char(36) column", () => {
    expect(
      mapField(
        'a String @db.Char(36) @default(dbgenerated("(uuid())"))',
        "mysql",
      ),
    ).toStrictEqual({
      type: { kind: "uuid" },
      isAutoIncrement: false,
      defaultValue: { kind: "generateUuid" },
      diagnostics: [],
    });
  });

  it.each<readonly [string, PrismaFieldMapping]>([
    [
      'a Unsupported("circle")',
      {
        type: { kind: "custom", name: "circle" },
        isAutoIncrement: false,
        defaultValue: null,
        diagnostics: [],
      },
    ],
    [
      'a Unsupported("int; drop table x")',
      {
        type: { kind: "text" },
        isAutoIncrement: false,
        defaultValue: null,
        diagnostics: [
          {
            code: "type-not-supported",
            field: "type",
            position: { line: 2, column: 3 },
          },
        ],
      },
    ],
  ])("maps safe and unsafe Unsupported types: %s", (line, expected) => {
    expect(mapField(line)).toStrictEqual(expected);
  });

  it.each<readonly [string, TypeSummary]>([
    [
      "a Int[]",
      typed({ kind: "custom", name: "integer[]" }, ["scalar-list-as-custom"]),
    ],
    [
      "a Float[]",
      typed({ kind: "custom", name: "double precision[]" }, [
        "scalar-list-as-custom",
      ]),
    ],
    [
      "a String[] @db.VarChar(10)",
      typed({ kind: "custom", name: "varchar(10)[]" }, [
        "scalar-list-as-custom",
      ]),
    ],
    [
      "a Role[]",
      typed({ kind: "custom", name: "role_db[]" }, ["scalar-list-as-custom"]),
    ],
    [
      'a Unsupported("int; x")[]',
      typed({ kind: "text" }, ["scalar-list-as-custom", "type-not-supported"]),
    ],
  ])(
    "maps scalar lists to custom with scalar-list-as-custom: %s",
    (line, expected) => {
      expect(typeOf(line, "postgresql")).toStrictEqual(expected);
    },
  );

  it("maps an unknown scalar type to text with type-not-supported", () => {
    expect(typeOf("a Strin", "postgresql")).toStrictEqual(
      typed({ kind: "text" }, ["type-not-supported"]),
    );
  });

  it("maps a native type with an unreadable argument to text with type-not-supported", () => {
    expect(typeOf('a String @db.VarChar("x")', "postgresql")).toStrictEqual(
      typed({ kind: "text" }, ["type-not-supported"]),
    );
  });

  it.each<readonly [string, DefaultSummary]>([
    ["a Int @default(autoincrement())", defaulted(null, [], true)],
    ["a DateTime @default(now())", defaulted({ kind: "currentTimestamp" })],
    ["a String @db.Uuid @default(uuid())", GENERATE_UUID],
    ["a String @db.Uuid @default(uuid(4))", GENERATE_UUID],
    [
      "a String @db.Uuid @default(uuid(7))",
      defaulted({ kind: "generateUuid" }, ["default-approximated"]),
    ],
    ["a String @db.Uuid @default(uuid(5))", NOT_SUPPORTED],
    ["a String @default(cuid())", NOT_SUPPORTED],
    ["a String @default(cuid(2))", NOT_SUPPORTED],
    ["a String @default(nanoid())", NOT_SUPPORTED],
    ["a String @default(ulid())", NOT_SUPPORTED],
    ["a BigInt @default(sequence())", NOT_SUPPORTED],
    ['a String @default("it\\"s")', literal('it"s')],
    ["a Int @default(-5)", literal("-5")],
    ["a Decimal @default(1.50)", literal("1.50")],
    ["a Boolean @default(true)", literal("true")],
    ["a Boolean @default(false)", literal("false")],
    ["a String @default(other)", NOT_SUPPORTED],
    [
      "a Int[] @default([])",
      defaulted(null, ["scalar-list-as-custom", "default-not-supported"]),
    ],
    ["a String @default(dbgenerated())", NOT_SUPPORTED],
    ['a String @default(map: "df_a")', NOT_SUPPORTED],
    ['a String @default("x", map: "df_a")', literal("x")],
    ["a Int", defaulted(null)],
  ])("maps every row of the default table: %s", (line, expected) => {
    expect(defaultOf(line, "postgresql")).toStrictEqual(expected);
  });

  it.each<readonly [SqlDialect, string, DefaultSummary]>([
    [
      "postgresql",
      `a DateTime @db.Date @default(dbgenerated("'2024-01-01'::date"))`,
      literal("2024-01-01"),
    ],
    [
      "postgresql",
      `a Int @default(dbgenerated("nextval('a_seq'::regclass)"))`,
      defaulted(null, ["sequence-default-as-auto-increment"], true),
    ],
    [
      "mysql",
      `a String @db.LongText @default(dbgenerated("('it''s')"))`,
      literal("it's"),
    ],
    [
      "sqlserver",
      `a DateTime @default(dbgenerated("getdate()"))`,
      defaulted({ kind: "currentTimestamp" }),
    ],
    ["postgresql", `a Int @default(dbgenerated("random()"))`, NOT_SUPPORTED],
    [
      "postgresql",
      `a DateTime @db.Timestamptz(6) @default(dbgenerated("'2026-01-01 20:04:05.123+00'::timestamp with time zone"))`,
      literal("2026-01-01T20:04:05.123+00:00"),
    ],
    [
      "mysql",
      `a DateTime @db.DateTime(6) @default(dbgenerated("'2026-01-02 03:04:05.000000'"))`,
      literal("2026-01-02T03:04:05.000000"),
    ],
    [
      "mysql",
      String.raw`a String @db.LongText @default(dbgenerated("(_utf8mb4\\'a\\\\\\\\b\\')"))`,
      literal(String.raw`a\b`),
    ],
    [
      "mysql",
      String.raw`a String @db.LongText @default(dbgenerated("(_utf8mb4\\'it\\\\\\'s\\')"))`,
      literal("it's"),
    ],
    [
      "mysql",
      String.raw`a String @db.LongText @default(dbgenerated("(_utf8mb4'a\\\\b')"))`,
      literal(String.raw`a\b`),
    ],
    [
      "mysql",
      String.raw`a String @db.LongText @default(dbgenerated("(\\'a\\')"))`,
      NOT_SUPPORTED,
    ],
    [
      "postgresql",
      String.raw`a String @default(dbgenerated("(_utf8mb4\\'a\\')"))`,
      NOT_SUPPORTED,
    ],
  ])(
    "reads dbgenerated defaults through the sql default mapping: %s %s",
    (provider, line, expected) => {
      expect(defaultOf(line, provider)).toStrictEqual(expected);
    },
  );

  it.each<readonly [string, DefaultSummary]>([
    ["a Role @default(ADMIN)", literal("admin")],
    ["a Role @default(USER)", literal("USER")],
    ["a Role @default(GUEST)", NOT_SUPPORTED],
  ])("maps an enum default through @map: %s", (line, expected) => {
    expect(defaultOf(line, "postgresql")).toStrictEqual(expected);
  });

  it("reports default diagnostics at the default attribute", () => {
    expect(mapField("a String @default(cuid())").diagnostics).toStrictEqual([
      {
        code: "default-not-supported",
        field: "defaultValue",
        position: { line: 2, column: 12 },
      },
    ]);
  });
});
