import { describe, expect, it } from "vitest";

import type { DocumentPath } from "../document-path.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeNote,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "../testing/factories.js";
import { createSampleSchema } from "../testing/sample-schema.js";
import { describePathForAi, formatAiName } from "./describe-path-for-ai.js";

const SCHEMA = buildSchema({
  tables: [
    makeTable({ id: "tbl_users" }),
    makeTable({ id: "tbl_orders" }),
    makeTable({ id: "tbl_items", name: "order items" }),
  ],
  columns: [
    makeColumn({ id: "col_user_id", tableId: "tbl_users", name: "id" }),
    makeColumn({ id: "col_email", tableId: "tbl_users", name: "email" }),
    makeColumn({
      id: "col_order_user_id",
      tableId: "tbl_orders",
      name: "user_id",
    }),
    makeColumn({
      id: "col_order_tenant",
      tableId: "tbl_orders",
      name: "tenant_id",
    }),
    makeColumn({ id: "col_item_dotted", tableId: "tbl_items", name: "a.b" }),
  ],
  relations: [
    makeRelation({
      id: "rel_orders_users",
      fromTableId: "tbl_orders",
      toTableId: "tbl_users",
      columnPairs: [
        { fromColumnId: "col_order_user_id", toColumnId: "col_user_id" },
        { fromColumnId: "col_order_tenant", toColumnId: "col_email" },
      ],
    }),
  ],
  indexes: [
    makeIndex({
      id: "idx_users_email_key",
      tableId: "tbl_users",
      columnIds: ["col_email"],
    }),
  ],
  enums: [makeEnum({ id: "enum_status" })],
  subjectAreas: [makeSubjectArea({ id: "area_sales", name: "Sales" })],
  notes: [makeNote({ id: "note_1" })],
});

describe("formatAiName", () => {
  it.each(["users", "user_id", "Order2", "_"])(
    "keeps the plain name %s as is",
    (name) => {
      expect(formatAiName(name)).toBe(name);
    },
  );

  it.each([
    ["a.b", '"a.b"'],
    ["order items", '"order items"'],
    ["", '""'],
    ['say "hi"', '"say \\"hi\\""'],
    ["người_dùng", '"người_dùng"'],
  ])("quotes the name %s as JSON", (name, formatted) => {
    expect(formatAiName(name)).toBe(formatted);
  });
});

describe("describePathForAi", () => {
  it("describes a column path by names", () => {
    expect(describePathForAi(SCHEMA, ["columns", "col_email", "name"])).toBe(
      "tables.users.columns.email.name",
    );
  });

  it("describes a relation path by source table and columns", () => {
    expect(
      describePathForAi(SCHEMA, [
        "relations",
        "rel_orders_users",
        "columnPairs",
        1,
      ]),
    ).toBe("relations.orders(user_id,tenant_id).columnPairs.1");
  });

  it.each<[DocumentPath, string]>([
    [["tables", "tbl_users"], "tables.users"],
    [
      ["tables", "tbl_users", "primaryKeyColumnIds", 0],
      "tables.users.primaryKeyColumnIds.0",
    ],
    [
      ["indexes", "idx_users_email_key", "columnIds", 0],
      "tables.users.indexes.users_email_key.columnIds.0",
    ],
    [["enums", "enum_status", "values", 1], "enums.status.values.1"],
    [["subjectAreas", "area_sales", "name"], "subjectAreas.Sales.name"],
    [["notes", "note_1", "text"], "notes.?.text"],
    [["name"], "name"],
    [["operations", 1, "columnId"], "operations.1.columnId"],
    [[], ""],
  ])("describes the path %j as %s", (path, description) => {
    expect(describePathForAi(SCHEMA, path)).toBe(description);
  });

  it("quotes a name with a dot or space", () => {
    expect(describePathForAi(SCHEMA, ["columns", "col_item_dotted"])).toBe(
      'tables."order items".columns."a.b"',
    );
  });

  it.each<[DocumentPath, string]>([
    [["tables", "tbl_missing", "name"], "tables.?.name"],
    [["columns", "col_missing"], "tables.?.columns.?"],
    [["indexes", "idx_missing"], "tables.?.indexes.?"],
    [["relations", "rel_missing"], "relations.?"],
    [["enums", "enum_missing"], "enums.?"],
    [["subjectAreas", "area_missing"], "subjectAreas.?"],
    [["tables", "constructor"], "tables.?"],
    [["enums", "__proto__"], "enums.?"],
  ])("writes ? for an unknown id in %j", (path, description) => {
    expect(describePathForAi(SCHEMA, path)).toBe(description);
  });
});

describe("describePathForAi on the sample schema", () => {
  const sample = createSampleSchema();
  const allIds = [
    ...Object.keys(sample.tables),
    ...Object.keys(sample.columns),
    ...Object.keys(sample.relations),
    ...Object.keys(sample.indexes),
    ...Object.keys(sample.enums),
    ...Object.keys(sample.subjectAreas),
    ...Object.keys(sample.notes),
  ];

  it.each<[DocumentPath]>([
    [["tables", Object.keys(sample.tables)[0] ?? "", "name"]],
    [["columns", Object.keys(sample.columns)[0] ?? "", "type"]],
    [["relations", Object.keys(sample.relations)[0] ?? "", "columnPairs", 0]],
    [["indexes", Object.keys(sample.indexes)[0] ?? "", "columnIds", 0]],
    [["enums", Object.keys(sample.enums)[0] ?? "", "values", 0]],
    [["subjectAreas", Object.keys(sample.subjectAreas)[0] ?? "", "name"]],
    [["notes", Object.keys(sample.notes)[0] ?? "", "text"]],
  ])("never includes an id in %j", (path) => {
    const description = describePathForAi(sample, path);

    expect(allIds.filter((id) => description.includes(id))).toStrictEqual([]);
  });

  it("describes every element of the sample schema by name", () => {
    expect(
      Object.keys(sample.columns)
        .map((id) => describePathForAi(sample, ["columns", id]))
        .filter((description) => description.includes("?")),
    ).toStrictEqual([]);
  });
});
