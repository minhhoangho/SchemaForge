import { describe, expect, it } from "vitest";

import { buildSchema, makeEnum, makeTable } from "../testing/factories.js";

import { findIntroducedIssues } from "./find-introduced-issues.js";

describe("findIntroducedIssues", () => {
  it("returns an empty list when both schemas have the same issues", () => {
    const before = buildSchema({
      tables: [
        makeTable({ id: "tbl_a", name: "users" }),
        makeTable({ id: "tbl_b", name: "users" }),
      ],
    });
    const after = buildSchema({
      tables: [
        makeTable({ id: "tbl_a", name: "users", comment: "Customers" }),
        makeTable({ id: "tbl_b", name: "users", position: { x: 40, y: 80 } }),
      ],
    });

    expect(findIntroducedIssues(before, after)).toStrictEqual([]);
  });

  it("returns only the issue that appears after the change", () => {
    const before = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
    });
    const after = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      enums: [makeEnum({ id: "enum_status", values: [] })],
    });

    expect(findIntroducedIssues(before, after)).toStrictEqual([
      { code: "enum-values-empty", path: ["enums", "enum_status", "values"] },
    ]);
  });

  it("does not return an issue that already existed before", () => {
    const before = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: [] })],
    });
    const after = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "" })],
      enums: [makeEnum({ id: "enum_status", values: [] })],
    });

    expect(findIntroducedIssues(before, after)).toStrictEqual([
      { code: "name-empty", path: ["tables", "tbl_users", "name"] },
    ]);
  });

  it("treats the same code on a different path as a new issue", () => {
    const before = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: ["active", "active"] })],
    });
    const after = buildSchema({
      enums: [
        makeEnum({
          id: "enum_status",
          values: ["pending", "active", "active"],
        }),
      ],
    });

    expect(findIntroducedIssues(before, after)).toStrictEqual([
      {
        code: "enum-value-duplicate",
        path: ["enums", "enum_status", "values", 2],
      },
    ]);
  });

  it("does not return issues that were fixed", () => {
    const before = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: [] })],
    });
    const after = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: ["active"] })],
    });

    expect(findIntroducedIssues(before, after)).toStrictEqual([]);
  });
});
