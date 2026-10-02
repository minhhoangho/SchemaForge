import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { Relation } from "../../model/relation.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import {
  allocateModelNames,
  buildRelationFieldNames,
} from "./relation-field-names.js";
import type { RelationFieldNames } from "./relation-field-names.js";

const USERS = makeTable({
  id: "tbl_users",
  name: "users",
  primaryKeyColumnIds: ["col_users_id"],
});
const USERS_ID = makeColumn({
  id: "col_users_id",
  tableId: "tbl_users",
  name: "id",
});

function postsTable(name = "posts"): Table {
  return makeTable({ id: "tbl_posts", name });
}

function postsColumn(id: `col_${string}`, name: string): Column {
  return makeColumn({ id, tableId: "tbl_posts", name, isNullable: true });
}

// `posts.<fromColumnId>` references `users.id`.
function toUsers(id: `rel_${string}`, fromColumnId: `col_${string}`): Relation {
  return makeRelation({
    id,
    fromTableId: "tbl_posts",
    toTableId: "tbl_users",
    columnPairs: [{ fromColumnId, toColumnId: "col_users_id" }],
  });
}

function fieldNames(schema: SchemaDocument): RelationFieldNames {
  return buildRelationFieldNames(
    schema,
    allocateModelNames(schema, []).tableNames,
  );
}

// `posts` with one column named `columnName` that references `users.id`.
function singleForeignKeySchema(columnName: string): SchemaDocument {
  return buildSchema({
    tables: [postsTable(), USERS],
    columns: [postsColumn("col_posts_fk", columnName), USERS_ID],
    relations: [toUsers("rel_posts_users", "col_posts_fk")],
  });
}

describe("buildRelationFieldNames", () => {
  it("names column fields by camelCase of column names", () => {
    const schema = buildSchema({
      tables: [postsTable()],
      columns: [
        postsColumn("col_posts_created", "created at"),
        postsColumn("col_posts_author", "author_id"),
      ],
    });

    expect(fieldNames(schema).columnFieldNames).toStrictEqual(
      new Map([
        ["col_posts_created", "createdAt"],
        ["col_posts_author", "authorId"],
      ]),
    );
  });

  it.each([
    ["author_id", "author"],
    ["người dùng id", "nguoiDung"],
    ["authorId", "author"],
  ])(
    "names the forward field by stripping an id suffix from %s",
    (columnName, expected) => {
      const schema = singleForeignKeySchema(columnName);

      expect(fieldNames(schema).forwardFieldNames.get("rel_posts_users")).toBe(
        expected,
      );
    },
  );

  it("names the forward field by the target table when there is no id suffix", () => {
    const schema = singleForeignKeySchema("owner");

    expect(fieldNames(schema).forwardFieldNames.get("rel_posts_users")).toBe(
      "users",
    );
  });

  it("names the forward field by the target table for a composite relation", () => {
    const schema = buildSchema({
      tables: [
        postsTable(),
        makeTable({
          id: "tbl_users",
          name: "app users",
          primaryKeyColumnIds: ["col_users_a", "col_users_b"],
        }),
      ],
      columns: [
        postsColumn("col_posts_a_id", "a_id"),
        postsColumn("col_posts_b_id", "b_id"),
        makeColumn({ id: "col_users_a", tableId: "tbl_users" }),
        makeColumn({ id: "col_users_b", tableId: "tbl_users" }),
      ],
      relations: [
        makeRelation({
          id: "rel_posts_users",
          fromTableId: "tbl_posts",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_posts_a_id", toColumnId: "col_users_a" },
            { fromColumnId: "col_posts_b_id", toColumnId: "col_users_b" },
          ],
        }),
      ],
    });

    expect(fieldNames(schema).forwardFieldNames.get("rel_posts_users")).toBe(
      "appUsers",
    );
  });

  it("names the inverse field by camelCase of the source table", () => {
    const schema = buildSchema({
      tables: [postsTable("blog posts"), USERS],
      columns: [postsColumn("col_posts_fk", "author_id"), USERS_ID],
      relations: [toUsers("rel_posts_users", "col_posts_fk")],
    });

    expect(fieldNames(schema).inverseFieldNames.get("rel_posts_users")).toBe(
      "blogPosts",
    );
  });

  it("adds 2 when a relation field repeats a column field", () => {
    const schema = buildSchema({
      tables: [postsTable(), USERS],
      columns: [
        postsColumn("col_posts_author", "author"),
        postsColumn("col_posts_fk", "author_id"),
        USERS_ID,
      ],
      relations: [toUsers("rel_posts_users", "col_posts_fk")],
    });

    expect(fieldNames(schema).forwardFieldNames.get("rel_posts_users")).toBe(
      "author2",
    );
  });

  it("adds a relation name for two relations between the same tables", () => {
    const schema = buildSchema({
      tables: [postsTable(), USERS],
      columns: [
        postsColumn("col_posts_author", "author_id"),
        postsColumn("col_posts_editor", "editor_id"),
        USERS_ID,
      ],
      relations: [
        toUsers("rel_author", "col_posts_author"),
        toUsers("rel_editor", "col_posts_editor"),
      ],
    });

    expect(fieldNames(schema).relationNames).toStrictEqual(
      new Map([
        ["rel_author", "Posts_author"],
        ["rel_editor", "Posts_editor"],
      ]),
    );
  });

  it("adds a relation name for a self-reference", () => {
    const schema = buildSchema({
      tables: [USERS],
      columns: [
        USERS_ID,
        makeColumn({
          id: "col_users_manager",
          tableId: "tbl_users",
          name: "manager_id",
          isNullable: true,
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_manager",
          fromTableId: "tbl_users",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_users_manager", toColumnId: "col_users_id" },
          ],
        }),
      ],
    });

    expect(fieldNames(schema).relationNames).toStrictEqual(
      new Map([["rel_manager", "Users_manager"]]),
    );
  });

  it("writes no relation name for a single relation", () => {
    const schema = singleForeignKeySchema("author_id");

    expect(fieldNames(schema).relationNames).toStrictEqual(new Map());
  });

  it("throws when a table has no model name", () => {
    const schema = buildSchema({
      tables: [USERS],
      columns: [
        USERS_ID,
        makeColumn({
          id: "col_users_manager",
          tableId: "tbl_users",
          isNullable: true,
        }),
      ],
      relations: [
        makeRelation({
          id: "rel_manager",
          fromTableId: "tbl_users",
          toTableId: "tbl_users",
          columnPairs: [
            { fromColumnId: "col_users_manager", toColumnId: "col_users_id" },
          ],
        }),
      ],
    });

    expect(() => buildRelationFieldNames(schema, new Map())).toThrow(
      RangeError,
    );
  });
});

describe("allocateModelNames", () => {
  it("allocates model names with enums before tables and suffixes reserved words", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_status", name: "status" }),
        makeTable({ id: "tbl_model", name: "model" }),
      ],
      enums: [makeEnum({ id: "enum_status", name: "status" })],
    });

    expect(allocateModelNames(schema, ["Model"])).toStrictEqual({
      enumNames: new Map([["enum_status", "Status"]]),
      tableNames: new Map([
        ["tbl_model", "Model_"],
        ["tbl_status", "Status2"],
      ]),
    });
  });
});
