import { describe, expect, it } from "vitest";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type { ReferentialAction } from "../../model/relation.js";
import { unwrapOk } from "../../testing/unwrap-result.js";
import type { DraftRelation } from "../shared/import-draft.js";
import { parsePrismaSchema } from "./prisma-parser.js";
import {
  buildPrismaRelations,
  type PrismaRelationsResult,
} from "./prisma-relations.js";

type Names = {
  readonly tableNameByModel: ReadonlyMap<string, string>;
  readonly columnNameByField: ReadonlyMap<string, ReadonlyMap<string, string>>;
};

const SAME_NAMES: Names = {
  tableNameByModel: new Map(),
  columnNameByField: new Map(),
};

function relationsOf(
  lines: readonly string[],
  provider: SqlDialect = "postgresql",
  names: Names = SAME_NAMES,
): PrismaRelationsResult {
  const schema = unwrapOk(parsePrismaSchema(lines.join("\n")));
  return buildPrismaRelations(schema.blocks, { provider, ...names });
}

function draftRelation(overrides: Partial<DraftRelation>): DraftRelation {
  return {
    fromTableName: "Post",
    toTableName: "User",
    columnPairs: [{ fromColumnName: "authorId", toColumnName: "id" }],
    kind: "oneToMany",
    onDelete: "restrict",
    onUpdate: "cascade",
    location: { line: 4, column: 3 },
    ...overrides,
  };
}

// The relation field `author` sits on line 4.
function postAndUser(
  authorAttributes: string,
  authorIdType = "Int",
): readonly string[] {
  return [
    "model Post {",
    "  id       Int @id",
    `  authorId ${authorIdType}`,
    `  author   User${authorIdType.endsWith("?") ? "?" : ""} @relation(${authorAttributes})`,
    "}",
    "model User {",
    "  id    Int    @id",
    "  posts Post[]",
    "}",
  ];
}

const AUTHOR_RELATION = "fields: [authorId], references: [id]";

