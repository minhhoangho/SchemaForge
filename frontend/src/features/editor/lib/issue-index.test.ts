import type { SchemaDocument } from "@schemaforge/core";
import { validateSchema } from "@schemaforge/core";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeSubjectArea,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { getIssueIndex } from "./issue-index";

// An unnamed schema, an unnamed column, an unnamed index and an empty enum give
// one issue at the schema root and one on each kind of element.
function createDocument(): SchemaDocument {
  return buildSchema({
    name: "",
    tables: [
      makeTable({ id: "tbl_users", name: "users" }),
      makeTable({ id: "tbl_orders", name: "orders" }),
    ],
    columns: [makeColumn({ id: "col_email", tableId: "tbl_users", name: "" })],
    indexes: [
      makeIndex({
        id: "idx_email",
        tableId: "tbl_users",
        name: "",
        columnIds: ["col_email"],
      }),
    ],
    enums: [makeEnum({ id: "enum_status", name: "status", values: [] })],
    subjectAreas: [makeSubjectArea({ id: "area_core", name: "core" })],
  });
}

function createDocumentWithoutIssues(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [makeTable({ id: "tbl_users", name: "users" })],
    columns: [makeColumn({ id: "col_email", tableId: "tbl_users" })],
  });
}

describe("getIssueIndex", () => {
  it("returns the issues of validateSchema in the same order", () => {
    const document = createDocument();

    expect(getIssueIndex(document).issues).toEqual(validateSchema(document));
  });

  it("returns the same index object for the same document reference", () => {
    const document = createDocument();

    expect(getIssueIndex(document)).toBe(getIssueIndex(document));
  });

  it("returns a different index for a different document", () => {
    const withIssues = createDocument();
    const withoutIssues = createDocumentWithoutIssues();

    expect(getIssueIndex(withoutIssues)).not.toBe(getIssueIndex(withIssues));
    expect(getIssueIndex(withoutIssues).issues).toEqual([]);
  });

  it("groups issues by element id", () => {
    const index = getIssueIndex(createDocument());

    expect(index.issuesOfElement("col_email")).toEqual([
      { code: "name-empty", path: ["columns", "col_email", "name"] },
    ]);
  });

  it("counts the issues of an element", () => {
    const index = getIssueIndex(createDocument());

    expect(index.countOfElement("enum_status")).toBe(1);
  });

  it("counts column and index issues on their table", () => {
    const index = getIssueIndex(createDocument());

    expect(index.countOfTable("tbl_users")).toBe(2);
  });

  it("counts no issue on a table whose elements are all valid", () => {
    const index = getIssueIndex(createDocument());

    expect(index.countOfTable("tbl_orders")).toBe(0);
  });

  it("returns the same empty array for elements without issues", () => {
    const index = getIssueIndex(createDocument());

    expect(index.issuesOfElement("tbl_orders")).toBe(
      index.issuesOfElement("area_core"),
    );
  });

  it("separates schema-level issues from element issues", () => {
    const index = getIssueIndex(createDocument());

    expect(index.schemaIssues).toEqual([
      { code: "name-empty", path: ["name"] },
    ]);
  });
});
