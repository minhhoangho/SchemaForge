import {
  buildSchema,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { getForeignKeyColumnIds } from "./foreign-key-columns";

function createRelations(): ReturnType<typeof buildSchema>["relations"] {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_user_id"] }),
      makeTable({ id: "tbl_posts" }),
      makeTable({ id: "tbl_comments" }),
    ],
    columns: [
      makeColumn({ id: "col_user_id", tableId: "tbl_users" }),
      makeColumn({ id: "col_post_author", tableId: "tbl_posts" }),
      makeColumn({ id: "col_comment_author", tableId: "tbl_comments" }),
    ],
    relations: [
      makeRelation({
        id: "rel_posts_users",
        fromTableId: "tbl_posts",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_post_author", toColumnId: "col_user_id" },
        ],
      }),
      makeRelation({
        id: "rel_comments_users",
        fromTableId: "tbl_comments",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_comment_author", toColumnId: "col_user_id" },
        ],
      }),
    ],
  }).relations;
}

describe("getForeignKeyColumnIds", () => {
  it("collects every from column of every relation", () => {
    expect([...getForeignKeyColumnIds(createRelations())].toSorted()).toEqual([
      "col_comment_author",
      "col_post_author",
    ]);
  });

  it("returns the same set for the same relations reference", () => {
    const relations = createRelations();

    expect(getForeignKeyColumnIds(relations)).toBe(
      getForeignKeyColumnIds(relations),
    );
  });
});
