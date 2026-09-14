import { describe, expect, it } from "vitest";

import { err, ok } from "../result.js";
import { unwrapError, unwrapOk } from "./unwrap-result.js";

describe("unwrapOk", () => {
  it("returns the value of an ok result", () => {
    expect(unwrapOk(ok("tbl_1"))).toBe("tbl_1");
  });

  it("throws when unwrapping the value of an error result", () => {
    expect(() => unwrapOk(err({ code: "table-not-found" }))).toThrow(
      /table-not-found/,
    );
  });
});

describe("unwrapError", () => {
  it("returns the error of an error result", () => {
    expect(unwrapError(err("enum-in-use"))).toBe("enum-in-use");
  });

  it("throws when unwrapping the error of an ok result", () => {
    expect(() => unwrapError(ok({ id: "tbl_1" }))).toThrow(/tbl_1/);
  });
});
