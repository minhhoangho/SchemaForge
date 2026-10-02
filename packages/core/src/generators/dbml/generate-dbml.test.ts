import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { ColumnDefault } from "../../model/column-default.js";
import type { ColumnType } from "../../model/column-type.js";
import { createEmptySchema } from "../../model/create-empty-schema.js";
import type { ReferentialAction } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeNote,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "../../testing/factories.js";
import { formatDiagnosticsSnapshot } from "../../testing/generator-snapshot.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { generateDbml } from "./generate-dbml.js";

const PROJECT_BLOCK = 'Project "test" {\n}';

function column(overrides: Partial<Column> & Pick<Column, "id">): Column {
  return makeColumn({ tableId: "tbl_users", isNullable: true, ...overrides });
}

function usersSchema(
  columns: readonly Column[],
  table: Partial<Table> = {},
): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_users", name: "users", ...table })],
    columns,
  });
}

function generate(schema: SchemaDocument): string {
  return generateDbml(schema, {}).file.content;
}

// Two tables with a single-column foreign key from posts.author_id to users.id.
function postsSchema(relation: {
  readonly kind?: "oneToOne" | "oneToMany";
  readonly onDelete?: ReferentialAction;
  readonly onUpdate?: ReferentialAction;
}): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_users", name: "users" }),
      makeTable({ id: "tbl_posts", name: "posts" }),
    ],
    columns: [
      makeColumn({ id: "col_user_id", tableId: "tbl_users", name: "id" }),
      makeColumn({ id: "col_author", tableId: "tbl_posts", name: "author_id" }),
    ],
    relations: [
      makeRelation({
        id: "rel_author",
        fromTableId: "tbl_posts",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_author", toColumnId: "col_user_id" },
        ],
        ...relation,
      }),
    ],
  });
}

