import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import type { MarkdownLabels } from "../shared/generator-types.js";
import { renderRelations } from "./markdown-relations.js";

const LABELS: MarkdownLabels = {
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

const USERS = makeTable({ id: "tbl_users", name: "users" });
const POSTS = makeTable({ id: "tbl_posts", name: "posts" });

function postsSchema(userName = "users"): SchemaDocument {
  return buildSchema({
    tables: [{ ...USERS, name: userName }, POSTS],
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
        onDelete: "cascade",
      }),
    ],
  });
}

describe("renderRelations", () => {
  it("returns no blocks for a table without relations", () => {
    const schema = buildSchema({ tables: [USERS] });

    expect(renderRelations(schema, USERS, LABELS)).toStrictEqual([]);
  });

  it("lists an outgoing relation under the source table", () => {
    expect(renderRelations(postsSchema(), POSTS, LABELS)).toStrictEqual([
      ["#### Relations"],
      ["Outgoing"],
      [
        "- author → users.id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)",
      ],
    ]);
  });

  it("lists an incoming relation under the target table", () => {
    expect(renderRelations(postsSchema(), USERS, LABELS)).toStrictEqual([
      ["#### Relations"],
      ["Incoming"],
      [
        "- posts.author → id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)",
      ],
    ]);
  });

  it("escapes the target table name", () => {
    expect(
      renderRelations(postsSchema("my_users"), POSTS, LABELS),
    ).toContainEqual([
      "- author → my\\_users.id (One to many, ON DELETE CASCADE, ON UPDATE NO ACTION)",
    ]);
  });
});
