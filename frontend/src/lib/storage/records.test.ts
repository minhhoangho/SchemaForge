import { describe, expect, it } from "vitest";

import { parseSchemaRecord, parseViewportRecord } from "./records";
import type { SchemaRecord, ViewportRecord } from "./records";

const SCHEMA_ID = "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4";

function createSchemaRecord(
  overrides: Partial<SchemaRecord> = {},
): SchemaRecord {
  return {
    id: SCHEMA_ID,
    name: "Shop",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_500_000,
    ...overrides,
  };
}

function createViewportRecord(
  overrides: Partial<ViewportRecord> = {},
): ViewportRecord {
  return { schemaId: SCHEMA_ID, x: -120.5, y: 40, zoom: 0.75, ...overrides };
}

describe("parseSchemaRecord", () => {
  it("parses a valid schema record", () => {
    const record = createSchemaRecord();

    expect(parseSchemaRecord(record)).toEqual(record);
  });

  it.each<[string, unknown]>([
    [
      "a missing name",
      { id: SCHEMA_ID, createdAt: 1_700_000_000_000, updatedAt: 1 },
    ],
    ["an id that is not a UUID", createSchemaRecord({ id: "schema-1" })],
    ["a negative updatedAt", createSchemaRecord({ updatedAt: -1 })],
    [
      "a createdAt that is not a number",
      { ...createSchemaRecord(), createdAt: "today" },
    ],
    ["a fractional updatedAt", createSchemaRecord({ updatedAt: 1.5 })],
  ])("returns null for a schema record with %s", (_description, value) => {
    expect(parseSchemaRecord(value)).toBeNull();
  });

  it("returns null for a value that is not an object", () => {
    expect(parseSchemaRecord("Shop")).toBeNull();
  });
});

describe("parseViewportRecord", () => {
  it("parses a valid viewport record", () => {
    const record = createViewportRecord();

    expect(parseViewportRecord(record)).toEqual(record);
  });

  it.each<[string, unknown]>([
    ["a zoom of 0", createViewportRecord({ zoom: 0 })],
    ["an x of NaN", createViewportRecord({ x: Number.NaN })],
    ["an infinite y", createViewportRecord({ y: Number.POSITIVE_INFINITY })],
    ["a missing schemaId", { x: 0, y: 0, zoom: 1 }],
  ])("returns null for a viewport record with %s", (_description, value) => {
    expect(parseViewportRecord(value)).toBeNull();
  });
});

describe("record parsing", () => {
  it("strips unknown keys from a parsed record", () => {
    const record = createSchemaRecord();

    expect(parseSchemaRecord({ ...record, document: {} })).toStrictEqual(
      record,
    );
  });
});
