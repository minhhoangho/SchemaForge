import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
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
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import { formatDiagnosticsSnapshot } from "../../testing/generator-snapshot.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import type { MarkdownLabels } from "../shared/generator-types.js";
import { generateMarkdown } from "./generate-markdown.js";

const TEST_MARKDOWN_LABELS: MarkdownLabels = {
  enumsHeading: "Enums",
  tablesHeading: "Tables",
  indexesHeading: "Indexes",
  relationsHeading: "Relations",
  columnNameHeader: "Name",
  columnTypeHeader: "Type",
  columnNullableHeader: "Nullable",
  columnDefaultHeader: "Default",
  columnConstraintsHeader: "Constraints",
  columnCommentHeader: "Comment",
  indexNameHeader: "Name",
  indexColumnsHeader: "Columns",
  indexUniqueHeader: "Unique",
  yes: "Yes",
  no: "No",
  primaryKey: "Primary key",
  unique: "Unique",
  autoIncrement: "Auto increment",
  foreignKey: "Foreign key",
  oneToOne: "One to one",
  oneToMany: "One to many",
  outgoingRelations: "Outgoing",
  incomingRelations: "Incoming",
};

const COLUMN_TABLE_HEADER = [
  "| Name | Type | Nullable | Default | Constraints | Comment |",
  "|---|---|---|---|---|---|",
].join("\n");

function generate(
  schema: SchemaDocument,
  labels: MarkdownLabels = TEST_MARKDOWN_LABELS,
): string {
  return generateMarkdown(schema, { labels }).file.content;
}

