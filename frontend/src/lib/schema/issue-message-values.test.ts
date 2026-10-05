import { describe, expect, it } from "vitest";

import { toIssueMessageValues } from "./issue-message-values";

describe("toIssueMessageValues", () => {
  it("fills every missing interpolation value with an empty string", () => {
    expect(toIssueMessageValues({})).toEqual({
      table: "",
      column: "",
      index: "",
      enum: "",
      value: "",
    });
  });

  it("keeps the values the target provides", () => {
    expect(toIssueMessageValues({ table: "users", column: "email" })).toEqual({
      table: "users",
      column: "email",
      index: "",
      enum: "",
      value: "",
    });
  });
});
