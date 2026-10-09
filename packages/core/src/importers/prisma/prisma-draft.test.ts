import { describe, expect, it } from "vitest";

import { unwrapOk } from "../../testing/unwrap-result.js";
import type {
  DraftColumn,
  DraftDiagnostic,
  DraftIndex,
  DraftTable,
  ImportDraft,
} from "../shared/import-draft.js";
import { buildPrismaDraft } from "./prisma-draft.js";
import { parsePrismaSchema } from "./prisma-parser.js";

const DATASOURCE = ["datasource db {", '  provider = "postgresql"', "}"];

function draftOf(lines: readonly string[]): ImportDraft {
  return buildPrismaDraft(unwrapOk(parsePrismaSchema(lines.join("\n"))));
}

// The model starts on line 4, after the three datasource lines.
function modelDraft(members: readonly string[]): ImportDraft {
  return draftOf([...DATASOURCE, "model User {", ...members, "}"]);
}

function draftColumn(overrides: Partial<DraftColumn>): DraftColumn {
  return {
    name: "id",
    type: { kind: "integer" },
    isNullable: false,
    isUnique: false,
    isAutoIncrement: false,
    defaultValue: null,
    comment: "",
    location: { line: 5, column: 3 },
    ...overrides,
  };
}

function draftIndex(overrides: Partial<DraftIndex>): DraftIndex {
  return {
    tableName: "User",
    name: null,
    columnNames: ["a"],
    isUnique: false,
    location: { line: 7, column: 3 },
    ...overrides,
  };
}

function firstTable(draft: ImportDraft): DraftTable | undefined {
  return draft.tables[0];
}

const TWO_COLUMNS = ["  a Int", "  b Int"];

describe("buildPrismaDraft names", () => {
  it("names the table after @@map", () => {
    const draft = modelDraft(["  id Int", '  @@map("users")']);

    expect(firstTable(draft)?.name).toBe("users");
  });

  it("names a column after @map", () => {
    const draft = modelDraft(['  tenantId Int @map("tenant_id")']);

    expect(firstTable(draft)?.columns).toStrictEqual([
      draftColumn({ name: "tenant_id" }),
    ]);
  });

  it("names an enum and its values after @@map and @map", () => {
    const draft = draftOf([
      ...DATASOURCE,
      "enum Status {",
      '  choXuLy @map("chờ xử lý")',
      "  paid",
      '  @@map("order_status")',
      "}",
    ]);

    expect(draft.enums).toStrictEqual([
      {
        name: "order_status",
        values: ["chờ xử lý", "paid"],
        location: { line: 4, column: 1 },
      },
    ]);
  });

  it("types a column with the mapped enum name and default value", () => {
    const draft = draftOf([
      ...DATASOURCE,
      "enum Status {",
      '  choXuLy @map("chờ xử lý")',
      '  @@map("order_status")',
      "}",
      "model Order {",
      "  status Status @default(choXuLy)",
      "}",
    ]);

    expect(firstTable(draft)?.columns).toStrictEqual([
      draftColumn({
        name: "status",
        type: { kind: "enum", enumName: "order_status" },
        defaultValue: { kind: "literal", value: "chờ xử lý" },
        location: { line: 9, column: 3 },
      }),
    ]);
  });

  it("leaves the schema name to the import options", () => {
    expect(modelDraft(["  id Int"]).name).toBeNull();
  });
});

