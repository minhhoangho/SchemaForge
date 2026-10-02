import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { TableId } from "../../model/ids.js";
import type { RelationKind } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import type { SqlDialect } from "../shared/generator-types.js";
import { generatePrisma } from "./generate-prisma.js";

function generate(
  schema: SchemaDocument,
  provider: SqlDialect = "postgresql",
): string {
  return generatePrisma(schema, { provider }).file.content;
}

function keyedTable(
  overrides: Partial<Omit<Table, "columnIds">> & Pick<Table, "id">,
): Table {
  return makeTable({
    primaryKeyColumnIds: [`col_${overrides.id}_id`],
    ...overrides,
  });
}

function idColumn(tableId: TableId): Column {
  return makeColumn({ id: `col_${tableId}_id`, tableId, name: "id" });
}

// users(id) <- posts(id, author_id), the classic one-to-many pair.
function usersAndPosts(
  authorOverrides: Partial<Column> = {},
  kind: RelationKind = "oneToMany",
): SchemaDocument {
  return buildSchema({
    tables: [
      keyedTable({ id: "tbl_users", name: "users" }),
      keyedTable({ id: "tbl_posts", name: "posts" }),
    ],
    columns: [
      idColumn("tbl_users"),
      idColumn("tbl_posts"),
      makeColumn({
        id: "col_author_id",
        tableId: "tbl_posts",
        name: "author_id",
        ...authorOverrides,
      }),
    ],
    relations: [
      makeRelation({
        id: "rel_author",
        kind,
        fromTableId: "tbl_posts",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_author_id", toColumnId: "col_tbl_users_id" },
        ],
      }),
    ],
  });
}

function singleTable(
  columns: readonly Omit<Column, "tableId">[],
  tableOverrides: Partial<Omit<Table, "columnIds" | "id">> = {},
  parts: Pick<Parameters<typeof buildSchema>[0], "indexes"> = {},
): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_t", name: "t", ...tableOverrides })],
    columns: columns.map((column) => ({ ...column, tableId: "tbl_t" })),
    ...parts,
  });
}

function tColumn(overrides: Partial<Column> & Pick<Column, "id">): Column {
  return makeColumn({ tableId: "tbl_t", ...overrides });
}

