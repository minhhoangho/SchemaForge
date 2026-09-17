import { describe, expect, it } from "vitest";

import {
  schemaDetailSchema,
  schemaListSchema,
  schemaSummarySchema,
} from "./schemas.js";

const SUMMARY = {
  id: "5f0e8a0c-1b2d-4c3e-8f4a-5b6c7d8e9f00",
  name: "Shop",
  revision: 3,
  createdAt: "2026-09-15T08:00:00.000Z",
  updatedAt: "2026-09-17T10:18:00.000Z",
};

describe("schemaSummarySchema", () => {
  it("parses a schema summary", () => {
    const result = schemaSummarySchema.safeParse(SUMMARY);

    expect(result.data).toStrictEqual(SUMMARY);
  });

  it("rejects a summary with revision zero", () => {
    const result = schemaSummarySchema.safeParse({ ...SUMMARY, revision: 0 });

    expect(result.success).toBe(false);
  });
});

describe("schemaDetailSchema", () => {
  it("keeps the document of a schema detail untouched", () => {
    // The contract treats the document as opaque, so any object will do.
    const document = { tables: { tbl_1: { name: "orders" } } };

    const result = schemaDetailSchema.safeParse({ ...SUMMARY, document });

    expect(result.data?.document).toBe(document);
  });

  it("rejects a schema detail without a document", () => {
    const result = schemaDetailSchema.safeParse(SUMMARY);

    expect(result.success).toBe(false);
  });
});

describe("schemaListSchema", () => {
  it("parses a list whose nextCursor is null", () => {
    const list = { items: [SUMMARY], nextCursor: null };

    const result = schemaListSchema.safeParse(list);

    expect(result.data).toStrictEqual(list);
  });

  it("rejects a list without items", () => {
    const result = schemaListSchema.safeParse({ nextCursor: "abc" });

    expect(result.success).toBe(false);
  });
});
