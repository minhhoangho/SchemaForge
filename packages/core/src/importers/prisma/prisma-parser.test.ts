import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generatePrisma } from "../../generators/prisma/generate-prisma.js";
import { PROPERTY_RUNS, PROPERTY_SEED } from "../../testing/arbitraries.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { unwrapError, unwrapOk } from "../../testing/unwrap-result.js";
import type { PrismaPosition, PrismaSchema } from "./prisma-ast.js";
import { MAX_PRISMA_NESTING, parsePrismaSchema } from "./prisma-parser.js";

const PROPERTY_PARAMETERS = { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS };
// Parsing is fast; the slack covers fast-check under a loaded coverage run.
const PROPERTY_TIMEOUT_MS = 60_000;

function at(line: number, column: number): PrismaPosition {
  return { line, column };
}

function parse(lines: readonly string[]): PrismaSchema {
  return unwrapOk(parsePrismaSchema(lines.join("\n")));
}

function parseError(lines: readonly string[]): PrismaPosition {
  return unwrapError(parsePrismaSchema(lines.join("\n"))).position;
}

describe("parsePrismaSchema", () => {
  it("parses an empty schema", () => {
    expect(parse(["", "// nothing here", ""])).toStrictEqual({ blocks: [] });
  });

  it("parses a datasource with provider and url", () => {
    expect(
      parse([
        "datasource db {",
        '  provider = "postgresql"',
        '  url      = env("DATABASE_URL")',
        "}",
      ]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "datasource",
          name: "db",
          properties: [
            {
              name: "provider",
              value: {
                kind: "string",
                value: "postgresql",
                position: at(2, 14),
              },
              position: at(2, 3),
            },
            {
              name: "url",
              value: {
                kind: "call",
                name: "env",
                args: [
                  {
                    name: null,
                    value: {
                      kind: "string",
                      value: "DATABASE_URL",
                      position: at(3, 18),
                    },
                    position: at(3, 18),
                  },
                ],
                position: at(3, 14),
              },
              position: at(3, 3),
            },
          ],
          position: at(1, 1),
        },
      ],
    });
  });

  it("parses a generator block", () => {
    expect(
      parse([
        "generator client {",
        '  features = ["views", ]',
        "  enabled = true",
        "}",
      ]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "generator",
          name: "client",
          properties: [
            {
              name: "features",
              value: {
                kind: "array",
                items: [
                  { kind: "string", value: "views", position: at(2, 15) },
                ],
                position: at(2, 14),
              },
              position: at(2, 3),
            },
            {
              name: "enabled",
              value: { kind: "identifier", name: "true", position: at(3, 13) },
              position: at(3, 3),
            },
          ],
          position: at(1, 1),
        },
      ],
    });
  });

  it("parses a model with optional, list and Unsupported fields", () => {
    expect(
      parse([
        "model Post {",
        "  id Int",
        "  title String?",
        "  tags String[]",
        '  shape Unsupported("geometry(Point, 4326)")?',
        "}",
      ]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "model",
          name: "Post",
          fields: [
            {
              name: "id",
              typeName: "Int",
              isOptional: false,
              isList: false,
              unsupportedType: null,
              attributes: [],
              docComment: null,
              position: at(2, 3),
            },
            {
              name: "title",
              typeName: "String",
              isOptional: true,
              isList: false,
              unsupportedType: null,
              attributes: [],
              docComment: null,
              position: at(3, 3),
            },
            {
              name: "tags",
              typeName: "String",
              isOptional: false,
              isList: true,
              unsupportedType: null,
              attributes: [],
              docComment: null,
              position: at(4, 3),
            },
            {
              name: "shape",
              typeName: "Unsupported",
              isOptional: true,
              isList: false,
              unsupportedType: "geometry(Point, 4326)",
              attributes: [],
              docComment: null,
              position: at(5, 3),
            },
          ],
          blockAttributes: [],
          docComment: null,
          position: at(1, 1),
        },
      ],
    });
  });

  it("parses field attributes with positional and named arguments", () => {
    expect(
      parse([
        "model A {",
        "  id Int @id @default(autoincrement())",
        '  b B @relation("r", fields: [bId], onDelete: Cascade)',
        "}",
      ]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "model",
          name: "A",
          fields: [
            {
              name: "id",
              typeName: "Int",
              isOptional: false,
              isList: false,
              unsupportedType: null,
              attributes: [
                { name: "id", args: [], position: at(2, 10) },
                {
                  name: "default",
                  args: [
                    {
                      name: null,
                      value: {
                        kind: "call",
                        name: "autoincrement",
                        args: [],
                        position: at(2, 23),
                      },
                      position: at(2, 23),
                    },
                  ],
                  position: at(2, 14),
                },
              ],
              docComment: null,
              position: at(2, 3),
            },
            {
              name: "b",
              typeName: "B",
              isOptional: false,
              isList: false,
              unsupportedType: null,
              attributes: [
                {
                  name: "relation",
                  args: [
                    {
                      name: null,
                      value: {
                        kind: "string",
                        value: "r",
                        position: at(3, 17),
                      },
                      position: at(3, 17),
                    },
                    {
                      name: "fields",
                      value: {
                        kind: "array",
                        items: [
                          {
                            kind: "identifier",
                            name: "bId",
                            position: at(3, 31),
                          },
                        ],
                        position: at(3, 30),
                      },
                      position: at(3, 22),
                    },
                    {
                      name: "onDelete",
                      value: {
                        kind: "identifier",
                        name: "Cascade",
                        position: at(3, 47),
                      },
                      position: at(3, 37),
                    },
                  ],
                  position: at(3, 7),
                },
              ],
              docComment: null,
              position: at(3, 3),
            },
          ],
          blockAttributes: [],
          docComment: null,
          position: at(1, 1),
        },
      ],
    });
  });

  it("parses block attributes such as @@id, @@unique, @@index and @@map", () => {
    expect(
      parse([
        "model A {",
        "  a Int",
        "",
        "  @@id([a, b])",
        '  @@unique([a], map: "u")',
        "  @@index([a(sort: Desc)])",
        '  @@map("t")',
        "}",
      ]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "model",
          name: "A",
          fields: [
            {
              name: "a",
              typeName: "Int",
              isOptional: false,
              isList: false,
              unsupportedType: null,
              attributes: [],
              docComment: null,
              position: at(2, 3),
            },
          ],
          blockAttributes: [
            {
              name: "id",
              args: [
                {
                  name: null,
                  value: {
                    kind: "array",
                    items: [
                      { kind: "identifier", name: "a", position: at(4, 9) },
                      { kind: "identifier", name: "b", position: at(4, 12) },
                    ],
                    position: at(4, 8),
                  },
                  position: at(4, 8),
                },
              ],
              position: at(4, 3),
            },
            {
              name: "unique",
              args: [
                {
                  name: null,
                  value: {
                    kind: "array",
                    items: [
                      { kind: "identifier", name: "a", position: at(5, 13) },
                    ],
                    position: at(5, 12),
                  },
                  position: at(5, 12),
                },
                {
                  name: "map",
                  value: { kind: "string", value: "u", position: at(5, 22) },
                  position: at(5, 17),
                },
              ],
              position: at(5, 3),
            },
            {
              name: "index",
              args: [
                {
                  name: null,
                  value: {
                    kind: "array",
                    items: [
                      {
                        kind: "call",
                        name: "a",
                        args: [
                          {
                            name: "sort",
                            value: {
                              kind: "identifier",
                              name: "Desc",
                              position: at(6, 20),
                            },
                            position: at(6, 14),
                          },
                        ],
                        position: at(6, 12),
                      },
                    ],
                    position: at(6, 11),
                  },
                  position: at(6, 11),
                },
              ],
              position: at(6, 3),
            },
            {
              name: "map",
              args: [
                {
                  name: null,
                  value: { kind: "string", value: "t", position: at(7, 9) },
                  position: at(7, 9),
                },
              ],
              position: at(7, 3),
            },
          ],
          docComment: null,
          position: at(1, 1),
        },
      ],
    });
  });

  it("parses native type attributes such as @db.VarChar(255)", () => {
    expect(
      parse(["model A {", "  a String @db.VarChar(255) @db.Uuid", "}"]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "model",
          name: "A",
          fields: [
            {
              name: "a",
              typeName: "String",
              isOptional: false,
              isList: false,
              unsupportedType: null,
              attributes: [
                {
                  name: "db.VarChar",
                  args: [
                    {
                      name: null,
                      value: {
                        kind: "number",
                        text: "255",
                        position: at(2, 24),
                      },
                      position: at(2, 24),
                    },
                  ],
                  position: at(2, 12),
                },
                { name: "db.Uuid", args: [], position: at(2, 29) },
              ],
              docComment: null,
              position: at(2, 3),
            },
          ],
          blockAttributes: [],
          docComment: null,
          position: at(1, 1),
        },
      ],
    });
  });

  it("parses an enum with @map on values", () => {
    expect(
      parse([
        "enum Role {",
        '  user @map("u")',
        "  admin",
        '  @@map("roles")',
        "}",
      ]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "enum",
          name: "Role",
          values: [
            {
              name: "user",
              attributes: [
                {
                  name: "map",
                  args: [
                    {
                      name: null,
                      value: {
                        kind: "string",
                        value: "u",
                        position: at(2, 13),
                      },
                      position: at(2, 13),
                    },
                  ],
                  position: at(2, 8),
                },
              ],
              docComment: null,
              position: at(2, 3),
            },
            {
              name: "admin",
              attributes: [],
              docComment: null,
              position: at(3, 3),
            },
          ],
          blockAttributes: [
            {
              name: "map",
              args: [
                {
                  name: null,
                  value: { kind: "string", value: "roles", position: at(4, 9) },
                  position: at(4, 9),
                },
              ],
              position: at(4, 3),
            },
          ],
          docComment: null,
          position: at(1, 1),
        },
      ],
    });
  });

  it("parses view and type blocks", () => {
    expect(
      parse(["view V {", "  a Int", "}", "type T {", "  b String", "}"]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "view",
          name: "V",
          fields: [
            {
              name: "a",
              typeName: "Int",
              isOptional: false,
              isList: false,
              unsupportedType: null,
              attributes: [],
              docComment: null,
              position: at(2, 3),
            },
          ],
          blockAttributes: [],
          docComment: null,
          position: at(1, 1),
        },
        {
          kind: "type",
          name: "T",
          fields: [
            {
              name: "b",
              typeName: "String",
              isOptional: false,
              isList: false,
              unsupportedType: null,
              attributes: [],
              docComment: null,
              position: at(5, 3),
            },
          ],
          blockAttributes: [],
          docComment: null,
          position: at(4, 1),
        },
      ],
    });
  });

  it("attaches multi-line doc comments to the next block, field and enum value", () => {
    expect(
      parse([
        "/// Users",
        "///table",
        "model User {",
        "  /// The id",
        "  ///   indented",
        "  id Int",
        "}",
        "/// Status",
        "enum Status {",
        "  /// Active",
        "  active",
        "}",
      ]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "model",
          name: "User",
          fields: [
            {
              name: "id",
              typeName: "Int",
              isOptional: false,
              isList: false,
              unsupportedType: null,
              attributes: [],
              docComment: "The id\n  indented",
              position: at(6, 3),
            },
          ],
          blockAttributes: [],
          docComment: "Users\ntable",
          position: at(3, 1),
        },
        {
          kind: "enum",
          name: "Status",
          values: [
            {
              name: "active",
              attributes: [],
              docComment: "Active",
              position: at(11, 3),
            },
          ],
          blockAttributes: [],
          docComment: "Status",
          position: at(9, 1),
        },
      ],
    });
  });

  it("appends a trailing doc comment to the field documentation", () => {
    expect(
      parse(["model A {", "  /// Lead", "  a Int /// trailing", "}"]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "model",
          name: "A",
          fields: [
            {
              name: "a",
              typeName: "Int",
              isOptional: false,
              isList: false,
              unsupportedType: null,
              attributes: [],
              docComment: "Lead\ntrailing",
              position: at(3, 3),
            },
          ],
          blockAttributes: [],
          docComment: null,
          position: at(1, 1),
        },
      ],
    });
  });

  it("drops doc comments separated from the next element by a blank line", () => {
    expect(
      parse([
        "/// Detached",
        "",
        "enum E {",
        "  /// Before attribute",
        '  @@map("e")',
        "}",
      ]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "enum",
          name: "E",
          values: [],
          blockAttributes: [
            {
              name: "map",
              args: [
                {
                  name: null,
                  value: { kind: "string", value: "e", position: at(5, 9) },
                  position: at(5, 9),
                },
              ],
              position: at(5, 3),
            },
          ],
          docComment: null,
          position: at(3, 1),
        },
      ],
    });
  });

  it("accepts line breaks inside argument lists", () => {
    expect(
      parse(["generator g {", "  list = [", '    "a",', "  ]", "}"]),
    ).toStrictEqual({
      blocks: [
        {
          kind: "generator",
          name: "g",
          properties: [
            {
              name: "list",
              value: {
                kind: "array",
                items: [{ kind: "string", value: "a", position: at(3, 5) }],
                position: at(2, 10),
              },
              position: at(2, 3),
            },
          ],
          position: at(1, 1),
        },
      ],
    });
  });

  it.each([
    ["an unknown block keyword", ["table A {", "}"], at(1, 1)],
    ["a missing block name", ["model {", "}"], at(1, 7)],
    ["a missing opening brace", ["model A", "}"], at(1, 8)],
    ["a missing field type", ["model A {", "  id", "}"], at(2, 5)],
    ["a quoted field name", ["model A {", '  "id" Int', "}"], at(2, 3)],
    [
      "a token after the attributes",
      ["model A {", "  id Int @id x", "}"],
      at(2, 14),
    ],
    [
      "a list marker that is not closed",
      ["model A {", "  a Int[", "}"],
      at(2, 9),
    ],
    [
      "an attribute without a name",
      ["model A {", '  a Int @"x"', "}"],
      at(2, 10),
    ],
    [
      "a dotted name without a second part",
      ["model A {", "  a Int @db.(1)", "}"],
      at(2, 13),
    ],
    [
      "an Unsupported type without a string",
      ["model A {", "  a Unsupported(1)", "}"],
      at(2, 17),
    ],
    ["an empty argument", ["model A {", "  a Int @default(,)", "}"], at(2, 18)],
    [
      "a named argument without a value",
      ["model A {", "  a B @relation(fields: )", "}"],
      at(2, 25),
    ],
    [
      "a missing comma between arguments",
      ["model A {", "  a Int @default(1 2)", "}"],
      at(2, 20),
    ],
    [
      "a property without an equals sign",
      ["datasource db {", '  provider "x"', "}"],
      at(2, 12),
    ],
    ["a block that is never closed", ["model A {", "  a Int"], at(2, 8)],
    [
      "a second block on the closing line",
      ["model A {", "} model B {", "}"],
      at(2, 3),
    ],
    ["an unexpected character", ["model A {", "  a Int #", "}"], at(2, 9)],
  ])(
    "reports the position of the first unexpected token: %s",
    (_label, lines, position) => {
      expect(parseError(lines)).toStrictEqual(position);
    },
  );

  it("accepts arguments nested exactly to the limit", () => {
    const depth = MAX_PRISMA_NESTING - 1;
    expect(
      parse([
        "model A {",
        `  a Int @default(${"[".repeat(depth)}${"]".repeat(depth)})`,
        "}",
      ]).blocks,
    ).toHaveLength(1);
  });

  it("rejects arguments nested deeper than the limit", () => {
    const depth = MAX_PRISMA_NESTING;
    const firstBracketColumn = "  a Int @default(".length + 1;
    expect(
      parseError([
        "model A {",
        `  a Int @default(${"[".repeat(depth)}${"]".repeat(depth)})`,
        "}",
      ]),
    ).toStrictEqual(at(2, firstBracketColumn + depth - 1));
  });

  it.each([
    [
      "postgresql",
      [
        "generator client",
        "datasource db",
        "enum OrderStatus",
        "model OrderItems",
        "model Orders",
        "model Tags",
        "model Tenants",
        "model UserProfiles",
        "model UserTags",
        "model Users",
      ],
    ],
    [
      "mysql",
      [
        "generator client",
        "datasource db",
        "enum OrderStatus",
        "model OrderItems",
        "model Orders",
        "model Tags",
        "model Tenants",
        "model UserProfiles",
        "model UserTags",
        "model Users",
      ],
    ],
    [
      "sqlserver",
      [
        "generator client",
        "datasource db",
        "model OrderItems",
        "model Orders",
        "model Tags",
        "model Tenants",
        "model UserProfiles",
        "model UserTags",
        "model Users",
      ],
    ],
  ] as const)(
    "parses the output of generatePrisma for the sample schema with %s",
    (provider, blocks) => {
      const source = generatePrisma(createSampleSchema(), { provider }).file
        .content;
      expect(
        unwrapOk(parsePrismaSchema(source)).blocks.map(
          (block) => `${block.kind} ${block.name}`,
        ),
      ).toStrictEqual(blocks);
    },
  );

  it.each([
    ["naming-edge", createNamingEdgeSchema, "postgresql", 11],
    ["naming-edge", createNamingEdgeSchema, "mysql", 11],
    ["naming-edge", createNamingEdgeSchema, "sqlserver", 10],
    ["target-limit", createTargetLimitSchema, "postgresql", 46],
    ["target-limit", createTargetLimitSchema, "mysql", 46],
    ["target-limit", createTargetLimitSchema, "sqlserver", 45],
  ] as const)(
    "parses every block that generatePrisma writes for the %s schema with %s",
    (_name, createSchema, provider, blockCount) => {
      const source = generatePrisma(createSchema(), { provider }).file.content;
      expect(unwrapOk(parsePrismaSchema(source)).blocks).toHaveLength(
        blockCount,
      );
    },
  );

  it("never throws on arbitrary text", { timeout: PROPERTY_TIMEOUT_MS }, () => {
    expect(() => {
      fc.assert(
        fc.property(fc.string({ unit: "binary" }), (source) => {
          parsePrismaSchema(source);
        }),
        PROPERTY_PARAMETERS,
      );
    }).not.toThrow();
  });

  it(
    "never throws on generated schemas with text inserted at any point",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      const source = generatePrisma(createSampleSchema(), {
        provider: "postgresql",
      }).file.content;
      expect(() => {
        fc.assert(
          fc.property(
            fc.nat({ max: source.length }),
            fc.string({ unit: "binary", maxLength: 3 }),
            (cut, inserted) => {
              parsePrismaSchema(
                `${source.slice(0, cut)}${inserted}${source.slice(cut)}`,
              );
            },
          ),
          PROPERTY_PARAMETERS,
        );
      }).not.toThrow();
    },
  );
});
