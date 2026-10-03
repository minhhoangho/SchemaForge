import { createEmptySchema } from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import { isGenerateCodeRequest } from "./worker-protocol";

const valid = {
  requestId: 1,
  target: "postgresql",
  options: {},
  document: createEmptySchema("Empty"),
};

describe("isGenerateCodeRequest", () => {
  it("accepts a well-formed request", () => {
    expect(isGenerateCodeRequest(valid)).toBe(true);
  });

  it.each([
    ["an unknown target", { ...valid, target: "cobol" }],
    ["a non-integer id", { ...valid, requestId: 1.5 }],
    ["a missing document", { ...valid, document: undefined }],
    ["a missing options object", { ...valid, options: null }],
    ["a non-object value", "hello"],
    ["null", null],
  ])("rejects a request with %s", (_name, value) => {
    expect(isGenerateCodeRequest(value)).toBe(false);
  });
});
