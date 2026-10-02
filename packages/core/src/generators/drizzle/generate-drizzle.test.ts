import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import { createEmptySchema } from "../../model/create-empty-schema.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import type { SchemaParts } from "../../testing/factories.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import { formatDiagnosticsSnapshot } from "../../testing/generator-snapshot.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import type { GeneratorDiagnostic } from "../shared/generator-types.js";
import { buildSqlDdlModel } from "../shared/sql-ddl-model.js";
import type { DrizzleDialect } from "./drizzle-names.js";
import { generateDrizzle } from "./generate-drizzle.js";

const DIALECTS: readonly DrizzleDialect[] = ["postgresql", "mysql"];

const CALLBACK_HEADERS: Readonly<Record<DrizzleDialect, string>> = {
  postgresql: "(table): PgTableExtraConfigValue[] => [",
  mysql: "(table): MySqlTableExtraConfigValue[] => [",
};

function generate(
  schema: SchemaDocument,
  dialect: DrizzleDialect = "postgresql",
): string {
  return generateDrizzle(schema, { dialect }).file.content;
}

function diagnosticsOf(
  schema: SchemaDocument,
  dialect: DrizzleDialect,
): readonly GeneratorDiagnostic[] {
  return generateDrizzle(schema, { dialect }).diagnostics;
}

function withCode(
  diagnostics: readonly GeneratorDiagnostic[],
  code: GeneratorDiagnostic["code"],
): readonly GeneratorDiagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.code === code);
}

function linesFrom(content: string, suffix: string): readonly string[] {
  return content.split("\n").filter((line) => line.endsWith(suffix));
}

function countOf(content: string, text: string): number {
  return content.split(text).length - 1;
}

// A table keyed by `id`, with its columns listed by id.
function keyedTable(
  id: Table["id"],
  overrides: Partial<Omit<Table, "columnIds">> = {},
): Table {
  return makeTable({ id, primaryKeyColumnIds: [`col_${id}_id`], ...overrides });
}

function idColumn(tableId: Table["id"]): Column {
  return makeColumn({ id: `col_${tableId}_id`, tableId, name: "id" });
}

function foreignKey(
  id: Relation["id"],
  from: [Table["id"], Column["id"]],
  to: [Table["id"], Column["id"]],
  overrides: Partial<Relation> = {},
): Relation {
  return makeRelation({
    id,
    fromTableId: from[0],
    toTableId: to[0],
    columnPairs: [{ fromColumnId: from[1], toColumnId: to[1] }],
    ...overrides,
  });
}

function reverseMapKeys(schema: SchemaDocument): SchemaDocument {
  const reverse = <Value>(
    map: Readonly<Record<string, Value>>,
  ): Readonly<Record<string, Value>> =>
    Object.fromEntries(Object.entries(map).toReversed());
  return {
    ...schema,
    tables: reverse(schema.tables),
    columns: reverse(schema.columns),
    relations: reverse(schema.relations),
    indexes: reverse(schema.indexes),
    enums: reverse(schema.enums),
  };
}

function authorRelation(overrides: Partial<Relation> = {}): Relation {
  return foreignKey(
    "rel_author",
    ["tbl_posts", "col_author_id"],
    ["tbl_users", "col_tbl_users_id"],
    { onDelete: "cascade", ...overrides },
  );
}

// users(id) and posts(id, author_id → users.id, slug unique, created_at);
// `parts.columns` are added, `parts.relations` replace the author relation.
function postsSchema(parts: SchemaParts = {}): SchemaDocument {
  return buildSchema({
    ...parts,
    tables: [keyedTable("tbl_users"), keyedTable("tbl_posts")],
    columns: [
      idColumn("tbl_users"),
      idColumn("tbl_posts"),
      makeColumn({
        id: "col_author_id",
        tableId: "tbl_posts",
        name: "author_id",
      }),
      makeColumn({
        id: "col_slug",
        tableId: "tbl_posts",
        name: "slug",
        type: { kind: "varchar", length: 40 },
        isUnique: true,
      }),
      makeColumn({
        id: "col_created_at",
        tableId: "tbl_posts",
        name: "created_at",
        type: { kind: "timestamptz" },
      }),
      ...(parts.columns ?? []),
    ],
    relations: parts.relations ?? [authorRelation()],
  });
}

