import type { SchemaDocument } from "@schemaforge/core";
import { buildSchema, makeTable } from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { toSchemaDetail, toSchemaSummary } from "./schemas.mapper.js";
import type { SchemaSummaryRecord } from "./schemas.repository.js";

const SCHEMA_ID = "0190f3a0-0000-7000-8000-000000000001";
const OWNER_ID = "0190f3a0-0000-7000-8000-0000000000ff";
const CREATED_AT = new Date("2026-09-18T10:00:00.000Z");
const UPDATED_AT = new Date("2026-09-18T11:30:00.000Z");

const RECORD = {
  id: SCHEMA_ID,
  name: "orders",
  revision: 3,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

describe("schemas mapper", () => {
  it("maps a summary with ISO 8601 timestamps", () => {
    expect(toSchemaSummary(RECORD)).toEqual({
      id: SCHEMA_ID,
      name: "orders",
      revision: 3,
      createdAt: "2026-09-18T10:00:00.000Z",
      updatedAt: "2026-09-18T11:30:00.000Z",
    });
  });

  it("returns no ownerId or document in a summary even when the record has them", () => {
    const record: SchemaSummaryRecord & {
      readonly ownerId: string;
      readonly document: SchemaDocument;
    } = {
      ...RECORD,
      ownerId: OWNER_ID,
      document: buildSchema({ name: "orders" }),
    };

    const summary = toSchemaSummary(record);

    expect(Object.keys(summary).toSorted()).toEqual([
      "createdAt",
      "id",
      "name",
      "revision",
      "updatedAt",
    ]);
  });

  it("adds the parsed document to a detail", () => {
    const document = buildSchema({
      name: "orders",
      tables: [makeTable({ id: "tbl_orders" })],
    });

    expect(toSchemaDetail(RECORD, document)).toEqual({
      ...toSchemaSummary(RECORD),
      document,
    });
  });
});