describe("generateDbml", () => {
  it("names the file schema.dbml with language dbml", () => {
    const { file } = generateDbml(createEmptySchema("Empty"), {});

    expect({ fileName: file.fileName, language: file.language }).toStrictEqual({
      fileName: "schema.dbml",
      language: "dbml",
    });
  });

  it("writes Project, enums, tables, refs, table groups and notes in order", () => {
    const schema = buildSchema({
      name: "shop",
      tables: [
        makeTable({
          id: "tbl_users",
          name: "users",
          subjectAreaId: "area_core",
          primaryKeyColumnIds: ["col_user_id"],
        }),
        makeTable({ id: "tbl_posts", name: "posts" }),
      ],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_users", name: "id" }),
        makeColumn({
          id: "col_author",
          tableId: "tbl_posts",
          name: "author_id",
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_author",
          fromTableId: "tbl_posts",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_author", toColumnId: "col_user_id" },
          ],
        }),
      ],
      enums: [makeEnum({ id: "enum_status", name: "status" })],
      subjectAreas: [makeSubjectArea({ id: "area_core", name: "core" })],
      notes: [makeNote({ id: "note_a", text: "hello" })],
    });

    expect(generate(schema)).toBe(
      [
        'Project "shop" {',
        "}",
        "",
        'Enum "status" {',
        '  "active"',
        "}",
        "",
        'Table "posts" {',
        '  "author_id" integer [not null]',
        "}",
        "",
        'Table "users" {',
        '  "id" integer [pk, not null]',
        "}",
        "",
        'Ref: "posts"."author_id" > "users"."id" [delete: no action, update: no action]',
        "",
        'TableGroup "core" {',
        '  "users"',
        "}",
        "",
        'Note "note 1" {',
        "  'hello'",
        "}",
        "",
      ].join("\n"),
    );
  });

  it.each<[ColumnType, string]>([
    [{ kind: "smallint" }, "smallint"],
    [{ kind: "integer" }, "integer"],
    [{ kind: "bigint" }, "bigint"],
    [{ kind: "decimal", precision: 10, scale: 2 }, "decimal(10,2)"],
    [{ kind: "real" }, "real"],
    [{ kind: "double" }, "double"],
    [{ kind: "boolean" }, "boolean"],
    [{ kind: "char", length: 3 }, "char(3)"],
    [{ kind: "varchar", length: 255 }, "varchar(255)"],
    [{ kind: "text" }, "text"],
    [{ kind: "uuid" }, "uuid"],
    [{ kind: "date" }, "date"],
    [{ kind: "time" }, "time"],
    [{ kind: "timestamp" }, "timestamp"],
    [{ kind: "timestamptz" }, "timestamptz"],
    [{ kind: "json" }, "json"],
    [{ kind: "binary" }, "binary"],
  ])(
    "writes generic type names including decimal without spaces (%o)",
    (type, expected) => {
      const schema = usersSchema([column({ id: "col_value", type })]);

      expect(generate(schema)).toContain(`\n  "value" ${expected}\n`);
    },
  );

  it("quotes enum and custom type names", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      columns: [
        column({
          id: "col_status",
          type: { kind: "enum", enumId: "enum_status" },
        }),
        column({
          id: "col_shape",
          type: { kind: "custom", name: 'geometry(Point, 4326) "x"' },
        }),
      ],
      enums: [makeEnum({ id: "enum_status", name: "order status" })],
    });

    expect(generate(schema)).toContain(
      [
        'Table "users" {',
        '  "status" "order status"',
        '  "shape" "geometry(Point, 4326) \\"x\\""',
        "}",
      ].join("\n"),
    );
  });

  it("writes pk, increment, not null, unique, default and note settings in order", () => {
    const schema = usersSchema(
      [
        column({
          id: "col_id",
          isNullable: false,
          isAutoIncrement: true,
          isUnique: true,
          defaultValue: { kind: "literal", value: "1" },
          comment: "the key",
        }),
        column({ id: "col_plain" }),
      ],
      { primaryKeyColumnIds: ["col_id"] },
    );

    expect(generate(schema)).toContain(
      [
        "  \"id\" integer [pk, increment, not null, unique, default: 1, note: 'the key']",
        '  "plain" integer',
        "}",
      ].join("\n"),
    );
  });

  it.each<[ColumnType, ColumnDefault, string]>([
    [{ kind: "smallint" }, { kind: "literal", value: "-3" }, "-3"],
    [{ kind: "integer" }, { kind: "literal", value: "42" }, "42"],
    [
      { kind: "bigint" },
      { kind: "literal", value: "9007199254740993" },
      "9007199254740993",
    ],
    [
      { kind: "decimal", precision: 10, scale: 2 },
      { kind: "literal", value: "-1.50" },
      "-1.50",
    ],
    [{ kind: "real" }, { kind: "literal", value: "1.5e-3" }, "1.5e-3"],
    [{ kind: "double" }, { kind: "literal", value: "2.25" }, "2.25"],
    [{ kind: "boolean" }, { kind: "literal", value: "false" }, "false"],
    [{ kind: "text" }, { kind: "literal", value: "it's" }, "'it\\'s'"],
    [
      { kind: "varchar", length: 10 },
      { kind: "literal", value: "a\nb" },
      "'''a\nb'''",
    ],
    [
      { kind: "date" },
      { kind: "literal", value: "2024-01-31" },
      "'2024-01-31'",
    ],
    [{ kind: "json" }, { kind: "literal", value: '{"a":1}' }, "'{\"a\":1}'"],
    [
      { kind: "custom", name: "citext" },
      { kind: "literal", value: "x" },
      "'x'",
    ],
    [{ kind: "timestamptz" }, { kind: "currentTimestamp" }, "`now()`"],
    [{ kind: "uuid" }, { kind: "generateUuid" }, "`gen_random_uuid()`"],
  ])("writes defaults by kind (%o, %o)", (type, defaultValue, expected) => {
    const schema = usersSchema([
      column({ id: "col_value", type, defaultValue }),
    ]);

    expect(generate(schema)).toContain(`[default: ${expected}]`);
  });

  it("writes an enum default as a string", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      columns: [
        column({
          id: "col_status",
          type: { kind: "enum", enumId: "enum_status" },
          defaultValue: { kind: "literal", value: "active" },
        }),
      ],
      enums: [makeEnum({ id: "enum_status", name: "status" })],
    });

    expect(generate(schema)).toContain(
      '  "status" "status" [default: \'active\']',
    );
  });

  it("omits an invalid default and reports default-omitted", () => {
    const schema = usersSchema([
      column({
        id: "col_count",
        defaultValue: { kind: "literal", value: "many" },
      }),
      column({ id: "col_at", defaultValue: { kind: "currentTimestamp" } }),
    ]);

    const result = generateDbml(schema, {});

    expect([result.file.content, result.diagnostics]).toStrictEqual([
      `${PROJECT_BLOCK}\n\nTable "users" {\n  "count" integer\n  "at" integer\n}\n`,
      [
        {
          code: "default-omitted",
          path: ["columns", "col_at", "defaultValue"],
        },
        {
          code: "default-omitted",
          path: ["columns", "col_count", "defaultValue"],
        },
      ],
    ]);
  });

  it("writes a composite primary key and indexes inside indexes", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_users",
          name: "users",
          primaryKeyColumnIds: ["col_b", "col_a"],
        }),
      ],
      columns: [
        column({ id: "col_a", isNullable: false }),
        column({ id: "col_b", isNullable: false }),
        column({ id: "col_email" }),
      ],
      indexes: [
        makeIndex({
          id: "idx_z",
          tableId: "tbl_users",
          name: "z_idx",
          columnIds: ["col_email"],
        }),
        makeIndex({
          id: "idx_a",
          tableId: "tbl_users",
          name: "a_key",
          columnIds: ["col_email", "col_a"],
          isUnique: true,
        }),
      ],
    });

    expect(generate(schema)).toContain(
      [
        'Table "users" {',
        '  "a" integer [not null]',
        '  "b" integer [not null]',
        '  "email" integer',
        "  indexes {",
        '    ("b", "a") [pk]',
        '    ("email", "a") [unique, name: \'a_key\']',
        "    (\"email\") [name: 'z_idx']",
        "  }",
        "}",
      ].join("\n"),
    );
  });

  it("writes a table note", () => {
    const schema = usersSchema([column({ id: "col_id" })], {
      comment: "Người dùng",
    });

    expect(generate(schema)).toContain(
      "  \"id\" integer\n  Note: 'Người dùng'\n}",
    );
  });

  it.each<[ReferentialAction, string]>([
    ["noAction", "no action"],
    ["restrict", "restrict"],
    ["cascade", "cascade"],
    ["setNull", "set null"],
    ["setDefault", "set default"],
  ])(
    "writes one-to-many and one-to-one refs with both actions (%s)",
    (action, keyword) => {
      const oneToMany = postsSchema({ onDelete: action });
      const oneToOne = postsSchema({ kind: "oneToOne", onUpdate: action });

      expect([generate(oneToMany), generate(oneToOne)]).toStrictEqual([
        expect.stringContaining(
          `\nRef: "posts"."author_id" > "users"."id" [delete: ${keyword}, update: no action]\n`,
        ),
        expect.stringContaining(
          `\nRef: "posts"."author_id" - "users"."id" [delete: no action, update: ${keyword}]\n`,
        ),
      ]);
    },
  );

  it("writes a composite ref with column lists", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_users", name: "users" }),
        makeTable({ id: "tbl_posts", name: "posts" }),
      ],
      columns: [
        makeColumn({
          id: "col_tenant",
          tableId: "tbl_users",
          name: "tenant_id",
        }),
        makeColumn({ id: "col_user_id", tableId: "tbl_users", name: "id" }),
        makeColumn({
          id: "col_p_tenant",
          tableId: "tbl_posts",
          name: "tenant_id",
        }),
        makeColumn({
          id: "col_author",
          tableId: "tbl_posts",
          name: "author_id",
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_author",
          fromTableId: "tbl_posts",
          toTableId: "tbl_users",
          onDelete: "cascade",
          columnPairs: [
            { fromColumnId: "col_p_tenant", toColumnId: "col_tenant" },
            { fromColumnId: "col_author", toColumnId: "col_user_id" },
          ],
        }),
      ],
    });

    expect(generate(schema)).toContain(
      '\nRef: "posts".("tenant_id", "author_id") > "users".("tenant_id", "id") [delete: cascade, update: no action]\n',
    );
  });

  it("writes every relation as one line of a single Ref block", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      columns: [
        column({ id: "col_id", name: "id" }),
        column({ id: "col_manager", name: "manager_id" }),
        column({ id: "col_mentor", name: "mentor_id" }),
      ],
      relations: [
        makeRelation({
          id: "rel_mentor",
          fromTableId: "tbl_users",
          toTableId: "tbl_users",
          columnPairs: [{ fromColumnId: "col_mentor", toColumnId: "col_id" }],
        }),
        makeRelation({
          id: "rel_manager",
          fromTableId: "tbl_users",
          toTableId: "tbl_users",
          columnPairs: [{ fromColumnId: "col_manager", toColumnId: "col_id" }],
        }),
      ],
    });

    expect(generate(schema)).toContain(
      [
        "}",
        "",
        'Ref: "users"."manager_id" > "users"."id" [delete: no action, update: no action]',
        'Ref: "users"."mentor_id" > "users"."id" [delete: no action, update: no action]',
        "",
      ].join("\n"),
    );
  });

  it("writes subject areas as table groups", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_b", name: "b", subjectAreaId: "area_x" }),
        makeTable({ id: "tbl_a", name: "a", subjectAreaId: "area_x" }),
        makeTable({ id: "tbl_c", name: "c" }),
      ],
      columns: [
        makeColumn({ id: "col_a", tableId: "tbl_a" }),
        makeColumn({ id: "col_b", tableId: "tbl_b" }),
        makeColumn({ id: "col_c", tableId: "tbl_c" }),
      ],
      subjectAreas: [
        makeSubjectArea({ id: "area_x", name: "Khu vực" }),
        makeSubjectArea({ id: "area_empty", name: "empty" }),
      ],
    });

    expect(generate(schema)).toContain(
      [
        'TableGroup "empty" {',
        "}",
        "",
        'TableGroup "Khu vực" {',
        '  "a"',
        '  "b"',
        "}",
        "",
      ].join("\n"),
    );
  });

  it("numbers notes by note order", () => {
    const schema = buildSchema({
      notes: [
        makeNote({ id: "note_b", text: "second" }),
        makeNote({ id: "note_a", text: "first\nline" }),
      ],
    });

    expect(generate(schema)).toBe(
      [
        PROJECT_BLOCK,
        "",
        'Note "note 1" {',
        "  '''first",
        "line'''",
        "}",
        "",
        'Note "note 2" {',
        "  'second'",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("escapes names and comments with quotes, backslashes and triple quotes", () => {
    const schema = buildSchema({
      name: 'my "shop"',
      tables: [
        makeTable({
          id: "tbl_users",
          name: 'us"er\\s',
          comment: "it's\n'''x'''",
        }),
      ],
      columns: [column({ id: "col_id", name: 'i"d', comment: "a\\b'c" })],
      enums: [makeEnum({ id: "enum_x", name: "e\\", values: ['v"1'] })],
    });

    expect(generate(schema)).toBe(
      [
        'Project "my \\"shop\\"" {',
        "}",
        "",
        'Enum "e\\\\" {',
        '  "v\\"1"',
        "}",
        "",
        'Table "us\\"er\\\\s" {',
        "  \"i\\\"d\" integer [note: 'a\\\\b\\'c']",
        "  Note: '''it\\'s",
        "\\'\\'\\'x\\'\\'\\''''",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("writes an empty schema as the Project block", () => {
    const result = generateDbml(createEmptySchema("Empty"), {});

    expect([result.file.content, result.diagnostics]).toStrictEqual([
      'Project "Empty" {\n}\n',
      [],
    ]);
  });

  it("returns the same content when map keys were inserted in a different order", () => {
    const schema = createSampleSchema();
    const reordered: SchemaDocument = {
      ...schema,
      tables: Object.fromEntries(Object.entries(schema.tables).reverse()),
      columns: Object.fromEntries(Object.entries(schema.columns).reverse()),
      relations: Object.fromEntries(Object.entries(schema.relations).reverse()),
      indexes: Object.fromEntries(Object.entries(schema.indexes).reverse()),
      enums: Object.fromEntries(Object.entries(schema.enums).reverse()),
      subjectAreas: Object.fromEntries(
        Object.entries(schema.subjectAreas).reverse(),
      ),
      notes: Object.fromEntries(Object.entries(schema.notes).reverse()),
    };

    expect(generateDbml(reordered, {})).toStrictEqual(generateDbml(schema, {}));
  });

  it.each<[string, () => SchemaDocument]>([
    ["sample", createSampleSchema],
    ["naming-edge", createNamingEdgeSchema],
    ["target-limit", createTargetLimitSchema],
    ["empty", () => createEmptySchema("Empty")],
  ])("matches the snapshot for %s", async (fixture, createSchema) => {
    const result = generateDbml(createSchema(), {});

    await expect(result.file.content).toMatchFileSnapshot(
      `../__snapshots__/dbml/${fixture}.dbml`,
    );
    await expect(
      formatDiagnosticsSnapshot(result.diagnostics),
    ).toMatchFileSnapshot(`../__snapshots__/dbml/${fixture}.diagnostics.txt`);
  });
});
