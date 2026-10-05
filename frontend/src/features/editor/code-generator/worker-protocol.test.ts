import { createEmptySchema } from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import { isBuildZipRequest, isGenerateCodeRequest } from "./worker-protocol";

const valid = {
  requestId: 1,
  target: "postgresql",
  options: {},
  document: createEmptySchema("Empty"),
};

const zip = {
  kind: "build-zip",
  requestId: 2,
  document: createEmptySchema("Empty"),
  baseName: "empty",
  generators: [{ target: "postgresql", options: {} }],
  includeJson: true,
  images: [{ fileName: "empty.png", bytes: new Uint8Array(1) }],
};

describe("isBuildZipRequest", () => {
  it("recognises a build zip request", () => {
    expect(isBuildZipRequest(zip)).toBe(true);
  });

  it("keeps accepting generate requests without a kind", () => {
    expect(isGenerateCodeRequest(valid)).toBe(true);
    expect(isBuildZipRequest(valid)).toBe(false);
  });

  it.each([
    ["a generate request kind", { ...zip, kind: "generate" }],
    ["a bad generator", { ...zip, generators: [{ target: "cobol" }] }],
    ["an image without bytes", { ...zip, images: [{ fileName: "a.png" }] }],
    ["a non-boolean includeJson", { ...zip, includeJson: "yes" }],
    ["null", null],
  ])("rejects a zip request with %s", (_name, value) => {
    expect(isBuildZipRequest(value)).toBe(false);
  });
});

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