function column(overrides: Partial<Column> & Pick<Column, "id">): Column {
  return makeColumn({ tableId: "tbl_users", ...overrides });
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

// posts.author_id references users.id.
function postsSchema(relation: {
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
      makeColumn({ id: "col_author", tableId: "tbl_posts", name: "author" }),
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

describe("generateMarkdown", () => {
  it("names the file schema.md with language markdown", () => {
    const { file } = generateMarkdown(createEmptySchema("Empty"), {
      labels: TEST_MARKDOWN_LABELS,
    });

    expect({ fileName: file.fileName, language: file.language }).toStrictEqual({
      fileName: "schema.md",
      language: "markdown",
    });
  });

  it("starts with the schema name as a level one heading", () => {
    expect(generate(createEmptySchema("My shop"))).toBe("# My shop\n");
  });

  it("lists enums with their values", () => {
    const schema = buildSchema({
      enums: [
        makeEnum({ id: "enum_status", values: ["active", "on_hold"] }),
        makeEnum({ id: "enum_flags", values: [] }),
      ],
    });

    expect(generate(schema)).toBe(
      [
        "# test",
        "",
        "## Enums",
        "",
        "### flags",
        "",
        "### status",
        "",
        "- active",
        "- on\\_hold",
        "",
      ].join("\n"),
    );
  });

  it("writes a column table with the six labelled headers", () => {
    const schema = usersSchema([column({ id: "col_id" })]);

    expect(generate(schema)).toBe(
      [
        "# test",
        "",
        "## Tables",
        "",
        "### users",
        "",
        COLUMN_TABLE_HEADER,
        "| id | integer | No | | | |",
        "",
      ].join("\n"),
    );
  });

  it.each<[ColumnType, string]>([
    [{ kind: "smallint" }, "smallint"],
    [{ kind: "bigint" }, "bigint"],
    [{ kind: "decimal", precision: 10, scale: 2 }, "decimal\\(10,2\\)"],
    [{ kind: "real" }, "real"],
    [{ kind: "double" }, "double"],
    [{ kind: "boolean" }, "boolean"],
    [{ kind: "char", length: 2 }, "char\\(2\\)"],
    [{ kind: "varchar", length: 255 }, "varchar\\(255\\)"],
    [{ kind: "text" }, "text"],
    [{ kind: "uuid" }, "uuid"],
    [{ kind: "date" }, "date"],
    [{ kind: "time" }, "time"],
    [{ kind: "timestamp" }, "timestamp"],
    [{ kind: "timestamptz" }, "timestamptz"],
    [{ kind: "json" }, "json"],
    [{ kind: "binary" }, "binary"],
    [{ kind: "custom", name: "geometry(Point)" }, "geometry\\(Point\\)"],
  ])("writes generic and custom type names (%o)", (type, expected) => {
    const schema = usersSchema([column({ id: "col_value", type })]);

    expect(generate(schema)).toContain(`\n| value | ${expected} | No |`);
  });

  it("writes the enum name as the type of an enum column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      columns: [
        column({
          id: "col_status",
          type: { kind: "enum", enumId: "enum_status" },
        }),
      ],
      enums: [makeEnum({ id: "enum_status", name: "order_status" })],
    });

    expect(generate(schema)).toContain("\n| status | order\\_status | No |");
  });

  it("writes yes and no labels for nullable", () => {
    const schema = usersSchema([
      column({ id: "col_a", isNullable: true }),
      column({ id: "col_b", isNullable: false }),
    ]);

    expect(generate(schema)).toContain(
      "\n| a | integer | Yes | | | |\n| b | integer | No | | | |\n",
    );
  });

  it("lists primary key, unique, auto-increment and foreign key constraints", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_users",
          name: "users",
          primaryKeyColumnIds: ["col_id"],
        }),
      ],
      columns: [
        column({ id: "col_id", isUnique: true, isAutoIncrement: true }),
        column({ id: "col_parent" }),
      ],
      relations: [
        makeRelation({
          id: "rel_parent",
          fromTableId: "tbl_users",
          toTableId: "tbl_users",
          columnPairs: [{ fromColumnId: "col_parent", toColumnId: "col_id" }],
        }),
      ],
    });

    expect(generate(schema)).toContain(
      [
        "| id | integer | No | | Primary key, Unique, Auto increment | |",
        "| parent | integer | No | | Foreign key | |",
      ].join("\n"),
    );
  });

  it("writes defaults and omits an invalid one with default-omitted", () => {
    const schema = usersSchema([
      column({
        id: "col_n",
        type: { kind: "decimal", precision: 10, scale: 2 },
        defaultValue: { kind: "literal", value: "-1.5" },
      }),
      column({
        id: "col_s",
        type: { kind: "text" },
        defaultValue: { kind: "literal", value: "a_b" },
      }),
      column({
        id: "col_at",
        type: { kind: "timestamp" },
        defaultValue: { kind: "currentTimestamp" },
      }),
      column({
        id: "col_u",
        type: { kind: "uuid" },
        defaultValue: { kind: "generateUuid" },
      }),
      column({ id: "col_bad", defaultValue: { kind: "generateUuid" } }),
    ]);

    const result = generateMarkdown(schema, { labels: TEST_MARKDOWN_LABELS });

    expect([result.file.content, result.diagnostics]).toStrictEqual([
      [
        "# test",
        "",
        "## Tables",
        "",
        "### users",
        "",
        COLUMN_TABLE_HEADER,
        "| n | decimal\\(10,2\\) | No | \\-1\\.5 | | |",
        "| s | text | No | a\\_b | | |",
        "| at | timestamp | No | now\\(\\) | | |",
        "| u | uuid | No | gen\\_random\\_uuid\\(\\) | | |",
        "| bad | integer | No | | | |",
        "",
      ].join("\n"),
      [
        {
          code: "default-omitted",
          path: ["columns", "col_bad", "defaultValue"],
        },
      ],
    ]);
  });

  it("writes the table comment as a paragraph", () => {
    const schema = usersSchema([column({ id: "col_id" })], {
      comment: "All *users*",
    });

    expect(generate(schema)).toContain(
      `### users\n\nAll \\*users\\*\n\n${COLUMN_TABLE_HEADER}`,
    );
  });

  it("writes an index table only when the table has indexes", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_users", name: "users" }),
        makeTable({ id: "tbl_tags", name: "tags" }),
      ],
      columns: [
        column({ id: "col_a" }),
        column({ id: "col_b" }),
        makeColumn({ id: "col_label", tableId: "tbl_tags" }),
      ],
      indexes: [
        makeIndex({
          id: "idx_users_ab",
          tableId: "tbl_users",
          columnIds: ["col_a", "col_b"],
          isUnique: true,
        }),
        makeIndex({
          id: "idx_users_b",
          tableId: "tbl_users",
          columnIds: ["col_b"],
        }),
      ],
    });

    expect(generate(schema)).toBe(
      [
        "# test",
        "",
        "## Tables",
        "",
        "### tags",
        "",
        COLUMN_TABLE_HEADER,
        "| label | integer | No | | | |",
        "",
        "### users",
        "",
        COLUMN_TABLE_HEADER,
        "| a | integer | No | | | |",
        "| b | integer | No | | | |",
        "",
        "#### Indexes",
        "",
        "| Name | Columns | Unique |",
        "|---|---|---|",
        "| users\\_ab | a, b | Yes |",
        "| users\\_b | b | No |",
        "",
      ].join("\n"),
    );
  });

  it("writes outgoing and incoming relations with kind and actions", () => {
    const schema = postsSchema({ onDelete: "cascade", onUpdate: "setNull" });

    expect(generate(schema)).toBe(
      [
        "# test",
        "",
        "## Tables",
        "",
        "### posts",
        "",
        COLUMN_TABLE_HEADER,
        "| author | integer | No | | Foreign key | |",
        "",
        "#### Relations",
        "",
        "Outgoing",
        "",
        "- author → users.id (One to many, ON DELETE CASCADE, ON UPDATE SET NULL)",
        "",
        "### users",
        "",
        COLUMN_TABLE_HEADER,
        "| id | integer | No | | | |",
        "",
        "#### Relations",
        "",
        "Incoming",
        "",
        "- posts.author → id (One to many, ON DELETE CASCADE, ON UPDATE SET NULL)",
        "",
      ].join("\n"),
    );
  });

  it.each<[ReferentialAction, string]>([
    ["noAction", "NO ACTION"],
    ["restrict", "RESTRICT"],
    ["cascade", "CASCADE"],
    ["setNull", "SET NULL"],
    ["setDefault", "SET DEFAULT"],
  ])("writes the %s action as an SQL keyword", (action, keyword) => {
    const schema = postsSchema({ onDelete: action, onUpdate: action });

    expect(generate(schema)).toContain(
      `- author → users.id (One to many, ON DELETE ${keyword}, ON UPDATE ${keyword})`,
    );
  });

  it("joins the columns of a composite relation with commas", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_users", name: "users" }),
        makeTable({ id: "tbl_posts", name: "posts" }),
      ],
      columns: [
        makeColumn({ id: "col_user_a", tableId: "tbl_users", name: "x" }),
        makeColumn({ id: "col_user_b", tableId: "tbl_users", name: "y" }),
        makeColumn({ id: "col_post_a", tableId: "tbl_posts", name: "a" }),
        makeColumn({ id: "col_post_b", tableId: "tbl_posts", name: "b" }),
      ],
      relations: [
        makeRelation({
          id: "rel_pair",
          kind: "oneToOne",
          fromTableId: "tbl_posts",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_post_a", toColumnId: "col_user_a" },
            { fromColumnId: "col_post_b", toColumnId: "col_user_b" },
          ],
        }),
      ],
    });

    expect(generate(schema)).toContain(
      "- a, b → users.x, y (One to one, ON DELETE NO ACTION, ON UPDATE NO ACTION)",
    );
  });

  it("lists a self-reference in both groups", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      columns: [column({ id: "col_id" }), column({ id: "col_parent" })],
      relations: [
        makeRelation({
          id: "rel_parent",
          fromTableId: "tbl_users",
          toTableId: "tbl_users",
          columnPairs: [{ fromColumnId: "col_parent", toColumnId: "col_id" }],
        }),
      ],
    });

    expect(generate(schema)).toContain(
      [
        "#### Relations",
        "",
        "Outgoing",
        "",
        "- parent → users.id (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)",
        "",
        "Incoming",
        "",
        "- users.parent → id (One to many, ON DELETE NO ACTION, ON UPDATE NO ACTION)",
        "",
      ].join("\n"),
    );
  });

  it("skips empty sections and subsections", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
    });

    expect(generate(schema)).toBe("# test\n\n## Tables\n\n### users\n");
  });

  it("escapes pipes and line breaks inside table cells", () => {
    const schema = usersSchema([
      column({ id: "col_id", name: "a|b", comment: "first\r\nsecond | third" }),
    ]);

    expect(generate(schema)).toContain(
      "\n| a\\|b | integer | No | | | first<br>second \\| third |\n",
    );
  });

  it("escapes names in headings and list items", () => {
    const schema = buildSchema({
      name: "# shop",
      tables: [makeTable({ id: "tbl_users", name: "[users]" })],
      enums: [makeEnum({ id: "enum_kind", name: "kind!", values: ["- a"] })],
    });

    expect(generate(schema)).toContain(
      [
        "# \\# shop",
        "",
        "## Enums",
        "",
        "### kind\\!",
        "",
        "- \\- a",
        "",
        "## Tables",
        "",
        "### \\[users\\]",
      ].join("\n"),
    );
  });

  it("escapes labels", () => {
    const schema = usersSchema([column({ id: "col_id", isNullable: true })]);
    const labels: MarkdownLabels = {
      ...TEST_MARKDOWN_LABELS,
      tablesHeading: "Tables_*",
      columnNameHeader: "Name|x",
      yes: "Yes\nreally",
    };

    expect(generate(schema, labels)).toContain(
      [
        "## Tables\\_\\*",
        "",
        "### users",
        "",
        "| Name\\|x | Type | Nullable | Default | Constraints | Comment |",
        "|---|---|---|---|---|---|",
        "| id | integer | Yes<br>really | | | |",
      ].join("\n"),
    );
  });

  it("uses the labels passed in the options", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status" })],
      tables: [makeTable({ id: "tbl_users", name: "users" })],
    });
    const labels: MarkdownLabels = {
      ...TEST_MARKDOWN_LABELS,
      enumsHeading: "Kiểu liệt kê",
      tablesHeading: "Bảng",
    };

    expect(generate(schema, labels)).toBe(
      [
        "# test",
        "",
        "## Kiểu liệt kê",
        "",
        "### status",
        "",
        "- active",
        "",
        "## Bảng",
        "",
        "### users",
        "",
      ].join("\n"),
    );
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
    const options = { labels: TEST_MARKDOWN_LABELS };

    expect(generateMarkdown(reordered, options)).toStrictEqual(
      generateMarkdown(schema, options),
    );
  });

  it.each<[string, () => SchemaDocument]>([
    ["sample", createSampleSchema],
    ["naming-edge", createNamingEdgeSchema],
    ["target-limit", createTargetLimitSchema],
    ["empty", () => createEmptySchema("Empty")],
  ])("matches the snapshot for %s", async (fixture, createSchema) => {
    const result = generateMarkdown(createSchema(), {
      labels: TEST_MARKDOWN_LABELS,
    });

    await expect(result.file.content).toMatchFileSnapshot(
      `../__snapshots__/markdown/${fixture}.md`,
    );
    await expect(
      formatDiagnosticsSnapshot(result.diagnostics),
    ).toMatchFileSnapshot(
      `../__snapshots__/markdown/${fixture}.diagnostics.txt`,
    );
  });
});