describe("buildPrismaDraft keys, unique and indexes", () => {
  it("reads @id as a one-column primary key", () => {
    const draft = modelDraft(["  id Int @id"]);

    expect(firstTable(draft)?.primaryKeyColumnNames).toStrictEqual(["id"]);
  });

  it("reads @@id in its own order with mapped column names", () => {
    const draft = modelDraft([
      '  a Int @map("a_col")',
      "  b Int",
      "  @@id([b, a])",
    ]);

    expect(firstTable(draft)?.primaryKeyColumnNames).toStrictEqual([
      "b",
      "a_col",
    ]);
  });

  it("reads @unique as a unique column", () => {
    const draft = modelDraft(["  id Int @unique"]);

    expect(firstTable(draft)?.columns).toStrictEqual([
      draftColumn({ isUnique: true }),
    ]);
  });

  it.each([
    [
      '@@unique([a, b], map: "x")',
      draftIndex({ name: "x", columnNames: ["a", "b"], isUnique: true }),
    ],
    [
      "@@unique([a, b])",
      draftIndex({ columnNames: ["a", "b"], isUnique: true }),
    ],
    [
      '@@index([b, a], map: "x")',
      draftIndex({ name: "x", columnNames: ["b", "a"] }),
    ],
    ["@@index(fields: [a])", draftIndex({})],
    ['@@index([a], name: "clientName")', draftIndex({})],
  ])("reads %s as an index", (attribute, expected) => {
    const draft = modelDraft([...TWO_COLUMNS, `  ${attribute}`]);

    expect(draft.indexes).toStrictEqual([expected]);
  });

  it("names index columns after @map", () => {
    const draft = modelDraft([
      '  a Int @map("a_col")',
      "  b Int",
      "  @@index([a])",
    ]);

    expect(draft.indexes).toStrictEqual([
      draftIndex({ columnNames: ["a_col"] }),
    ]);
  });

  it("reads @@fulltext as an index with index-type-dropped", () => {
    const draft = modelDraft([...TWO_COLUMNS, "  @@fulltext([a, b])"]);

    expect({
      indexes: draft.indexes,
      diagnostics: draft.diagnostics,
    }).toStrictEqual({
      indexes: [draftIndex({ columnNames: ["a", "b"] })],
      diagnostics: [
        {
          code: "index-type-dropped",
          location: { line: 7, column: 3 },
          target: { kind: "index", index: 0 },
        },
      ],
    });
  });

  it.each([["@@index([])"], ["@@index([1])"], ["@@unique"], ['@@id(["a"])']])(
    "reports reference-not-found for the unreadable field list of %s",
    (attribute) => {
      const draft = modelDraft([...TWO_COLUMNS, `  ${attribute}`]);

      expect(draft.diagnostics).toStrictEqual([
        {
          code: "reference-not-found",
          location: { line: 7, column: 3 },
          target: null,
        },
      ]);
    },
  );
});

