import { describe, expect, it } from "vitest";

import { utf8ByteLength } from "../model/name-limits.js";
import type { SchemaDocument } from "../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeIndex,
  makeTable,
} from "../testing/factories.js";
import { suggestIndexName } from "./suggest-index-name.js";

function buildSchemaWithIndexNames(
  indexNames: readonly string[],
): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_users" })],
    columns: [makeColumn({ id: "col_email", tableId: "tbl_users" })],
    indexes: indexNames.map((name, position) =>
      makeIndex({
        id: `idx_${String(position + 1)}`,
        tableId: "tbl_users",
        columnIds: ["col_email"],
        name,
      }),
    ),
  });
}

describe("suggestIndexName", () => {
  it("joins the table and column names with an idx suffix", () => {
    const schema = buildSchema({});

    const suggestion = suggestIndexName(schema, {
      tableName: "orders",
      columnNames: ["customer_id", "created_at"],
      isUnique: false,
    });

    expect(suggestion).toBe("orders_customer_id_created_at_idx");
  });

  it("uses a key suffix for a unique index", () => {
    const schema = buildSchema({});

    const suggestion = suggestIndexName(schema, {
      tableName: "users",
      columnNames: ["email"],
      isUnique: true,
    });

    expect(suggestion).toBe("users_email_key");
  });

  it("appends 2 when the first candidate is already used", () => {
    const schema = buildSchemaWithIndexNames(["users_email_idx"]);

    const suggestion = suggestIndexName(schema, {
      tableName: "users",
      columnNames: ["email"],
      isUnique: false,
    });

    expect(suggestion).toBe("users_email_idx2");
  });

  it("skips every candidate that is already used", () => {
    const schema = buildSchemaWithIndexNames([
      "users_email_idx",
      "users_email_idx2",
      "users_email_idx3",
    ]);

    const suggestion = suggestIndexName(schema, {
      tableName: "users",
      columnNames: ["email"],
      isUnique: false,
    });

    expect(suggestion).toBe("users_email_idx4");
  });

  it("compares existing index names without regard to case", () => {
    const schema = buildSchemaWithIndexNames(["USERS_EMAIL_IDX"]);

    const suggestion = suggestIndexName(schema, {
      tableName: "users",
      columnNames: ["email"],
      isUnique: false,
    });

    expect(suggestion).toBe("users_email_idx2");
  });

  it("keeps the suggestion within 63 UTF-8 bytes", () => {
    const schema = buildSchema({});

    const suggestion = suggestIndexName(schema, {
      tableName: "a".repeat(40),
      columnNames: ["b".repeat(40)],
      isUnique: false,
    });

    expect(utf8ByteLength(suggestion)).toBe(63);
    expect(suggestion).toBe(`${"a".repeat(40)}_${"b".repeat(18)}_idx`);
  });

  it("does not split a multi-byte character when truncating", () => {
    const schema = buildSchema({});

    // 56 bytes of "a" leave room for 3 more stem bytes: enough for half of the
    // 4-byte emoji's surrogate pair but not for the whole character.
    const suggestion = suggestIndexName(schema, {
      tableName: `${"a".repeat(56)}\u{1F600}`,
      columnNames: ["id"],
      isUnique: false,
    });

    expect(suggestion).toBe(`${"a".repeat(56)}_idx`);
  });

  it("keeps the numeric suffix when truncating", () => {
    const longTableName = "a".repeat(40);
    const longColumnName = "b".repeat(40);
    const schema = buildSchemaWithIndexNames([
      `${longTableName}_${"b".repeat(18)}_idx`,
    ]);

    const suggestion = suggestIndexName(schema, {
      tableName: longTableName,
      columnNames: [longColumnName],
      isUnique: false,
    });

    expect(suggestion).toBe(`${longTableName}_${"b".repeat(17)}_idx2`);
  });
});