// a ↔ b reference each other, c references itself, d references a.
function cycleSchema(): SchemaDocument {
  const tableIds = ["tbl_a", "tbl_b", "tbl_c", "tbl_d"] as const;
  return buildSchema({
    tables: tableIds.map((id) => keyedTable(id)),
    columns: [
      ...tableIds.map((id) => idColumn(id)),
      makeColumn({ id: "col_a_b", tableId: "tbl_a", name: "b_id" }),
      makeColumn({ id: "col_b_a", tableId: "tbl_b", name: "a_id" }),
      makeColumn({ id: "col_c_c", tableId: "tbl_c", name: "parent_id" }),
      makeColumn({ id: "col_d_a", tableId: "tbl_d", name: "a_id" }),
    ],
    relations: [
      foreignKey("rel_a_b", ["tbl_a", "col_a_b"], ["tbl_b", "col_tbl_b_id"]),
      foreignKey("rel_b_a", ["tbl_b", "col_b_a"], ["tbl_a", "col_tbl_a_id"]),
      foreignKey("rel_c_c", ["tbl_c", "col_c_c"], ["tbl_c", "col_tbl_c_id"]),
      foreignKey("rel_d_a", ["tbl_d", "col_d_a"], ["tbl_a", "col_tbl_a_id"]),
    ],
  });
}

// `users` has no constraint at all, so its table has no callback.
const PLAIN_USERS = buildSchema({
  tables: [makeTable({ id: "tbl_users" })],
  columns: [makeColumn({ id: "col_name", tableId: "tbl_users", name: "name" })],
});

const KEYED_USERS = buildSchema({
  tables: [keyedTable("tbl_users")],
  columns: [
    idColumn("tbl_users"),
    makeColumn({
      id: "col_name",
      tableId: "tbl_users",
      name: "name",
      type: { kind: "varchar", length: 20 },
      isNullable: true,
    }),
  ],
});

