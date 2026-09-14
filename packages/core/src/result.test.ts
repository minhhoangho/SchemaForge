import { describe, expect, it } from "vitest";

import { err, ok } from "./result.js";

describe("Result", () => {
  it("ok wraps a value with isOk set to true", () => {
    expect(ok(42)).toStrictEqual({ isOk: true, value: 42 });
  });

  it("err wraps an error with isOk set to false", () => {
    expect(err("table-not-found")).toStrictEqual({
      isOk: false,
      error: "table-not-found",
    });
  });
});
