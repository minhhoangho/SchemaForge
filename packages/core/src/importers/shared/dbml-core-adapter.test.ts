import { describe, expect, it } from "vitest";

import { err } from "../../result.js";
import { unwrapOk } from "../../testing/unwrap-result.js";
import {
  parseDbmlWithDbmlCore,
  parseSqlWithDbmlCore,
  toParseFailureDiagnostics,
} from "./dbml-core-adapter.js";
import type { CoreDatabase, CoreField } from "./dbml-core-adapter-types.js";

const NO_PROJECT = { name: null, databaseType: null, note: null };

// The ANTLR sql parsers take up to a second per call, more on a loaded machine.
const SQL_PARSE_TIMEOUT = { timeout: 30_000 };

function createField(overrides: Partial<CoreField>): CoreField {
  return {
    name: "id",
    typeName: "int",
    isPrimaryKey: false,
    isUnique: false,
    isNotNull: false,
    isIncrement: false,
    defaultValue: null,
    note: null,
    checks: [],
    token: null,
    ...overrides,
  };
}

describe("parseSqlWithDbmlCore", SQL_PARSE_TIMEOUT, () => {
  it.each([
    { dialect: "postgresql", source: "CREATE TABLE a (id int);\nfoo bar;\n" },
    { dialect: "mysql", source: "CREATE TABLE a (id int);\nfoo bar;\n" },
    { dialect: "sqlserver", source: "CREATE TABLE a (id int);\n) x;\n" },
  ] as const)(
    "maps a sql syntax error at the start of a line to column 1 ($dialect)",
    ({ dialect, source }) => {
      expect(parseSqlWithDbmlCore(source, dialect)).toStrictEqual(
        err([
          {
            code: "syntax-error",
            location: { line: 2, column: 1 },
            path: null,
          },
        ]),
      );
    },
  );

  it("reports a parser failure entry without a position as a syntax error without location", () => {
    expect(
      parseSqlWithDbmlCore("CREATE TABLE t (a int REFERENCES);", "postgresql"),
    ).toStrictEqual(
      err([{ code: "syntax-error", location: null, path: null }]),
    );
  });

  it("narrows a parsed table with fields, indexes and tokens", () => {
    const result = parseSqlWithDbmlCore(
      [
        "CREATE TYPE status AS ENUM ('a');",
        "CREATE TABLE p (id serial PRIMARY KEY);",
        "CREATE TABLE other.c (",
        "  id int NOT NULL UNIQUE,",
        "  s status DEFAULT 'a' CHECK (s <> 'b'),",
        "  p_id int REFERENCES p (id) ON DELETE CASCADE,",
        "  CONSTRAINT c_s_check CHECK (id > 0)",
        ");",
        "CREATE INDEX c_expr_idx ON other.c USING hash (lower(s::text), id);",
        "COMMENT ON TABLE other.c IS 'child';",
      ].join("\n"),
      "postgresql",
    );

    expect(result).toStrictEqual<typeof result>({
      isOk: true,
      value: {
        project: NO_PROJECT,
        tables: [
          {
            name: "p",
            schemaName: "public",
            note: null,
            headerColor: null,
            fields: [
              createField({
                typeName: "serial",
                isPrimaryKey: true,
                isIncrement: true,
              }),
            ],
            indexes: [],
            checks: [],
            token: null,
          },
          {
            name: "c",
            schemaName: "other",
            note: "child",
            headerColor: null,
            fields: [
              createField({ isUnique: true, isNotNull: true }),
              createField({
                name: "s",
                typeName: "status",
                defaultValue: { type: "string", value: "a" },
                checks: [{ name: null, expression: "s <> 'b'", token: null }],
              }),
              createField({ name: "p_id" }),
            ],
            indexes: [
              {
                name: "c_expr_idx",
                columns: [
                  { value: "lower(s::text)", isExpression: true },
                  { value: "id", isExpression: false },
                ],
                isUnique: false,
                isPrimaryKey: false,
                type: "hash",
                note: null,
                token: null,
              },
            ],
            checks: [{ name: "c_s_check", expression: "id > 0", token: null }],
            token: null,
          },
        ],
        refs: [
          {
            name: null,
            color: null,
            endpoints: [
              {
                schemaName: "other",
                tableName: "c",
                columnNames: ["p_id"],
                relation: "*",
              },
              {
                schemaName: null,
                tableName: "p",
                columnNames: ["id"],
                relation: "1",
              },
            ],
            onDelete: "CASCADE",
            onUpdate: null,
            token: null,
          },
        ],
        enums: [
          { name: "status", values: [{ name: "a", note: null }], token: null },
        ],
        tableGroups: [],
        notes: [],
        records: null,
      },
    });
  });

  it("lists tables of every schema in source order", () => {
    const result = parseSqlWithDbmlCore(
      "CREATE TABLE other.a (id int);\nCREATE TABLE b (id int);\nCREATE TABLE other.c (id int);\n",
      "postgresql",
    );

    expect(unwrapOk(result).tables.map((table) => table.name)).toStrictEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("parseDbmlWithDbmlCore", () => {
  it("maps a dbml syntax error at the start of a line to column 1", () => {
    expect(
      parseDbmlWithDbmlCore("Table a {\n  id int\n}\nfoo bar\n"),
    ).toStrictEqual(
      err([
        { code: "syntax-error", location: { line: 4, column: 1 }, path: null },
        { code: "syntax-error", location: { line: 4, column: 5 }, path: null },
        { code: "syntax-error", location: { line: 5, column: 1 }, path: null },
      ]),
    );
  });

  it("narrows a dbml project, table group and note", () => {
    const result = parseDbmlWithDbmlCore(
      [
        "Project shop {",
        "  database_type: 'MySQL'",
        "  Note: 'about'",
        "}",
        "Table users [headercolor: #3498DB] {",
        "  id int [pk, default: 1.5, note: 'key']",
        "}",
        "Table posts {",
        "  user_id int [ref: > users.id]",
        "}",
        "TableGroup core [color: #00ff00, note: 'group'] {",
        "  users",
        "}",
        "Note sticky {",
        "  'remember'",
        "}",
        "Records users(id) {",
        "  1",
        "}",
      ].join("\n"),
    );

    expect(result).toMatchObject({
      isOk: true,
      value: {
        project: { name: "shop", databaseType: "MySQL", note: "about" },
        tables: [
          {
            name: "users",
            headerColor: "#3498DB",
            fields: [
              {
                isPrimaryKey: true,
                defaultValue: { type: "number", value: "1.5" },
                note: "key",
                token: {
                  start: { line: 6, column: 3 },
                  end: { line: 6, column: 41 },
                },
              },
            ],
            token: {
              start: { line: 5, column: 1 },
              end: { line: 7, column: 2 },
            },
          },
          { name: "posts" },
        ],
        refs: [
          {
            endpoints: [
              { tableName: "users", relation: "1" },
              { tableName: "posts", relation: "*" },
            ],
            token: { start: { line: 9, column: 16 } },
          },
        ],
        tableGroups: [
          {
            name: "core",
            tableNames: ["users"],
            note: "group",
            color: "#00ff00",
            token: {
              start: { line: 11, column: 1 },
              end: { line: 13, column: 2 },
            },
          },
        ],
        notes: [
          {
            content: "remember",
            token: {
              start: { line: 14, column: 1 },
              end: { line: 16, column: 2 },
            },
          },
        ],
        records: {
          token: {
            start: { line: 17, column: 1 },
            end: { line: 19, column: 2 },
          },
        },
      },
    });
  });

  it("reads an empty source as an empty database", () => {
    expect(parseDbmlWithDbmlCore("")).toStrictEqual({
      isOk: true,
      value: {
        project: NO_PROJECT,
        tables: [],
        refs: [],
        enums: [],
        tableGroups: [],
        notes: [],
        records: null,
      } satisfies CoreDatabase,
    });
  });
});

describe("toParseFailureDiagnostics", () => {
  it.each([
    {
      label: "a RangeError",
      thrown: new RangeError("Maximum call stack size exceeded"),
    },
    { label: "a string", thrown: "failure" },
    { label: "null", thrown: null },
    { label: "an empty diags list", thrown: { diags: [] } },
    { label: "a diags value that is not a list", thrown: { diags: "x" } },
  ])("returns parse-failed when the parser throws $label", ({ thrown }) => {
    expect(toParseFailureDiagnostics(thrown, 0)).toStrictEqual([
      { code: "parse-failed", location: null, path: null },
    ]);
  });

  it.each([
    { label: "a non-numeric line", start: { line: "2", column: 0 } },
    { label: "a missing column", start: { line: 2 } },
  ])("reports a diag entry with $label without location", ({ start }) => {
    expect(
      toParseFailureDiagnostics({ diags: [{ location: { start } }] }, 0),
    ).toStrictEqual([{ code: "syntax-error", location: null, path: null }]);
  });
});
