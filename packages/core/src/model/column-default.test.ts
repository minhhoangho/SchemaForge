import { describe, expect, it } from "vitest";

import { columnDefaultShape } from "./column-default.js";

describe("columnDefaultShape", () => {
  it("accepts a literal with a string value", () => {
    expect(
      columnDefaultShape.safeParse({ kind: "literal", value: "42" }).success,
    ).toBe(true);
  });

  it("rejects a literal with a numeric value", () => {
    expect(
      columnDefaultShape.safeParse({ kind: "literal", value: 42 }).success,
    ).toBe(false);
  });

  it("accepts the currentTimestamp and generateUuid expressions", () => {
    expect([
      columnDefaultShape.safeParse({ kind: "currentTimestamp" }).success,
      columnDefaultShape.safeParse({ kind: "generateUuid" }).success,
    ]).toStrictEqual([true, true]);
  });

  it("rejects an unknown expression kind", () => {
    expect(columnDefaultShape.safeParse({ kind: "nextval" }).success).toBe(
      false,
    );
  });
});
