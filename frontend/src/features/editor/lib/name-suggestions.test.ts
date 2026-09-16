import { createEmptySchema } from "@schemaforge/core";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import {
  suggestColumnName,
  suggestEnumName,
  suggestEnumValue,
  suggestJunctionTableName,
  suggestTableName,
} from "./name-suggestions";

const emptyDocument = createEmptySchema("test");

const busyDocument = buildSchema({
  tables: [
    makeTable({ id: "tbl_1", name: "table_1" }),
    makeTable({ id: "tbl_2", name: "users" }),
  ],
  columns: [
    makeColumn({ id: "col_1", tableId: "tbl_1", name: "id" }),
    makeColumn({ id: "col_2", tableId: "tbl_2", name: "column_1" }),
  ],
  enums: [makeEnum({ id: "enum_9", name: "status" })],
});

const suggestionCases = [
  ["table_1", "no names", (): string => suggestTableName(emptyDocument)],
  ["table_2", "table_1", (): string => suggestTableName(busyDocument)],
  [
    "column_1",
    "column names of another table only",
    (): string => suggestColumnName(busyDocument, "tbl_1"),
  ],
  [
    "enum_1",
    "an unrelated enum name",
    (): string => suggestEnumName(busyDocument),
  ],
  ["value_1", "no values", (): string => suggestEnumValue([])],
] as const;

describe("numbered name suggestions", () => {
  it.each(suggestionCases)(
    "suggests %s when %s are taken",
    (expected, _taken, suggest) => {
      expect(suggest()).toBe(expected);
    },
  );

  it("ignores case when a name is taken", () => {
    const document = buildSchema({
      tables: [makeTable({ id: "tbl_1", name: "TABLE_1" })],
    });

    expect(suggestTableName(document)).toBe("table_2");
  });
});

describe("suggestJunctionTableName", () => {
  it("suggests a junction table name from both table names", () => {
    const name = suggestJunctionTableName(emptyDocument, {
      leftTableName: "posts",
      rightTableName: "tags",
    });

    expect(name).toBe("posts_tags");
  });

  it("adds a numeric suffix when the junction name is taken", () => {
    const document = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "posts_tags" }),
        makeTable({ id: "tbl_2", name: "Posts_Tags_2" }),
      ],
    });

    const name = suggestJunctionTableName(document, {
      leftTableName: "posts",
      rightTableName: "tags",
    });

    expect(name).toBe("posts_tags_3");
  });
});