describe("buildPrismaDraft dropped options", () => {
  it.each<[string, readonly string[], DraftDiagnostic]>([
    [
      "@id sort",
      ["  a Int @id(sort: Desc)", "  b Int"],
      {
        code: "index-option-dropped",
        location: { line: 5, column: 9 },
        target: { kind: "table", tableIndex: 0, field: "primaryKeyColumnIds" },
      },
    ],
    [
      "@unique length",
      ["  a String @unique(length: 10)", "  b Int"],
      {
        code: "index-option-dropped",
        location: { line: 5, column: 12 },
        target: {
          kind: "column",
          tableIndex: 0,
          columnIndex: 0,
          field: "isUnique",
        },
      },
    ],
    [
      "@@id item sort",
      [...TWO_COLUMNS, "  @@id([a(sort: Desc), b])"],
      {
        code: "index-option-dropped",
        location: { line: 7, column: 3 },
        target: { kind: "table", tableIndex: 0, field: "primaryKeyColumnIds" },
      },
    ],
    [
      "@@unique clustered",
      [...TWO_COLUMNS, "  @@unique([a], clustered: true)"],
      {
        code: "index-option-dropped",
        location: { line: 7, column: 3 },
        target: { kind: "index", index: 0 },
      },
    ],
    [
      "@@index type",
      [...TWO_COLUMNS, "  @@index([a], type: Hash)"],
      {
        code: "index-option-dropped",
        location: { line: 7, column: 3 },
        target: { kind: "index", index: 0 },
      },
    ],
    [
      "@@index item ops",
      [...TWO_COLUMNS, "  @@index([a(ops: JsonbPathOps)])"],
      {
        code: "index-option-dropped",
        location: { line: 7, column: 3 },
        target: { kind: "index", index: 0 },
      },
    ],
  ])(
    "drops the %s option with index-option-dropped",
    (_, members, expected) => {
      expect(modelDraft(members).diagnostics).toStrictEqual([expected]);
    },
  );

  it("keeps the key, unique column and index whose options are dropped", () => {
    const draft = modelDraft([
      "  a Int @id(sort: Desc)",
      "  b String @unique(length: 10)",
      "  @@index([a(sort: Desc)])",
    ]);

    expect({
      primaryKey: firstTable(draft)?.primaryKeyColumnNames,
      isUnique: firstTable(draft)?.columns[1]?.isUnique,
      indexes: draft.indexes,
    }).toStrictEqual({
      primaryKey: ["a"],
      isUnique: true,
      indexes: [draftIndex({})],
    });
  });

  it("ignores constraint names given by map on keys and unique columns", () => {
    const draft = modelDraft([
      '  a Int @id(map: "pk")',
      '  b Int @unique(map: "b_key")',
    ]);

    expect(draft.diagnostics).toStrictEqual([]);
  });

  it("imports tables and columns marked @@ignore and @ignore", () => {
    const draft = modelDraft(["  id Int @id", "  b Int @ignore", "  @@ignore"]);

    expect({
      columns: firstTable(draft)?.columns.map(({ name }) => name),
      diagnostics: draft.diagnostics,
    }).toStrictEqual({ columns: ["id", "b"], diagnostics: [] });
  });

  it("drops @@schema with namespace-dropped on the table", () => {
    const draft = modelDraft(["  id Int", '  @@schema("sales")']);

    expect(draft.diagnostics).toStrictEqual([
      {
        code: "namespace-dropped",
        location: { line: 6, column: 3 },
        target: { kind: "table", tableIndex: 0 },
      },
    ]);
  });

  it("drops @updatedAt with updated-at-not-supported on the column", () => {
    const draft = modelDraft(["  changedAt DateTime @updatedAt"]);

    expect(draft.diagnostics).toStrictEqual([
      {
        code: "updated-at-not-supported",
        location: { line: 5, column: 22 },
        target: { kind: "column", tableIndex: 0, columnIndex: 0 },
      },
    ]);
  });
});

describe("buildPrismaDraft fields", () => {
  it("reads ? as a nullable column", () => {
    const draft = modelDraft(["  id Int?"]);

    expect(firstTable(draft)?.columns).toStrictEqual([
      draftColumn({ isNullable: true }),
    ]);
  });

  it("maps the type and default of a scalar field", () => {
    const draft = modelDraft(["  id BigInt @default(autoincrement())"]);

    expect(firstTable(draft)?.columns).toStrictEqual([
      draftColumn({ type: { kind: "bigint" }, isAutoIncrement: true }),
    ]);
  });

  it("reports field mapping codes on the column and its field", () => {
    const draft = modelDraft(["  id String @default(cuid())"]);

    expect(draft.diagnostics).toStrictEqual([
      {
        code: "default-not-supported",
        location: { line: 5, column: 13 },
        target: {
          kind: "column",
          tableIndex: 0,
          columnIndex: 0,
          field: "defaultValue",
        },
      },
    ]);
  });

  it("does not turn relation fields into columns", () => {
    const draft = draftOf([
      ...DATASOURCE,
      "model Post {",
      "  id       Int  @id",
      "  authorId Int",
      "  author   User @relation(fields: [authorId], references: [id])",
      "}",
      "model User {",
      "  id    Int    @id",
      "  posts Post[]",
      "}",
    ]);

    expect(
      draft.tables.map(({ columns }) => columns.map(({ name }) => name)),
    ).toStrictEqual([["id", "authorId"], ["id"]]);
  });

  it("drops a composite type field with composite-type-not-supported", () => {
    const draft = draftOf([
      ...DATASOURCE,
      "type Address {",
      "  street String",
      "}",
      "model User {",
      "  id      Int @id",
      "  address Address",
      "}",
    ]);

    expect({
      columns: firstTable(draft)?.columns.map(({ name }) => name),
      diagnostics: draft.diagnostics,
    }).toStrictEqual({
      columns: ["id"],
      diagnostics: [
        {
          code: "composite-type-not-supported",
          location: { line: 4, column: 1 },
          target: null,
        },
        {
          code: "composite-type-not-supported",
          location: { line: 9, column: 3 },
          target: null,
        },
      ],
    });
  });
});

