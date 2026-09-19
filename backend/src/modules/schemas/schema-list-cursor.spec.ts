import { describe, expect, it } from "vitest";

import {
  decodeSchemaListCursor,
  encodeSchemaListCursor,
} from "./schema-list-cursor.js";

const UPDATED_AT = new Date("2026-09-18T10:00:00.000Z");
const SCHEMA_ID = "0190f3a0-0000-7000-8000-000000000001";

function encodePayload(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

describe("schema list cursor", () => {
  it("round-trips a cursor", () => {
    const decoded = decodeSchemaListCursor(
      encodeSchemaListCursor({ updatedAt: UPDATED_AT, id: SCHEMA_ID }),
    );

    expect(decoded).toEqual({
      isOk: true,
      value: { updatedAt: UPDATED_AT, id: SCHEMA_ID },
    });
  });

  it("produces a base64url string without padding", () => {
    const encoded = encodeSchemaListCursor({
      updatedAt: UPDATED_AT,
      id: SCHEMA_ID,
    });

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects a cursor that is not valid json", () => {
    const decoded = decodeSchemaListCursor(
      Buffer.from("not json", "utf8").toString("base64url"),
    );

    expect(decoded).toEqual({ isOk: false, error: "invalid-cursor" });
  });

  it.each([
    [
      "an extra field",
      {
        updatedAt: UPDATED_AT.toISOString(),
        id: SCHEMA_ID,
        ownerId: SCHEMA_ID,
      },
    ],
    ["a missing id", { updatedAt: UPDATED_AT.toISOString() }],
    ["a missing updatedAt", { id: SCHEMA_ID }],
  ])("rejects a cursor with %s", (_name, payload) => {
    const decoded = decodeSchemaListCursor(encodePayload(payload));

    expect(decoded).toEqual({ isOk: false, error: "invalid-cursor" });
  });

  it.each([
    ["an invalid date", { updatedAt: "yesterday", id: SCHEMA_ID }],
    [
      "an id that is not a uuid",
      { updatedAt: UPDATED_AT.toISOString(), id: "not-a-uuid" },
    ],
  ])("rejects a cursor with %s", (_name, payload) => {
    const decoded = decodeSchemaListCursor(encodePayload(payload));

    expect(decoded).toEqual({ isOk: false, error: "invalid-cursor" });
  });
});