describe("Prisma models", () => {
  it("writes column fields in column order with id, unique, default, map and native type", () => {
    const schema = singleTable(
      [
        tColumn({
          id: "col_id",
          type: { kind: "smallint" },
          isAutoIncrement: true,
        }),
        tColumn({
          id: "col_email",
          name: "e-mail",
          type: { kind: "varchar", length: 80 },
          isUnique: true,
          defaultValue: { kind: "literal", value: "a@b" },
        }),
        tColumn({ id: "col_nick", type: { kind: "text" }, isNullable: true }),
      ],
      { primaryKeyColumnIds: ["col_id"] },
    );

    expect(generate(schema)).toContain(
      [
        "model T {",
        "  id Int @id @default(autoincrement()) @db.SmallInt",
        '  eMail String @unique @default("a@b") @map("e-mail") @db.VarChar(80)',
        "  nick String?",
        "",
        '  @@map("t")',
        "}",
      ].join("\n"),
    );
  });

  it("writes a composite primary key as @@id in key order", () => {
    const schema = singleTable(
      [tColumn({ id: "col_a" }), tColumn({ id: "col_b" })],
      {
        primaryKeyColumnIds: ["col_b", "col_a"],
      },
    );

    expect(generate(schema)).toContain("\n\n  @@id([b, a])\n");
  });

  it("writes unique and plain user indexes with map names", () => {
    const schema = singleTable(
      [tColumn({ id: "col_a" }), tColumn({ id: "col_b" })],
      {},
      {
        indexes: [
          makeIndex({
            id: "idx_ab",
            tableId: "tbl_t",
            name: "t ab",
            columnIds: ["col_a", "col_b"],
            isUnique: true,
          }),
          makeIndex({
            id: "idx_b",
            tableId: "tbl_t",
            name: 'b"idx',
            columnIds: ["col_b"],
          }),
        ],
      },
    );

    expect(generate(schema)).toContain(
      '  @@unique([a, b], map: "t ab")\n  @@index([b], map: "b\\"idx")\n',
    );
  });

  it("writes forward relation fields before inverse relation fields", () => {
    const schema = buildSchema({
      tables: [
        keyedTable({ id: "tbl_users", name: "users" }),
        keyedTable({ id: "tbl_posts", name: "posts" }),
        keyedTable({ id: "tbl_comments", name: "comments" }),
      ],
      columns: [
        idColumn("tbl_users"),
        idColumn("tbl_posts"),
        makeColumn({
          id: "col_author_id",
          tableId: "tbl_posts",
          name: "author_id",
        }),
        idColumn("tbl_comments"),
        makeColumn({
          id: "col_post_id",
          tableId: "tbl_comments",
          name: "post_id",
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_comment_post",
          fromTableId: "tbl_comments",
          toTableId: "tbl_posts",
          columnPairs: [
            { fromColumnId: "col_post_id", toColumnId: "col_tbl_posts_id" },
          ],
        }),
        makeRelation({
          id: "rel_post_author",
          fromTableId: "tbl_posts",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_author_id", toColumnId: "col_tbl_users_id" },
          ],
        }),
      ],
    });

    expect(generate(schema)).toContain(
      [
        '  authorId Int @map("author_id")',
        "  author Users @relation(fields: [authorId], references: [id], onDelete: NoAction, onUpdate: NoAction)",
        "  comments Comments[]",
      ].join("\n"),
    );
  });

  it("always writes both referential actions", () => {
    expect(generate(usersAndPosts())).toContain(
      "onDelete: NoAction, onUpdate: NoAction)",
    );
  });

  it("orders relation fields and references by the referenced key", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_parent",
          name: "parent",
          primaryKeyColumnIds: ["col_b", "col_a"],
        }),
        makeTable({
          id: "tbl_child",
          name: "child",
          primaryKeyColumnIds: ["col_fa", "col_fb"],
        }),
      ],
      columns: [
        makeColumn({ id: "col_a", tableId: "tbl_parent" }),
        makeColumn({ id: "col_b", tableId: "tbl_parent" }),
        makeColumn({ id: "col_fa", tableId: "tbl_child" }),
        makeColumn({ id: "col_fb", tableId: "tbl_child" }),
      ],
      relations: [
        makeRelation({
          id: "rel_child",
          fromTableId: "tbl_child",
          toTableId: "tbl_parent",
          columnPairs: [
            { fromColumnId: "col_fa", toColumnId: "col_a" },
            { fromColumnId: "col_fb", toColumnId: "col_b" },
          ],
        }),
      ],
    });

    expect(generate(schema)).toContain(
      "  parent Parent @relation(fields: [fb, fa], references: [b, a],",
    );
  });

  it("makes the forward field optional when a foreign key column is nullable", () => {
    expect(generate(usersAndPosts({ isNullable: true }))).toContain(
      "  author Users? @relation(",
    );
  });

  it.each<[RelationKind, string]>([
    ["oneToMany", "  posts Posts[]\n"],
    ["oneToOne", "  posts Posts?\n"],
  ])(
    "writes Model[] for one-to-many and Model? for one-to-one inverse fields (%s)",
    (kind, line) => {
      expect(generate(usersAndPosts({}, kind))).toContain(line);
    },
  );

  it("adds a relation name to both fields of a self-reference", () => {
    const schema = buildSchema({
      tables: [keyedTable({ id: "tbl_staff", name: "staff" })],
      columns: [
        idColumn("tbl_staff"),
        makeColumn({
          id: "col_manager_id",
          tableId: "tbl_staff",
          name: "manager_id",
          isNullable: true,
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_manager",
          fromTableId: "tbl_staff",
          toTableId: "tbl_staff",
          columnPairs: [
            { fromColumnId: "col_manager_id", toColumnId: "col_tbl_staff_id" },
          ],
        }),
      ],
    });

    expect(generate(schema)).toContain(
      [
        '  manager Staff? @relation("Staff_manager", fields: [managerId], references: [id], onDelete: NoAction, onUpdate: NoAction)',
        '  staff Staff[] @relation("Staff_manager")',
      ].join("\n"),
    );
  });

  it("adds a relation name for two relations between the same models", () => {
    const schema = buildSchema({
      tables: [
        keyedTable({ id: "tbl_users", name: "users" }),
        keyedTable({ id: "tbl_posts", name: "posts" }),
      ],
      columns: [
        idColumn("tbl_users"),
        idColumn("tbl_posts"),
        makeColumn({
          id: "col_author_id",
          tableId: "tbl_posts",
          name: "author_id",
        }),
        makeColumn({
          id: "col_editor_id",
          tableId: "tbl_posts",
          name: "editor_id",
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_author",
          fromTableId: "tbl_posts",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_author_id", toColumnId: "col_tbl_users_id" },
          ],
        }),
        makeRelation({
          id: "rel_editor",
          fromTableId: "tbl_posts",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_editor_id", toColumnId: "col_tbl_users_id" },
          ],
        }),
      ],
    });

    expect(generate(schema)).toContain(
      '  posts Posts[] @relation("Posts_author")\n  posts2 Posts[] @relation("Posts_editor")\n',
    );
  });

  it("writes block attributes in the order id, unique, index, map, ignore", () => {
    const schema = singleTable(
      [
        tColumn({ id: "col_a", isNullable: true }),
        tColumn({ id: "col_b" }),
        tColumn({ id: "col_c", isNullable: true }),
      ],
      { name: "order items", primaryKeyColumnIds: ["col_a", "col_b"] },
      {
        indexes: [
          makeIndex({
            id: "idx_c",
            tableId: "tbl_t",
            name: "uq",
            columnIds: ["col_c"],
            isUnique: true,
          }),
          makeIndex({
            id: "idx_b",
            tableId: "tbl_t",
            name: "ix",
            columnIds: ["col_b"],
          }),
        ],
      },
    );

    expect(generate(schema)).toContain(
      [
        "",
        "  @@id([a, b])",
        '  @@unique([c], map: "uq")',
        '  @@index([b], map: "ix")',
        '  @@map("order items")',
        "  @@ignore",
        "}",
      ].join("\n"),
    );
  });

  it("ignores a model without a required unique key and reports table-without-identifier", () => {
    const result = generatePrisma(singleTable([tColumn({ id: "col_a" })]), {
      provider: "postgresql",
    });

    expect({
      hasIgnore: result.file.content.includes("  @@ignore\n}"),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      hasIgnore: true,
      diagnostics: [
        { code: "table-without-identifier", path: ["tables", "tbl_t"] },
      ],
    });
  });

  it.each<[string, Partial<Column>]>([
    ["nullable", { isNullable: true }],
    ["Unsupported", { type: { kind: "custom", name: "point" } }],
  ])(
    "does not count a nullable or Unsupported unique as an identifier (%s)",
    (_label, overrides) => {
      const schema = singleTable([
        tColumn({ id: "col_a", isUnique: true, ...overrides }),
      ]);

      expect(generate(schema)).toContain("  @@ignore\n}");
    },
  );

  it("counts a required unique column as an identifier", () => {
    const schema = singleTable([tColumn({ id: "col_a", isUnique: true })]);

    expect(generate(schema)).not.toContain("@@ignore");
  });

  it("counts a required unique index as an identifier", () => {
    const schema = singleTable(
      [tColumn({ id: "col_a" })],
      {},
      {
        indexes: [
          makeIndex({
            id: "idx_a",
            tableId: "tbl_t",
            columnIds: ["col_a"],
            isUnique: true,
          }),
        ],
      },
    );

    expect(generate(schema)).not.toContain("@@ignore");
  });

  it("ignores a model whose only key was dropped", () => {
    const schema = singleTable(
      [tColumn({ id: "col_a", type: { kind: "json" } })],
      {
        primaryKeyColumnIds: ["col_a"],
      },
    );
    const result = generatePrisma(schema, { provider: "mysql" });

    expect({
      hasIgnore: result.file.content.includes(
        '  a Json\n\n  @@map("t")\n  @@ignore\n}',
      ),
      diagnostics: result.diagnostics,
    }).toStrictEqual({
      hasIgnore: true,
      diagnostics: [
        { code: "table-without-identifier", path: ["tables", "tbl_t"] },
        {
          code: "key-column-type-not-indexable",
          path: ["tables", "tbl_t", "primaryKeyColumnIds"],
        },
      ],
    });
  });

  it("ignores a model without columns", () => {
    expect(generate(singleTable([]))).toContain(
      'model T {\n  @@map("t")\n  @@ignore\n}',
    );
  });

  // logs(user_id) -> users(id): logs has no key, users does.
  const IGNORED_LOGS = buildSchema({
    tables: [
      keyedTable({ id: "tbl_users", name: "users" }),
      makeTable({ id: "tbl_logs", name: "logs" }),
    ],
    columns: [
      idColumn("tbl_users"),
      makeColumn({ id: "col_user_id", tableId: "tbl_logs", name: "user_id" }),
    ],
    relations: [
      makeRelation({
        id: "rel_log_user",
        fromTableId: "tbl_logs",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_user_id", toColumnId: "col_tbl_users_id" },
        ],
      }),
    ],
  });

  it("adds @ignore to a relation field that points to an ignored model", () => {
    expect(generate(IGNORED_LOGS)).toContain("  logs Logs[] @ignore\n");
  });

  it("does not add @ignore inside an ignored model", () => {
    expect(generate(IGNORED_LOGS)).toContain(
      "  user Users @relation(fields: [userId], references: [id], onDelete: NoAction, onUpdate: NoAction)\n",
    );
  });

  it("writes table and column comments as triple-slash lines", () => {
    const schema = singleTable(
      [tColumn({ id: "col_a", comment: "note */ here" })],
      { comment: "Line 1\r\n\rLine 3", primaryKeyColumnIds: ["col_a"] },
    );

    expect(generate(schema)).toContain(
      "/// Line 1\n///\n/// Line 3\nmodel T {\n  /// note */ here\n  a Int @id\n",
    );
  });

  it("maps an enum value that is not an identifier with @map", () => {
    const schema = buildSchema({
      enums: [
        makeEnum({
          id: "enum_status",
          name: "order status",
          values: ["pending", "đã giao"],
        }),
      ],
    });

    expect(generate(schema)).toContain(
      'enum OrderStatus {\n  pending\n  daGiao @map("đã giao")\n\n  @@map("order status")\n}',
    );
  });

  it("writes an enum named like its Prisma name without @@map", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", name: "Status", values: ["on"] })],
    });

    expect(generate(schema, "mysql")).toContain("enum Status {\n  on\n}");
  });
});