describe("buildPrismaDraft comments", () => {
  it("reads triple-slash comments of a model and a field", () => {
    const draft = draftOf([
      ...DATASOURCE,
      "/// Người dùng",
      "/// line two",
      "model User {",
      "  /// khóa",
      "  id Int",
      "}",
    ]);

    expect({
      comment: firstTable(draft)?.comment,
      columnComment: firstTable(draft)?.columns[0]?.comment,
    }).toStrictEqual({
      comment: "Người dùng\nline two",
      columnComment: "khóa",
    });
  });

  it("drops enum and enum value comments with comment-dropped", () => {
    const draft = draftOf([
      ...DATASOURCE,
      "/// statuses",
      "enum Status {",
      "  /// first",
      "  paid",
      "}",
    ]);

    expect(draft.diagnostics).toStrictEqual([
      {
        code: "comment-dropped",
        location: { line: 5, column: 1 },
        target: { kind: "enum", index: 0 },
      },
      {
        code: "comment-dropped",
        location: { line: 7, column: 3 },
        target: { kind: "enum", index: 0 },
      },
    ]);
  });

  it("drops @@schema on an enum with namespace-dropped", () => {
    const draft = draftOf([
      ...DATASOURCE,
      "enum Status {",
      "  paid",
      '  @@schema("sales")',
      "}",
    ]);

    expect(draft.diagnostics).toStrictEqual([
      {
        code: "namespace-dropped",
        location: { line: 6, column: 3 },
        target: { kind: "enum", index: 0 },
      },
    ]);
  });
});

describe("buildPrismaDraft provider and blocks", () => {
  it.each([
    ["no datasource", ["model User {", "  id String", "}"], null],
    [
      "an unsupported provider",
      [
        "datasource db {",
        '  provider = "sqlite"',
        "}",
        "model User {",
        "  id String",
        "}",
      ],
      { line: 2, column: 3 },
    ],
    [
      "a provider from env()",
      [
        "datasource db {",
        '  provider = env("P")',
        "}",
        "model User {",
        "  id String",
        "}",
      ],
      { line: 2, column: 3 },
    ],
    [
      "a datasource without provider",
      ["datasource db {", "}", "model User {", "  id String", "}"],
      { line: 1, column: 1 },
    ],
  ])(
    "defaults to postgresql with provider-not-supported for %s",
    (_, lines, location) => {
      const draft = draftOf(lines);

      expect({
        type: firstTable(draft)?.columns[0]?.type,
        diagnostics: draft.diagnostics,
      }).toStrictEqual({
        type: { kind: "text" },
        diagnostics: [
          { code: "provider-not-supported", location, target: null },
        ],
      });
    },
  );

  it.each([
    ["mysql", { kind: "varchar", length: 191 }],
    ["sqlserver", { kind: "varchar", length: 1000 }],
  ])("reads types for the %s provider", (provider, type) => {
    const draft = draftOf([
      "datasource db {",
      `  provider = "${provider}"`,
      "}",
      "model User {",
      "  id String",
      "}",
    ]);

    expect(firstTable(draft)?.columns[0]?.type).toStrictEqual(type);
  });

  it("ignores generator blocks", () => {
    const draft = draftOf([
      'generator client {\n  provider = "prisma-client"\n}',
      ...DATASOURCE,
    ]);

    expect(draft).toStrictEqual({
      name: null,
      tables: [],
      indexes: [],
      relations: [],
      enums: [],
      subjectAreas: [],
      notes: [],
      diagnostics: [],
    });
  });

  it("drops view and type blocks with their codes", () => {
    const draft = draftOf([
      ...DATASOURCE,
      "view Totals {",
      "  total Int",
      "}",
      "type Address {",
      "  street String",
      "}",
    ]);

    expect({
      tables: draft.tables,
      diagnostics: draft.diagnostics,
    }).toStrictEqual({
      tables: [],
      diagnostics: [
        {
          code: "view-not-supported",
          location: { line: 4, column: 1 },
          target: null,
        },
        {
          code: "composite-type-not-supported",
          location: { line: 7, column: 1 },
          target: null,
        },
      ],
    });
  });
});

