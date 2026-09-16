import type { Relation, SchemaDocument, Table } from "@schemaforge/core";
import {
  buildSchema,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { createI18nInstance } from "@/lib/i18n/create-i18n-instance";
import { RESOURCES } from "@/lib/i18n/resources";
import type { Locale } from "@/lib/i18n/supported-locales";
import { SUPPORTED_LOCALES } from "@/lib/i18n/supported-locales";

import {
  buildAriaLabelConfig,
  describeRelation,
  describeTable,
} from "./aria-label-config";

function getCanvasTranslation(locale: Locale): TFunction<"canvas"> {
  return createI18nInstance(locale).getFixedT(locale, "canvas");
}

function createDocument(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        primaryKeyColumnIds: ["col_user_id"],
      }),
      makeTable({ id: "tbl_posts", name: "posts" }),
    ],
    columns: [
      makeColumn({ id: "col_user_id", tableId: "tbl_users", name: "id" }),
      makeColumn({ id: "col_user_email", tableId: "tbl_users", name: "email" }),
      makeColumn({
        id: "col_post_author",
        tableId: "tbl_posts",
        name: "author_id",
      }),
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
    ],
  });
}

function getUsersTable(document: SchemaDocument): Table {
  const table = document.tables.tbl_users;
  if (table === undefined) {
    throw new Error("The fixture has no users table.");
  }
  return table;
}

function getPostsRelation(document: SchemaDocument): Relation {
  const relation = document.relations.rel_posts_users;
  if (relation === undefined) {
    throw new Error("The fixture has no posts relation.");
  }
  return relation;
}

describe("buildAriaLabelConfig", () => {
  it.each(SUPPORTED_LOCALES)(
    "translates every aria label key in %s",
    (locale) => {
      const config = buildAriaLabelConfig(getCanvasTranslation(locale));
      const { canvas } = RESOURCES[locale];

      expect({
        nodeDefault: config["node.a11yDescription.default"],
        nodeKeyboard: config["node.a11yDescription.keyboardDisabled"],
        edge: config["edge.a11yDescription.default"],
        minimap: config["minimap.ariaLabel"],
        handle: config["handle.ariaLabel"],
      }).toEqual({
        nodeDefault: canvas.a11y.nodeKeyboardDisabled,
        nodeKeyboard: canvas.a11y.nodeDescription,
        edge: canvas.a11y.edgeDescription,
        minimap: canvas.minimap.label,
        handle: canvas.handle.label,
      });
    },
  );

  it("builds the live message from direction and position", () => {
    const config = buildAriaLabelConfig(getCanvasTranslation("vi"));

    expect(
      config["node.a11yDescription.ariaLiveMessage"]({
        direction: "left",
        x: 120,
        y: -40,
      }),
    ).toBe("Đã di chuyển sang trái, tới x 120, y -40");
  });
});

describe("describeTable", () => {
  it("names the table and counts its columns", () => {
    expect(
      describeTable(
        getUsersTable(createDocument()),
        getCanvasTranslation("en"),
      ),
    ).toBe("Table users, 2 columns");
  });
});

describe("describeRelation", () => {
  it("names both endpoints and the kind", () => {
    const document = createDocument();

    expect(
      describeRelation({
        relation: getPostsRelation(document),
        document,
        hasIssue: false,
        t: getCanvasTranslation("vi"),
      }),
    ).toBe("posts.author_id → users.id, một–nhiều");
  });

  it("counts the columns of a composite foreign key", () => {
    const document = createDocument();
    const relation = getPostsRelation(document);

    expect(
      describeRelation({
        relation: {
          ...relation,
          columnPairs: [
            ...relation.columnPairs,
            { fromColumnId: "col_post_author", toColumnId: "col_user_email" },
          ],
        },
        document,
        hasIssue: false,
        t: getCanvasTranslation("en"),
      }),
    ).toBe("posts.author_id → users.id, one-to-many, 2 columns");
  });

  it("mentions the issues of the relation", () => {
    const document = createDocument();

    expect(
      describeRelation({
        relation: getPostsRelation(document),
        document,
        hasIssue: true,
        t: getCanvasTranslation("en"),
      }),
    ).toBe("posts.author_id → users.id, one-to-many, has issues");
  });
});
