import { describe, expect, it } from "vitest";

import { enumShape } from "./enum.js";

const ENUM = { id: "enum_1", name: "post_status", values: [] };

describe("enumShape", () => {
  it("accepts an enum with no values", () => {
    expect(enumShape.safeParse(ENUM).data).toStrictEqual(ENUM);
  });

  it("rejects a non-string value", () => {
    expect(enumShape.safeParse({ ...ENUM, values: ["draft", 1] }).success).toBe(
      false,
    );
  });
});