describe("buildPrismaDraft relations", () => {
  it("adds relations with mapped names and their codes on the relation", () => {
    const draft = draftOf([
      ...DATASOURCE,
      "model Post {",
      "  id       Int @id",
      '  authorId Int @map("author_id")',
      "  author   User @relation(fields: [authorId], references: [id], onDelete: Cascade)",
      '  @@map("posts")',
      "}",
      "model User {",
      "  id Int @id",
      '  @@map("users")',
      "}",
    ]);

    expect({
      relations: draft.relations,
      diagnostics: draft.diagnostics,
    }).toStrictEqual({
      relations: [
        {
          fromTableName: "posts",
          toTableName: "users",
          columnPairs: [{ fromColumnName: "author_id", toColumnName: "id" }],
          kind: "oneToMany",
          onDelete: "cascade",
          onUpdate: "cascade",
          location: { line: 7, column: 3 },
        },
      ],
      diagnostics: [
        {
          code: "back-relation-missing",
          location: { line: 7, column: 3 },
          target: { kind: "relation", index: 0 },
        },
      ],
    });
  });

  it("reports a dropped relation without a target", () => {
    const draft = draftOf([
      ...DATASOURCE,
      "model Post {",
      "  id   Int    @id",
      "  tags Tag[]",
      "}",
      "model Tag {",
      "  id    Int    @id",
      "  posts Post[]",
      "}",
    ]);

    expect(draft.diagnostics).toStrictEqual([
      {
        code: "implicit-many-to-many-not-supported",
        location: { line: 6, column: 3 },
        target: null,
      },
    ]);
  });
});

