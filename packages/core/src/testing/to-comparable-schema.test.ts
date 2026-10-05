import { describe, expect, it } from "vitest";

import type { ColumnType } from "../model/column-type.js";
import type {
  ColumnId,
  EnumId,
  IndexId,
  NoteId,
  RelationId,
  SubjectAreaId,
  TableId,
} from "../model/ids.js";
import type { Position } from "../model/position.js";
import type { SchemaDocument } from "../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeNote,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "./factories.js";
import { toComparableSchema } from "./to-comparable-schema.js";

type BlogIds = {
  readonly users: TableId;
  readonly posts: TableId;
  readonly userId: ColumnId;
  readonly userStatus: ColumnId;
  readonly postId: ColumnId;
  readonly postAuthorId: ColumnId;
  readonly status: EnumId;
  readonly area: SubjectAreaId;
  readonly authorIndex: IndexId;
  readonly author: RelationId;
  readonly note: NoteId;
};

type BlogOptions = {
  readonly ids: BlogIds;
  readonly position: Position;
  readonly authorIdType: ColumnType;
};

const FIRST_IDS: BlogIds = {
  users: "tbl_users",
  posts: "tbl_posts",
  userId: "col_user_id",
  userStatus: "col_user_status",
  postId: "col_post_id",
  postAuthorId: "col_post_author",
  status: "enum_status",
  area: "area_blog",
  authorIndex: "idx_author",
  author: "rel_author",
  note: "note_readme",
};

// Ids whose code unit order is the reverse of FIRST_IDS for every pair.
const SECOND_IDS: BlogIds = {
  users: "tbl_1",
  posts: "tbl_9",
  userId: "col_z",
  userStatus: "col_y",
  postId: "col_b",
  postAuthorId: "col_a",
  status: "enum_q",
  area: "area_q",
  authorIndex: "idx_q",
  author: "rel_q",
  note: "note_q",
};

const ORIGIN: Position = { x: 0, y: 0 };

const DEFAULT_OPTIONS: BlogOptions = {
  ids: FIRST_IDS,
  position: { x: 120, y: -40 },
  authorIdType: { kind: "integer" },
};

function buildBlogSchema(overrides: Partial<BlogOptions>): SchemaDocument {
  const { ids, position, authorIdType } = { ...DEFAULT_OPTIONS, ...overrides };
  return buildSchema({
    tables: [
      makeTable({
        id: ids.users,
        name: "users",
        position,
        subjectAreaId: ids.area,
        primaryKeyColumnIds: [ids.userId],
      }),
      makeTable({
        id: ids.posts,
        name: "posts",
        position,
        primaryKeyColumnIds: [ids.postId],
      }),
    ],
    columns: [
      makeColumn({ id: ids.userId, tableId: ids.users, name: "id" }),
      makeColumn({
        id: ids.userStatus,
        tableId: ids.users,
        name: "status",
        type: { kind: "enum", enumId: ids.status },
      }),
      makeColumn({ id: ids.postId, tableId: ids.posts, name: "id" }),
      makeColumn({
        id: ids.postAuthorId,
        tableId: ids.posts,
        name: "author_id",
        type: authorIdType,
      }),
    ],
    relations: [
      makeRelation({
        id: ids.author,
        fromTableId: ids.posts,
        toTableId: ids.users,
        columnPairs: [
          { fromColumnId: ids.postAuthorId, toColumnId: ids.userId },
        ],
      }),
    ],
    indexes: [
      makeIndex({
        id: ids.authorIndex,
        tableId: ids.posts,
        name: "posts_author_id",
        columnIds: [ids.postAuthorId],
      }),
    ],
    enums: [makeEnum({ id: ids.status, name: "user_status" })],
    subjectAreas: [makeSubjectArea({ id: ids.area, name: "accounts" })],
    notes: [makeNote({ id: ids.note, text: "Blog tables", position })],
  });
}

describe("toComparableSchema", () => {
  it("gives equal results for the same schema with different ids", () => {
    expect(
      toComparableSchema(buildBlogSchema({ ids: SECOND_IDS })),
    ).toStrictEqual(toComparableSchema(buildBlogSchema({})));
  });

  it("sets every position to the origin", () => {
    const comparable = toComparableSchema(buildBlogSchema({}));

    expect([
      ...Object.values(comparable.tables).map((table) => table.position),
      ...Object.values(comparable.notes).map((note) => note.position),
    ]).toStrictEqual([ORIGIN, ORIGIN, ORIGIN]);
  });

  // Tables first (posts before users by name), then their columns in
  // columnIds order, enums, subject areas, indexes, relations and notes.
  it("rewrites every id reference consistently", () => {
    expect(
      toComparableSchema(buildBlogSchema({ ids: SECOND_IDS })),
    ).toStrictEqual(
      buildBlogSchema({
        position: ORIGIN,
        ids: {
          posts: "tbl_1",
          users: "tbl_2",
          postId: "col_3",
          postAuthorId: "col_4",
          userId: "col_5",
          userStatus: "col_6",
          status: "enum_7",
          area: "area_8",
          authorIndex: "idx_9",
          author: "rel_10",
          note: "note_11",
        },
      }),
    );
  });

  it("gives different results when a column type differs", () => {
    expect(
      toComparableSchema(buildBlogSchema({ authorIdType: { kind: "bigint" } })),
    ).not.toStrictEqual(toComparableSchema(buildBlogSchema({})));
  });
});
