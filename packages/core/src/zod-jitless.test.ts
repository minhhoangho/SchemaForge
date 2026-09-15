import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { Operation } from "./operations/operation.js";

// Consumers under a strict CSP enable this once at startup; core never does.
// Zod reads the setting when a schema is created, not when it parses, and core
// creates its schemas on import. Static imports run before this line, so core
// modules are imported dynamically after it.
z.config({ jitless: true });

const [
  { CURRENT_SCHEMA_VERSION },
  { applyOperation },
  { parseSchemaDocument },
  { makeColumn, makeIndex, makeTable },
  { unwrapError, unwrapOk },
] = await Promise.all([
  import("./model/schema-document.js"),
  import("./operations/apply-operation.js"),
  import("./parse/parse-schema-document.js"),
  import("./testing/factories.js"),
  import("./testing/unwrap-result.js"),
]);

// Assembled from factories without parsing, so a test's only parse is the one
// it is about.
function makeDocumentInput() {
  return {
    version: CURRENT_SCHEMA_VERSION,
    name: "shop",
    tables: {
      tbl_users: {
        ...makeTable({
          id: "tbl_users",
          primaryKeyColumnIds: ["col_users_id"],
        }),
        columnIds: ["col_users_id", "col_users_email"],
      },
    },
    columns: {
      col_users_id: makeColumn({ id: "col_users_id", tableId: "tbl_users" }),
      col_users_email: makeColumn({
        id: "col_users_email",
        tableId: "tbl_users",
        type: { kind: "varchar", length: 255 },
      }),
    },
    relations: {},
    indexes: {
      idx_users_email: makeIndex({
        id: "idx_users_email",
        tableId: "tbl_users",
        columnIds: ["col_users_email"],
        isUnique: true,
      }),
    },
    enums: {},
    subjectAreas: {},
    notes: {},
  };
}

const RENAME_EMAIL_COLUMN: Operation = {
  type: "updateColumn",
  columnId: "col_users_email",
  changes: { name: "mail", isNullable: true },
};

describe("core under zod jitless mode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("enables jitless mode in this test file", () => {
    expect(z.config().jitless).toBe(true);
  });

  it("parses a valid schema document in jitless mode", () => {
    const input = makeDocumentInput();

    expect(unwrapOk(parseSchemaDocument(input))).toStrictEqual(input);
  });

  it("returns the same structural errors in jitless mode", () => {
    const input = makeDocumentInput();
    const brokenInput = {
      ...input,
      extraRoot: true,
      tables: {
        tbl_users: { ...input.tables.tbl_users, extra: true },
      },
      columns: {
        ...input.columns,
        col_users_id: {
          ...input.columns.col_users_id,
          type: { kind: "bogus" },
        },
      },
    };

    expect(unwrapError(parseSchemaDocument(brokenInput))).toStrictEqual([
      {
        code: "invalid-shape",
        path: ["columns", "col_users_id", "type", "kind"],
      },
      { code: "invalid-shape", path: ["extraRoot"] },
      { code: "invalid-shape", path: ["tables", "tbl_users", "extra"] },
    ]);
  });

  it("parses and applies an operation in jitless mode", () => {
    const input = makeDocumentInput();
    const schema = unwrapOk(parseSchemaDocument(input));

    const applied = unwrapOk(applyOperation(schema, RENAME_EMAIL_COLUMN));

    expect(applied.schema).toStrictEqual({
      ...input,
      columns: {
        ...input.columns,
        col_users_email: {
          ...input.columns.col_users_email,
          name: "mail",
          isNullable: true,
        },
      },
    });
  });

  it("records a Function construction on the spy", () => {
    const functionSpy = vi.spyOn(globalThis, "Function");
    // Zod constructs through an alias (`const F = Function; new F(...)`), so
    // this does the same to show the spy observes that form.
    const AliasedFunction = Function;

    new AliasedFunction("return 1");

    expect(functionSpy).toHaveBeenCalledWith("return 1");
  });

  it("does not construct Function while parsing in jitless mode", () => {
    const functionSpy = vi.spyOn(globalThis, "Function");

    const schema = unwrapOk(parseSchemaDocument(makeDocumentInput()));
    unwrapOk(applyOperation(schema, RENAME_EMAIL_COLUMN));

    expect(functionSpy).not.toHaveBeenCalled();
  });
});