describe("buildPrismaDraft implicit mysql foreign key indexes", () => {
  function childDraft(
    provider: string,
    members: readonly string[],
  ): ImportDraft {
    return draftOf([
      "datasource db {",
      `  provider = "${provider}"`,
      "}",
      "model p {",
      "  id    Int @id",
      "  code  Int",
      "  child c[]",
      "  @@unique([id, code])",
      "}",
      "model c {",
      "  id     Int @id",
      "  p_id   Int",
      "  p_code Int",
      "  title  String",
      ...members,
      "}",
    ]);
  }

  // The indexes of the child table; @@unique of p is the first index.
  function indexNames(draft: ImportDraft): readonly (string | null)[] {
    return draft.indexes
      .filter(({ tableName }) => tableName !== "p")
      .map(({ name }) => name);
  }

  const RELATION = "  p p @relation(fields: [p_id], references: [id])";

  it.each([
    {
      case: "the default foreign key name",
      members: [RELATION, '  @@index([p_id], map: "c_p_id_fkey")'],
    },
    {
      case: "the map of @relation",
      members: [
        '  p p @relation(fields: [p_id], references: [id], map: "c_parent_fk")',
        '  @@index([p_id], map: "c_parent_fk")',
      ],
    },
    {
      case: "two columns",
      members: [
        "  p p @relation(fields: [p_id, p_code], references: [id, code])",
        '  @@index([p_id, p_code], map: "c_p_id_p_code_fkey")',
      ],
    },
  ])(
    "drops the index mysql creates for a foreign key: $case",
    ({ members }) => {
      const draft = childDraft("mysql", members);

      expect({
        names: indexNames(draft),
        relations: draft.relations.length,
        diagnostics: draft.diagnostics,
      }).toStrictEqual({ names: [], relations: 1, diagnostics: [] });
    },
  );

  it("names the default foreign key after @@map and @map", () => {
    const draft = childDraft("mysql", [
      '  parentId Int @map("parent_id")',
      "  p p @relation(fields: [parentId], references: [id])",
      '  @@index([parentId], map: "children_parent_id_fkey")',
      '  @@map("children")',
    ]);

    expect(indexNames(draft)).toStrictEqual([]);
  });

  it.each([
    {
      case: "no map",
      members: [RELATION, "  @@index([p_id])"],
      names: [null],
    },
    {
      case: "another name",
      members: [RELATION, '  @@index([p_id], map: "c_p_id_idx")'],
      names: ["c_p_id_idx"],
    },
    {
      case: "the default name when @relation has a map",
      members: [
        '  p p @relation(fields: [p_id], references: [id], map: "c_parent_fk")',
        '  @@index([p_id], map: "c_p_id_fkey")',
      ],
      names: ["c_p_id_fkey"],
    },
    {
      case: "another index starting with the columns",
      members: [
        RELATION,
        '  @@index([p_id], map: "c_p_id_fkey")',
        '  @@index([p_id, title], map: "c_p_id_title_idx")',
      ],
      names: ["c_p_id_fkey", "c_p_id_title_idx"],
    },
    {
      case: "a unique key starting with the columns",
      members: [
        RELATION,
        '  @@index([p_id], map: "c_p_id_fkey")',
        "  @@unique([p_id, p_code])",
      ],
      names: ["c_p_id_fkey", null],
    },
    {
      case: "a unique index of the same kind",
      members: [RELATION, '  @@unique([p_id], map: "c_p_id_fkey")'],
      names: ["c_p_id_fkey"],
    },
    {
      case: "a sort option on its field",
      members: [RELATION, '  @@index([p_id(sort: Desc)], map: "c_p_id_fkey")'],
      names: ["c_p_id_fkey"],
    },
    {
      case: "an index type",
      members: [RELATION, '  @@index([p_id], map: "c_p_id_fkey", type: Hash)'],
      names: ["c_p_id_fkey"],
    },
  ])("keeps an index with $case", ({ members, names }) => {
    expect(indexNames(childDraft("mysql", members))).toStrictEqual(names);
  });

  it("reads no foreign key from a back relation field without fields", () => {
    const draft = draftOf([
      "datasource db {",
      '  provider = "mysql"',
      "}",
      "model c {",
      "  id       Int  @id",
      "  p_id     Int",
      '  children c[]  @relation("tree", map: "c_p_id_fkey")',
      '  parent   c    @relation("tree", fields: [p_id], references: [id])',
      '  @@index([p_id], map: "c_p_id_fkey")',
      "}",
    ]);

    expect(indexNames(draft)).toStrictEqual([]);
  });

  it("keeps the index when the primary key starts with the columns", () => {
    const draft = draftOf([
      "datasource db {",
      '  provider = "mysql"',
      "}",
      "model p {",
      "  id    Int @id",
      "  child c[]",
      "}",
      "model c {",
      "  p_id Int",
      "  n    Int",
      "  p    p @relation(fields: [p_id], references: [id])",
      "  @@id([p_id, n])",
      '  @@index([p_id], map: "c_p_id_fkey")',
      "}",
    ]);

    expect(indexNames(draft)).toStrictEqual(["c_p_id_fkey"]);
  });

  it("keeps an index named like a foreign key in postgresql", () => {
    const draft = childDraft("postgresql", [
      RELATION,
      '  @@index([p_id], map: "c_p_id_fkey")',
    ]);

    expect(indexNames(draft)).toStrictEqual(["c_p_id_fkey"]);
  });

  it("targets the indexes kept after a dropped one", () => {
    const draft = childDraft("mysql", [
      RELATION,
      '  @@index([p_id], map: "c_p_id_fkey")',
      "  @@fulltext([title])",
    ]);

    expect({
      names: indexNames(draft),
      diagnostics: draft.diagnostics,
    }).toStrictEqual({
      names: [null],
      diagnostics: [
        {
          code: "index-type-dropped",
          location: { line: 17, column: 3 },
          target: { kind: "index", index: 1 },
        },
      ],
    });
  });
});
