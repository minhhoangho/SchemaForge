import type { DocumentPath, SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { resolveIssueTarget } from "./resolve-issue-target";
import type { IssueElementKind } from "./resolve-issue-target";

function createDocument(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({ id: "tbl_users", name: "users" }),
      makeTable({ id: "tbl_posts", name: "posts" }),
    ],
    columns: [
      makeColumn({
        id: "col_id",
        tableId: "tbl_users",
        name: "id",
        isUnique: true,
      }),
      makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
      makeColumn({ id: "col_user_id", tableId: "tbl_posts", name: "user_id" }),
    ],
    relations: [
      makeRelation({
        id: "rel_author",
        fromTableId: "tbl_posts",
        toTableId: "tbl_users",
        columnPairs: [{ fromColumnId: "col_user_id", toColumnId: "col_id" }],
      }),
    ],
    indexes: [
      makeIndex({
        id: "idx_email",
        tableId: "tbl_users",
        name: "email_idx",
        columnIds: ["col_email"],
      }),
    ],
    enums: [
      makeEnum({
        id: "enum_status",
        name: "status",
        values: ["active", "archived"],
      }),
    ],
    subjectAreas: [makeSubjectArea({ id: "area_core", name: "core" })],
  });
}

describe("resolveIssueTarget", () => {
  it.each<readonly [string, IssueElementKind, DocumentPath]>([
    ["tables", "table", ["tables", "tbl_users", "name"]],
    ["columns", "column", ["columns", "col_email", "name"]],
    ["relations", "relation", ["relations", "rel_author", "columnPairs"]],
    ["indexes", "index", ["indexes", "idx_email", "name"]],
    ["enums", "enum", ["enums", "enum_status", "name"]],
    ["subjectAreas", "subjectArea", ["subjectAreas", "area_core", "name"]],
    ["name", "schema", ["name"]],
  ])("resolves %s to the %s element", (_prefix, kind, path) => {
    expect(resolveIssueTarget(createDocument(), path).kind).toBe(kind);
  });

  it("reads the owning table of a column", () => {
    expect(
      resolveIssueTarget(createDocument(), ["columns", "col_email", "name"]),
    ).toEqual({
      kind: "column",
      elementId: "col_email",
      tableId: "tbl_users",
      values: { column: "email", table: "users" },
    });
  });

  it("reads the owning table of an index", () => {
    expect(
      resolveIssueTarget(createDocument(), ["indexes", "idx_email", "name"]),
    ).toEqual({
      kind: "index",
      elementId: "idx_email",
      tableId: "tbl_users",
      values: { index: "email_idx", table: "users" },
    });
  });

  it("names the foreign key column of a relation", () => {
    expect(
      resolveIssueTarget(createDocument(), [
        "relations",
        "rel_author",
        "columnPairs",
        0,
        "fromColumnId",
      ]),
    ).toEqual({
      kind: "relation",
      elementId: "rel_author",
      tableId: "tbl_posts",
      values: { column: "user_id", table: "posts" },
    });
  });

  it("reads an enum value by index", () => {
    expect(
      resolveIssueTarget(createDocument(), [
        "enums",
        "enum_status",
        "values",
        1,
      ]),
    ).toEqual({
      kind: "enum",
      elementId: "enum_status",
      tableId: null,
      values: { enum: "status", value: "archived" },
    });
  });

  it("resolves a subject area without interpolation values", () => {
    expect(
      resolveIssueTarget(createDocument(), [
        "subjectAreas",
        "area_core",
        "name",
      ]),
    ).toEqual({
      kind: "subjectArea",
      elementId: "area_core",
      tableId: null,
      values: {},
    });
  });

  it("returns an empty target for an unknown path prefix", () => {
    expect(
      resolveIssueTarget(createDocument(), ["notes", "note_1", "text"]),
    ).toEqual({ kind: "schema", elementId: null, tableId: null, values: {} });
  });

  it("returns no values for an element that no longer exists", () => {
    expect(
      resolveIssueTarget(createDocument(), ["tables", "tbl_gone", "name"]),
    ).toEqual({
      kind: "table",
      elementId: "tbl_gone",
      tableId: null,
      values: {},
    });
  });

  it.each<readonly [IssueElementKind, string, DocumentPath]>([
    ["column", "col_gone", ["columns", "col_gone", "name"]],
    ["relation", "rel_gone", ["relations", "rel_gone", "columnPairs"]],
    ["index", "idx_gone", ["indexes", "idx_gone", "name"]],
    ["enum", "enum_gone", ["enums", "enum_gone", "values"]],
  ])(
    "returns no values for a %s that no longer exists",
    (kind, elementId, path) => {
      expect(resolveIssueTarget(createDocument(), path)).toEqual({
        kind,
        elementId,
        tableId: null,
        values: {},
      });
    },
  );

  it("returns no element id when the path carries no string id", () => {
    expect(resolveIssueTarget(createDocument(), ["columns", 0])).toEqual({
      kind: "column",
      elementId: null,
      tableId: null,
      values: {},
    });
  });

  it("returns no enum value for an index outside the value list", () => {
    expect(
      resolveIssueTarget(createDocument(), [
        "enums",
        "enum_status",
        "values",
        9,
      ]),
    ).toEqual({
      kind: "enum",
      elementId: "enum_status",
      tableId: null,
      values: { enum: "status" },
    });
  });
});
