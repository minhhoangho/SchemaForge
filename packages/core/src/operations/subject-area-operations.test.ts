import { describe, expect, it } from "vitest";

import {
  buildSchema,
  makeSubjectArea,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import type { Operation, SubjectAreaOperation } from "./operation.js";
import { applySubjectAreaOperation } from "./subject-area-operations.js";

describe("applySubjectAreaOperation with addSubjectArea", () => {
  it("adds a subject area", () => {
    const schema = buildSchema({});
    const sales = makeSubjectArea({ id: "area_sales" });

    const result = unwrapOk(
      applySubjectAreaOperation(schema, {
        type: "addSubjectArea",
        subjectArea: sales,
      }),
    );

    expect(result.schema).toStrictEqual(buildSchema({ subjectAreas: [sales] }));
  });

  it("returns removeSubjectArea as the inverse of addSubjectArea", () => {
    const schema = buildSchema({});
    const expectedInverse: SubjectAreaOperation = {
      type: "removeSubjectArea",
      subjectAreaId: "area_sales",
    };

    const result = unwrapOk(
      applySubjectAreaOperation(schema, {
        type: "addSubjectArea",
        subjectArea: makeSubjectArea({ id: "area_sales" }),
      }),
    );

    expect(result.inverse).toStrictEqual(expectedInverse);
    expect(
      unwrapOk(applySubjectAreaOperation(result.schema, expectedInverse))
        .schema,
    ).toStrictEqual(schema);
  });

  it("rejects addSubjectArea with id-already-exists", () => {
    const schema = buildSchema({
      subjectAreas: [makeSubjectArea({ id: "area_sales" })],
    });

    const error = unwrapError(
      applySubjectAreaOperation(schema, {
        type: "addSubjectArea",
        subjectArea: makeSubjectArea({ id: "area_sales", name: "other" }),
      }),
    );

    expect(error).toStrictEqual({
      code: "id-already-exists",
      path: ["subjectArea", "id"],
    });
  });
});

describe("applySubjectAreaOperation with updateSubjectArea", () => {
  it("renames a subject area and returns the previous name as the inverse", () => {
    const sales = makeSubjectArea({ id: "area_sales", name: "sales" });
    const schema = buildSchema({ subjectAreas: [sales] });
    const expectedInverse: SubjectAreaOperation = {
      type: "updateSubjectArea",
      subjectAreaId: "area_sales",
      changes: { name: "sales" },
    };

    const result = unwrapOk(
      applySubjectAreaOperation(schema, {
        type: "updateSubjectArea",
        subjectAreaId: "area_sales",
        changes: { name: "billing" },
      }),
    );

    expect(result.schema).toStrictEqual(
      buildSchema({ subjectAreas: [{ ...sales, name: "billing" }] }),
    );
    expect(result.inverse).toStrictEqual(expectedInverse);
    expect(
      unwrapOk(applySubjectAreaOperation(result.schema, expectedInverse))
        .schema,
    ).toStrictEqual(schema);
  });

  it("rejects updateSubjectArea with subject-area-not-found", () => {
    const schema = buildSchema({});

    const error = unwrapError(
      applySubjectAreaOperation(schema, {
        type: "updateSubjectArea",
        subjectAreaId: "area_missing",
        changes: { name: "billing" },
      }),
    );

    expect(error).toStrictEqual({
      code: "subject-area-not-found",
      path: ["subjectAreaId"],
    });
  });

  it("returns the same schema reference when updateSubjectArea keeps the name", () => {
    const schema = buildSchema({
      subjectAreas: [makeSubjectArea({ id: "area_sales", name: "sales" })],
    });

    const result = unwrapOk(
      applySubjectAreaOperation(schema, {
        type: "updateSubjectArea",
        subjectAreaId: "area_sales",
        changes: { name: "sales" },
      }),
    );

    expect(result.schema).toBe(schema);
  });
});

describe("applySubjectAreaOperation with removeSubjectArea", () => {
  it("removes a subject area and clears subjectAreaId of its member tables", () => {
    const sales = makeSubjectArea({ id: "area_sales" });
    const orders = makeTable({ id: "tbl_orders", subjectAreaId: "area_sales" });
    const users = makeTable({ id: "tbl_users" });
    const schema = buildSchema({
      tables: [orders, users],
      subjectAreas: [sales],
    });

    const result = unwrapOk(
      applySubjectAreaOperation(schema, {
        type: "removeSubjectArea",
        subjectAreaId: "area_sales",
      }),
    );

    expect(result.schema).toStrictEqual(
      buildSchema({ tables: [{ ...orders, subjectAreaId: null }, users] }),
    );
  });

  it("keeps tables outside the removed subject area by reference", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders", subjectAreaId: "area_sales" }),
        makeTable({ id: "tbl_users" }),
      ],
      subjectAreas: [makeSubjectArea({ id: "area_sales" })],
    });

    const result = unwrapOk(
      applySubjectAreaOperation(schema, {
        type: "removeSubjectArea",
        subjectAreaId: "area_sales",
      }),
    );

    expect(result.schema.tables.tbl_users).toBe(schema.tables.tbl_users);
  });

  it("returns a batch inverse that re-adds the subject area and restores each member table ordered by id", () => {
    const sales = makeSubjectArea({ id: "area_sales" });
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_orders", subjectAreaId: "area_sales" }),
        makeTable({ id: "tbl_users" }),
        makeTable({ id: "tbl_invoices", subjectAreaId: "area_sales" }),
      ],
      subjectAreas: [sales],
    });
    const expectedInverse: Operation = {
      type: "batch",
      operations: [
        { type: "addSubjectArea", subjectArea: sales },
        {
          type: "updateTable",
          tableId: "tbl_invoices",
          changes: { subjectAreaId: "area_sales" },
        },
        {
          type: "updateTable",
          tableId: "tbl_orders",
          changes: { subjectAreaId: "area_sales" },
        },
      ],
    };

    const result = unwrapOk(
      applySubjectAreaOperation(schema, {
        type: "removeSubjectArea",
        subjectAreaId: "area_sales",
      }),
    );

    expect(result.inverse).toStrictEqual(expectedInverse);
  });

  it("returns a batch inverse with only addSubjectArea when the area has no members", () => {
    const sales = makeSubjectArea({ id: "area_sales" });
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      subjectAreas: [sales],
    });
    const expectedInverse: Operation = {
      type: "batch",
      operations: [{ type: "addSubjectArea", subjectArea: sales }],
    };

    const result = unwrapOk(
      applySubjectAreaOperation(schema, {
        type: "removeSubjectArea",
        subjectAreaId: "area_sales",
      }),
    );

    expect(result.inverse).toStrictEqual(expectedInverse);
  });

  it("keeps the tables map by reference when the area has no members", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      subjectAreas: [makeSubjectArea({ id: "area_sales" })],
    });

    const result = unwrapOk(
      applySubjectAreaOperation(schema, {
        type: "removeSubjectArea",
        subjectAreaId: "area_sales",
      }),
    );

    expect(result.schema.tables).toBe(schema.tables);
  });

  it("rejects removeSubjectArea with subject-area-not-found", () => {
    const schema = buildSchema({});

    const error = unwrapError(
      applySubjectAreaOperation(schema, {
        type: "removeSubjectArea",
        subjectAreaId: "area_missing",
      }),
    );

    expect(error).toStrictEqual({
      code: "subject-area-not-found",
      path: ["subjectAreaId"],
    });
  });
});