describe("generateDrizzle", () => {
  it("names the file schema.ts with language typescript", () => {
    const { file } = generateDrizzle(KEYED_USERS, { dialect: "postgresql" });

    expect([file.fileName, file.language]).toStrictEqual([
      "schema.ts",
      "typescript",
    ]);
  });

  it("throws RangeError for sqlserver", () => {
    expect(() =>
      // @ts-expect-error -- sqlserver is not a Drizzle dialect; the runtime guard is under test.
      generateDrizzle(KEYED_USERS, { dialect: "sqlserver" }),
    ).toThrow(RangeError);
  });

  it.each<[DrizzleDialect, SchemaDocument, string]>([
    [
      "postgresql",
      KEYED_USERS,
      'import { type PgTableExtraConfigValue, integer, pgTable, primaryKey, varchar } from "drizzle-orm/pg-core";',
    ],
    [
      "mysql",
      KEYED_USERS,
      'import { type MySqlTableExtraConfigValue, int, mysqlTable, primaryKey, varchar } from "drizzle-orm/mysql-core";',
    ],
    [
      "postgresql",
      PLAIN_USERS,
      'import { integer, pgTable } from "drizzle-orm/pg-core";',
    ],
    [
      "mysql",
      PLAIN_USERS,
      'import { int, mysqlTable } from "drizzle-orm/mysql-core";',
    ],
  ])(
    "imports only used builders sorted by name (%s)",
    (dialect, schema, expected) => {
      expect(generate(schema, dialect).split("\n")[0]).toBe(expected);
    },
  );

  it.each(DIALECTS)(
    "annotates every table config callback with the dialect extra config type (%s)",
    (dialect) => {
      const content = generate(cycleSchema(), dialect);

      expect({
        annotated: countOf(content, CALLBACK_HEADERS[dialect]),
        plain: countOf(content, "(table) => ["),
      }).toStrictEqual({ annotated: 4, plain: 0 });
    },
  );

  it.each<[string, SchemaDocument, readonly string[]]>([
    [
      "relations and sql",
      postsSchema({
        columns: [
          makeColumn({
            id: "col_score",
            tableId: "tbl_users",
            type: { kind: "real" },
            defaultValue: { kind: "literal", value: "1.5" },
          }),
        ],
      }),
      ['import { relations, sql } from "drizzle-orm";'],
    ],
    [
      "relations only",
      postsSchema(),
      ['import { relations } from "drizzle-orm";'],
    ],
    [
      "sql only",
      buildSchema({
        tables: [makeTable({ id: "tbl_t" })],
        columns: [
          makeColumn({
            id: "col_day",
            tableId: "tbl_t",
            type: { kind: "date" },
            defaultValue: { kind: "literal", value: "2024-01-02" },
          }),
        ],
      }),
      ['import { sql } from "drizzle-orm";'],
    ],
    ["neither", KEYED_USERS, []],
  ])(
    "imports sql and relations from drizzle-orm only when used (%s)",
    (_case, schema, expected) => {
      expect(linesFrom(generate(schema), 'from "drizzle-orm";')).toStrictEqual(
        expected,
      );
    },
  );

  it("declares enums and custom types before tables", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: ["active", 'say "hi"'] })],
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_status",
          tableId: "tbl_users",
          type: { kind: "enum", enumId: "enum_status" },
        }),
        makeColumn({
          id: "col_photo",
          tableId: "tbl_users",
          type: { kind: "binary" },
        }),
        makeColumn({
          id: "col_shape",
          tableId: "tbl_users",
          type: { kind: "custom", name: "geometry" },
        }),
      ],
    });

    expect(generate(schema))
      .toBe(`import { customType, pgEnum, pgTable } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["active", "say \\"hi\\""]);

export const byteaType = customType<{ data: Uint8Array }>({
  dataType() {
    return "bytea";
  },
});

export const geometryType = customType<{ data: unknown }>({
  dataType() {
    return "geometry";
  },
});

export const users = pgTable(
  "users",
  {
    status: statusEnum("status").notNull(),
    photo: byteaType("photo").notNull(),
    shape: geometryType("shape").notNull(),
  },
);
`);
  });

  it.each<[DrizzleDialect, string]>([
    ["postgresql", 'export const statusEnum = pgEnum("status", []);'],
    ["mysql", '    status: mysqlEnum("status", []).notNull(),'],
  ])(
    "writes an enum without values as-is with no extra diagnostic (%s)",
    (dialect, expected) => {
      const schema = buildSchema({
        enums: [makeEnum({ id: "enum_status", values: [] })],
        tables: [makeTable({ id: "tbl_users" })],
        columns: [
          makeColumn({
            id: "col_status",
            tableId: "tbl_users",
            type: { kind: "enum", enumId: "enum_status" },
          }),
        ],
      });

      expect({
        line: generate(schema, dialect).split("\n").includes(expected),
        diagnostics: diagnosticsOf(schema, dialect),
      }).toStrictEqual({ line: true, diagnostics: [] });
    },
  );

  it("writes every primary key with its constraint name", () => {
    const schema = buildSchema({
      tables: [
        keyedTable("tbl_users"),
        makeTable({
          id: "tbl_members",
          primaryKeyColumnIds: ["col_tenant_id", "col_user_id"],
        }),
      ],
      columns: [
        idColumn("tbl_users"),
        makeColumn({
          id: "col_tenant_id",
          tableId: "tbl_members",
          name: "tenant_id",
        }),
        makeColumn({
          id: "col_user_id",
          tableId: "tbl_members",
          name: "user_id",
        }),
      ],
    });
    const lines = generate(schema).split("\n");

    expect([
      lines.includes(
        '    primaryKey({ name: "users_pkey", columns: [table.id] }),',
      ),
      lines.includes(
        '    primaryKey({ name: "members_pkey", columns: [table.tenantId, table.userId] }),',
      ),
    ]).toStrictEqual([true, true]);
  });

  it("writes unique, index, unique index and foreign key constraints in the table callback", () => {
    const schema = postsSchema({
      indexes: [
        makeIndex({
          id: "idx_a",
          tableId: "tbl_posts",
          name: "posts_author_slug",
          columnIds: ["col_author_id", "col_slug"],
          isUnique: true,
        }),
        makeIndex({
          id: "idx_b",
          tableId: "tbl_posts",
          name: "posts_created_at",
          columnIds: ["col_created_at"],
        }),
      ],
    });

    expect(generate(schema)).toContain(`export const posts = pgTable(
  "posts",
  {
    id: integer("id").notNull(),
    authorId: integer("author_id").notNull(),
    slug: varchar("slug", { length: 40 }).notNull(),
    createdAt: timestamp("created_at", { precision: 6, withTimezone: true }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "posts_pkey", columns: [table.id] }),
    unique("posts_slug_key").on(table.slug),
    uniqueIndex("posts_author_slug").on(table.authorId, table.slug),
    index("posts_created_at").on(table.createdAt),
    foreignKey({ name: "posts_author_id_fkey", columns: [table.authorId], foreignColumns: [users.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);
`);
  });

  it.each(DIALECTS)(
    "uses the same constraint names as the sql ddl model (%s)",
    (dialect) => {
      const schema = createSampleSchema();
      const model = buildSqlDdlModel(schema, dialect);
      const names = [
        ...model.tables.flatMap((table) => [
          ...(table.primaryKey === null ? [] : [table.primaryKey.name]),
          ...table.uniqueConstraints.map((unique) => unique.name),
        ]),
        ...model.indexes.map((index) => index.name),
        ...model.foreignKeys.map((foreignKey) => foreignKey.name),
      ];
      const content = generate(schema, dialect);

      expect({
        missing: names.filter(
          (name) =>
            !content.includes(`(${JSON.stringify(name)})`) &&
            !content.includes(`name: ${JSON.stringify(name)}`),
        ),
        hasNames: names.length > 0,
      }).toStrictEqual({ missing: [], hasNames: true });
    },
  );

  it("references the table parameter for a self-referencing foreign key", () => {
    const schema = buildSchema({
      tables: [keyedTable("tbl_employees")],
      columns: [
        idColumn("tbl_employees"),
        makeColumn({
          id: "col_manager_id",
          tableId: "tbl_employees",
          name: "manager_id",
        }),
      ],
      relations: [
        foreignKey(
          "rel_manager",
          ["tbl_employees", "col_manager_id"],
          ["tbl_employees", "col_tbl_employees_id"],
        ),
      ],
    });

    expect(generate(schema)).toContain(
      'foreignKey({ name: "employees_manager_id_fkey", columns: [table.managerId], foreignColumns: [table.id] })',
    );
  });

  it("writes set default as no action on mysql and reports referential-action-not-supported", () => {
    const schema = postsSchema({
      relations: [authorRelation({ onDelete: "setDefault" })],
    });

    expect({
      line: generate(schema, "mysql")
        .split("\n")
        .includes('      .onDelete("no action")'),
      diagnostics: diagnosticsOf(schema, "mysql"),
    }).toStrictEqual({
      line: true,
      diagnostics: [
        {
          code: "referential-action-not-supported",
          path: ["relations", "rel_author", "onDelete"],
        },
      ],
    });
  });

  it("drops json keys on mysql and reports key-column-type-not-indexable", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t" })],
      columns: [
        makeColumn({ id: "col_doc", tableId: "tbl_t", type: { kind: "json" } }),
      ],
      indexes: [
        makeIndex({
          id: "idx_doc",
          tableId: "tbl_t",
          columnIds: ["col_doc"],
          isUnique: true,
        }),
      ],
    });
    const expected = withCode(
      buildSqlDdlModel(schema, "mysql").diagnostics,
      "key-column-type-not-indexable",
    );

    expect({
      hasIndex: generate(schema, "mysql").includes("uniqueIndex("),
      diagnostics: withCode(
        diagnosticsOf(schema, "mysql"),
        "key-column-type-not-indexable",
      ),
      isEmpty: expected.length === 0,
    }).toStrictEqual({
      hasIndex: false,
      diagnostics: expected,
      isEmpty: false,
    });
  });

  it("adds an index named <table>_<column>_idx for a mysql auto-increment column that leads no key", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_orders",
          primaryKeyColumnIds: ["col_tenant_id", "col_id"],
        }),
      ],
      columns: [
        makeColumn({
          id: "col_tenant_id",
          tableId: "tbl_orders",
          name: "tenant_id",
        }),
        makeColumn({
          id: "col_id",
          tableId: "tbl_orders",
          name: "id",
          isAutoIncrement: true,
        }),
      ],
    });

    expect({
      line: generate(schema, "mysql")
        .split("\n")
        .includes('    index("orders_id_idx").on(table.id),'),
      diagnostics: diagnosticsOf(schema, "mysql"),
    }).toStrictEqual({ line: true, diagnostics: [] });
  });

  it("renames a mysql column that differs only in case", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t" })],
      columns: [
        makeColumn({ id: "col_a", tableId: "tbl_t", name: "ma" }),
        makeColumn({ id: "col_b", tableId: "tbl_t", name: "MA" }),
      ],
    });

    expect({
      line: generate(schema, "mysql")
        .split("\n")
        .includes('    ma2: int("MA_2").notNull(),'),
      diagnostics: withCode(
        diagnosticsOf(schema, "mysql"),
        "identifier-collision-renamed",
      ),
    }).toStrictEqual({
      line: true,
      diagnostics: [
        {
          code: "identifier-collision-renamed",
          path: ["columns", "col_b", "name"],
        },
      ],
    });
  });

  it("writes relations with one, many and relation names", () => {
    const schema = postsSchema({
      columns: [
        makeColumn({
          id: "col_editor_id",
          tableId: "tbl_posts",
          name: "editor_id",
        }),
      ],
      relations: [
        authorRelation(),
        foreignKey(
          "rel_editor",
          ["tbl_posts", "col_editor_id"],
          ["tbl_users", "col_tbl_users_id"],
        ),
      ],
    });
    const content = generate(schema);

    expect(content.slice(content.indexOf("export const postsRelations"))).toBe(
      `export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id], relationName: "posts_author" }),
  editor: one(users, { fields: [posts.editorId], references: [users.id], relationName: "posts_editor" }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts, { relationName: "posts_author" }),
  posts2: many(posts, { relationName: "posts_editor" }),
}));
`,
    );
  });

  it("omits the inverse field of a named one-to-one relation", () => {
    const schema = buildSchema({
      tables: [keyedTable("tbl_employees")],
      columns: [
        idColumn("tbl_employees"),
        makeColumn({
          id: "col_mentor_id",
          tableId: "tbl_employees",
          name: "mentor_id",
        }),
      ],
      relations: [
        foreignKey(
          "rel_mentor",
          ["tbl_employees", "col_mentor_id"],
          ["tbl_employees", "col_tbl_employees_id"],
          { kind: "oneToOne" },
        ),
      ],
    });
    const content = generate(schema);

    expect(
      content.slice(content.indexOf("export const employeesRelations")),
    ).toBe(
      `export const employeesRelations = relations(employees, ({ one }) => ({
  mentor: one(employees, { fields: [employees.mentorId], references: [employees.id], relationName: "employees_mentor" }),
}));
`,
    );
  });

  it("writes no relations block for a table whose only field is an omitted named one-to-one inverse", () => {
    const schema = buildSchema({
      tables: [keyedTable("tbl_users"), keyedTable("tbl_profiles")],
      columns: [
        idColumn("tbl_users"),
        idColumn("tbl_profiles"),
        makeColumn({
          id: "col_main",
          tableId: "tbl_profiles",
          name: "main_user_id",
        }),
        makeColumn({
          id: "col_backup",
          tableId: "tbl_profiles",
          name: "backup_user_id",
        }),
      ],
      relations: [
        foreignKey(
          "rel_main",
          ["tbl_profiles", "col_main"],
          ["tbl_users", "col_tbl_users_id"],
          {
            kind: "oneToOne",
          },
        ),
        foreignKey(
          "rel_backup",
          ["tbl_profiles", "col_backup"],
          ["tbl_users", "col_tbl_users_id"],
          {
            kind: "oneToOne",
          },
        ),
      ],
    });
    const content = generate(schema);

    expect({
      hasUsersRelations: content.includes("usersRelations"),
      hasProfilesRelations: content.includes("export const profilesRelations"),
      imports: linesFrom(content, 'from "drizzle-orm";'),
    }).toStrictEqual({
      hasUsersRelations: false,
      hasProfilesRelations: true,
      imports: ['import { relations } from "drizzle-orm";'],
    });
  });

  it("writes table and column comments as JSDoc", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", comment: "Người dùng" })],
      columns: [
        makeColumn({
          id: "col_name",
          tableId: "tbl_users",
          name: "name",
          comment: "a\nb",
        }),
      ],
    });

    expect(generate(schema)).toContain(`/** Người dùng */
export const users = pgTable(
  "users",
  {
    /**
     * a
     * b
     */
    name: integer("name").notNull(),
  },
);
`);
  });

  it("escapes a comment terminator in JSDoc", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", comment: "a */ b" })],
    });

    expect(generate(schema)).toContain(
      '/** a *\\/ b */\nexport const users = pgTable("users", {});',
    );
  });

  it("writes an empty schema as a single newline", () => {
    expect(generate(createEmptySchema("Empty"))).toBe("\n");
  });

  it.each(DIALECTS)(
    "returns the same content when map keys were inserted in a different order (%s)",
    (dialect) => {
      const schema = createSampleSchema();

      expect(generate(reverseMapKeys(schema), dialect)).toBe(
        generate(schema, dialect),
      );
    },
  );

  it("reports the type diagnostics of the dialect rules", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_t", primaryKeyColumnIds: ["col_code"] })],
      columns: [
        makeColumn({
          id: "col_code",
          tableId: "tbl_t",
          type: { kind: "text" },
        }),
      ],
    });
    const expected = withCode(
      buildSqlDdlModel(schema, "mysql").diagnostics,
      "key-column-type-narrowed",
    );

    expect({
      diagnostics: diagnosticsOf(schema, "mysql"),
      isEmpty: expected.length === 0,
    }).toStrictEqual({ diagnostics: expected, isEmpty: false });
  });

  it.each<[string, () => SchemaDocument, DrizzleDialect]>([
    ["sample", createSampleSchema, "postgresql"],
    ["sample", createSampleSchema, "mysql"],
    ["naming-edge", createNamingEdgeSchema, "postgresql"],
    ["naming-edge", createNamingEdgeSchema, "mysql"],
    ["target-limit", createTargetLimitSchema, "postgresql"],
    ["target-limit", createTargetLimitSchema, "mysql"],
    ["empty", () => createEmptySchema("Empty"), "postgresql"],
    ["empty", () => createEmptySchema("Empty"), "mysql"],
  ])(
    "matches the snapshot for %s with %s",
    async (fixture, createSchema, dialect) => {
      const result = generateDrizzle(createSchema(), { dialect });

      await expect(result.file.content).toMatchFileSnapshot(
        `../__snapshots__/drizzle/${fixture}.${dialect}.ts`,
      );
      await expect(
        formatDiagnosticsSnapshot(result.diagnostics),
      ).toMatchFileSnapshot(
        `../__snapshots__/drizzle/${fixture}.${dialect}.diagnostics.txt`,
      );
    },
  );
});