describe("buildPrismaRelations", () => {
  it("pairs fields with references in order", () => {
    const result = relationsOf([
      "datasource db {",
      '  provider = "postgresql"',
      "}",
      "model Membership {",
      "  userId Int",
      "  orgId  Int",
      "  user   User @relation(fields: [userId, orgId], references: [id, orgId])",
      "}",
      "model User {",
      "  id          Int",
      "  orgId       Int",
      "  memberships Membership[]",
      "  @@id([id, orgId])",
      "}",
    ]);

    expect(result).toStrictEqual({
      relations: [
        {
          relation: draftRelation({
            fromTableName: "Membership",
            columnPairs: [
              { fromColumnName: "userId", toColumnName: "id" },
              { fromColumnName: "orgId", toColumnName: "orgId" },
            ],
            location: { line: 7, column: 3 },
          }),
          codes: [],
        },
      ],
      dropped: [],
    });
  });

  it("infers oneToOne from an optional back relation and oneToMany from a list", () => {
    const result = relationsOf([
      "model Profile {",
      "  id     Int  @id",
      "  userId Int",
      "  user   User @relation(fields: [userId], references: [id])",
      "}",
      "model Post {",
      "  id       Int  @id",
      "  authorId Int",
      '  author   User @relation("written", fields: [authorId], references: [id])',
      '  editor   User @relation(name: "edited", fields: [authorId], references: [id])',
      "}",
      "model User {",
      "  id      Int      @id",
      "  profile Profile?",
      '  written Post[]   @relation("written")',
      '  edited  Post?    @relation("edited")',
      "}",
    ]);

    expect(
      result.relations.map(({ relation }) => [
        relation.fromTableName,
        relation.kind,
      ]),
    ).toStrictEqual([
      ["Profile", "oneToOne"],
      ["Post", "oneToMany"],
      ["Post", "oneToOne"],
    ]);
  });

  it("finds the back relation of a self relation in the same model", () => {
    const result = relationsOf([
      "model Node {",
      "  id       Int    @id",
      "  parentId Int?",
      '  parent   Node?  @relation("tree", fields: [parentId], references: [id])',
      '  children Node[] @relation("tree")',
      "}",
    ]);

    expect(result.relations).toStrictEqual([
      {
        relation: draftRelation({
          fromTableName: "Node",
          toTableName: "Node",
          columnPairs: [{ fromColumnName: "parentId", toColumnName: "id" }],
          onDelete: "setNull",
        }),
        codes: [],
      },
    ]);
  });

  it("reports back-relation-missing and infers the kind from uniqueness", () => {
    const result = relationsOf([
      "model Plain {",
      "  userId Int",
      "  user   User @relation(fields: [userId], references: [id])",
      "}",
      "model SingleUnique {",
      "  userId Int  @unique",
      "  user   User @relation(fields: [userId], references: [id])",
      "}",
      "model SingleKey {",
      "  userId Int  @id",
      "  user   User @relation(fields: [userId], references: [id])",
      "}",
      "model CompositeKey {",
      "  userId Int",
      "  orgId  Int",
      "  user   User @relation(fields: [orgId, userId], references: [orgId, id])",
      "  @@id(fields: [userId, orgId])",
      "}",
      "model CompositeUnique {",
      "  userId Int",
      "  orgId  Int",
      "  user   User @relation(fields: [userId, orgId], references: [id, orgId])",
      "  @@unique([orgId(sort: Desc), userId])",
      "}",
      "model PartOfKey {",
      "  userId Int",
      "  orgId  Int",
      "  user   User @relation(fields: [userId], references: [id])",
      "  @@id([userId, orgId])",
      "}",
      "model User {",
      "  id    Int @id",
      "  orgId Int",
      "}",
    ]);

    expect(
      result.relations.map(({ relation, codes }) => [
        relation.fromTableName,
        relation.kind,
        codes,
      ]),
    ).toStrictEqual([
      ["Plain", "oneToMany", ["back-relation-missing"]],
      ["SingleUnique", "oneToOne", ["back-relation-missing"]],
      ["SingleKey", "oneToOne", ["back-relation-missing"]],
      ["CompositeKey", "oneToOne", ["back-relation-missing"]],
      ["CompositeUnique", "oneToOne", ["back-relation-missing"]],
      ["PartOfKey", "oneToMany", ["back-relation-missing"]],
    ]);
  });

  it.each<readonly [string, ReferentialAction]>([
    ["Cascade", "cascade"],
    ["Restrict", "restrict"],
    ["NoAction", "noAction"],
    ["SetNull", "setNull"],
    ["SetDefault", "setDefault"],
  ])("reads explicit referential actions: %s", (prismaAction, action) => {
    const result = relationsOf(
      postAndUser(
        `${AUTHOR_RELATION}, onDelete: ${prismaAction}, onUpdate: ${prismaAction}`,
      ),
    );

    expect(result.relations).toStrictEqual([
      {
        relation: draftRelation({ onDelete: action, onUpdate: action }),
        codes: [],
      },
    ]);
  });

  it.each<readonly [SqlDialect, string, ReferentialAction, ReferentialAction]>([
    ["postgresql", "Int", "restrict", "cascade"],
    ["postgresql", "Int?", "setNull", "cascade"],
    ["mysql", "Int", "restrict", "cascade"],
    ["mysql", "Int?", "setNull", "cascade"],
    ["sqlserver", "Int", "noAction", "noAction"],
    ["sqlserver", "Int?", "setNull", "noAction"],
  ])(
    "applies prisma default actions per provider: %s %s",
    (provider, authorIdType, onDelete, onUpdate) => {
      const result = relationsOf(
        postAndUser(AUTHOR_RELATION, authorIdType),
        provider,
      );

      expect(result.relations).toStrictEqual([
        { relation: draftRelation({ onDelete, onUpdate }), codes: [] },
      ]);
    },
  );

  it("drops an implicit many-to-many relation", () => {
    const result = relationsOf([
      "model Post {",
      "  id   Int   @id",
      "  tags Tag[]",
      "}",
      "model Tag {",
      "  id    Int    @id",
      "  posts Post[]",
      "}",
    ]);

    expect(result).toStrictEqual({
      relations: [],
      dropped: [
        {
          code: "implicit-many-to-many-not-supported",
          position: { line: 3, column: 3 },
        },
      ],
    });
  });

  it.each([
    ["fields: [authorId]"],
    ["fields: [authorId], references: [id, other]"],
    ["fields: [], references: []"],
    ['fields: ["authorId"], references: [id]'],
  ])(
    "drops a relation whose fields and references do not pair up: %s",
    (attributes) => {
      expect(relationsOf(postAndUser(attributes))).toStrictEqual({
        relations: [],
        dropped: [
          { code: "reference-not-found", position: { line: 4, column: 17 } },
        ],
      });
    },
  );

  it("uses mapped column names", () => {
    const result = relationsOf(postAndUser(AUTHOR_RELATION), "postgresql", {
      tableNameByModel: new Map([
        ["Post", "posts"],
        ["User", "users"],
      ]),
      columnNameByField: new Map([
        ["Post", new Map([["authorId", "author_id"]])],
        ["User", new Map([["id", "user_id"]])],
      ]),
    });

    expect(result.relations).toStrictEqual([
      {
        relation: draftRelation({
          fromTableName: "posts",
          toTableName: "users",
          columnPairs: [
            { fromColumnName: "author_id", toColumnName: "user_id" },
          ],
        }),
        codes: [],
      },
    ]);
  });
});
