import { describe, expect, it } from "vitest";

import { buildSchema, makeColumn, makeTable } from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import {
  type AiFindingsInput,
  reportFindingsInputShape,
} from "./ai-edit-tools.js";
import { buildAiFindings } from "./build-ai-findings.js";

type FindingInput = AiFindingsInput["findings"][number];

const SCHEMA = buildSchema({
  tables: [
    makeTable({ id: "tbl_users" }),
    makeTable({ id: "tbl_orders" }),
    makeTable({ id: "tbl_proto", name: "__proto__" }),
  ],
  columns: [
    makeColumn({ id: "col_user_id", tableId: "tbl_users", name: "id" }),
    makeColumn({ id: "col_user_email", tableId: "tbl_users", name: "email" }),
    makeColumn({
      id: "col_order_user_id",
      tableId: "tbl_orders",
      name: "user_id",
    }),
    makeColumn({
      id: "col_proto_proto",
      tableId: "tbl_proto",
      name: "__proto__",
    }),
  ],
});

function finding(overrides: Partial<FindingInput>): FindingInput {
  return {
    kind: "suggestion",
    category: "index",
    title: "Add an index",
    detail: "Lookups by email are frequent.",
    ...overrides,
  };
}

describe("buildAiFindings", () => {
  it("targets a table and its named columns", () => {
    const input = {
      findings: [finding({ table: "users", columns: ["email", "id"] })],
    };

    expect(unwrapOk(buildAiFindings(SCHEMA, input))).toStrictEqual([
      {
        kind: "suggestion",
        category: "index",
        title: "Add an index",
        detail: "Lookups by email are frequent.",
        targets: [
          { tableId: "tbl_users", columnId: "col_user_email" },
          { tableId: "tbl_users", columnId: "col_user_id" },
        ],
      },
    ]);
  });

  it("targets only the table when no columns are named", () => {
    const input = {
      findings: [
        finding({ kind: "issue", category: "naming", table: "Users" }),
      ],
    };

    expect(unwrapOk(buildAiFindings(SCHEMA, input))).toStrictEqual([
      {
        kind: "issue",
        category: "naming",
        title: "Add an index",
        detail: "Lookups by email are frequent.",
        targets: [{ tableId: "tbl_users", columnId: null }],
      },
    ]);
  });

  it("targets nothing when no table is named", () => {
    const input = { findings: [finding({ category: "other" })] };

    expect(unwrapOk(buildAiFindings(SCHEMA, input))).toStrictEqual([
      {
        kind: "suggestion",
        category: "other",
        title: "Add an index",
        detail: "Lookups by email are frequent.",
        targets: [],
      },
    ]);
  });

  it("returns table-name-not-found with the requested name", () => {
    const input = {
      findings: [finding({ table: "users" }), finding({ table: "user list" })],
    };

    expect(unwrapError(buildAiFindings(SCHEMA, input))).toStrictEqual([
      {
        code: "table-name-not-found",
        path: ["findings", 1, "table"],
        at: 'findings.1.tables."user list"',
      },
    ]);
  });

  it("returns column-name-not-found for a column outside the table", () => {
    const input = {
      findings: [finding({ table: "orders", columns: ["user_id", "email"] })],
    };

    expect(unwrapError(buildAiFindings(SCHEMA, input))).toStrictEqual([
      {
        code: "column-name-not-found",
        path: ["findings", 0, "columns", 1],
        at: "findings.0.tables.orders.columns.email",
      },
    ]);
  });

  it("rejects columns without a table", () => {
    const input = { findings: [finding({ columns: ["email"] })] };

    expect(unwrapError(buildAiFindings(SCHEMA, input))).toStrictEqual([
      {
        code: "table-name-not-found",
        path: ["findings", 0],
        at: "findings.0",
      },
    ]);
  });

  it("collects the errors of every finding in input order", () => {
    const input = {
      findings: [
        finding({ table: "users", columns: ["emial", "nmae"] }),
        finding({ table: "payments", columns: ["id"] }),
      ],
    };

    expect(unwrapError(buildAiFindings(SCHEMA, input))).toStrictEqual([
      {
        code: "column-name-not-found",
        path: ["findings", 0, "columns", 0],
        at: "findings.0.tables.users.columns.emial",
      },
      {
        code: "column-name-not-found",
        path: ["findings", 0, "columns", 1],
        at: "findings.0.tables.users.columns.nmae",
      },
      {
        code: "table-name-not-found",
        path: ["findings", 1, "table"],
        at: "findings.1.tables.payments",
      },
    ]);
  });

  it("finds a column named __proto__", () => {
    const input = reportFindingsInputShape.parse(
      JSON.parse(
        '{"findings":[{"kind":"issue","category":"naming","title":"Rename","detail":"","table":"__proto__","columns":["__proto__"]}]}',
      ),
    );

    expect(unwrapOk(buildAiFindings(SCHEMA, input))).toStrictEqual([
      {
        kind: "issue",
        category: "naming",
        title: "Rename",
        detail: "",
        targets: [{ tableId: "tbl_proto", columnId: "col_proto_proto" }],
      },
    ]);
  });

  it("returns column-name-not-found for toString when no column has that name", () => {
    const input = {
      findings: [finding({ table: "users", columns: ["toString"] })],
    };

    expect(unwrapError(buildAiFindings(SCHEMA, input))).toStrictEqual([
      {
        code: "column-name-not-found",
        path: ["findings", 0, "columns", 0],
        at: "findings.0.tables.users.columns.toString",
      },
    ]);
  });
});
