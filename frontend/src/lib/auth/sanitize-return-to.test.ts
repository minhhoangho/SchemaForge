import { describe, expect, it } from "vitest";

import { buildAuthHref, sanitizeReturnTo } from "./sanitize-return-to";

describe("sanitizeReturnTo", () => {
  it.each(["/", "/schemas/x", "/schemas/x?tab=1#top"])(
    "keeps the same-origin path %j",
    (value) => {
      expect(sanitizeReturnTo(value)).toBe(value);
    },
  );

  it.each([
    "//evil.com",
    "https://evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "schemas/x",
    "",
    "/\t/evil.com",
    "/.//evil.com",
    "/a/..//evil.com",
    "/%2e%2e//evil.com",
    null,
    undefined,
  ])("replaces the unsafe return path %j with /", (value) => {
    expect(sanitizeReturnTo(value)).toBe("/");
  });

  it("returns the normalized path of a same-origin value", () => {
    expect(sanitizeReturnTo("/schemas/../settings")).toBe("/settings");
  });
});

describe("buildAuthHref", () => {
  it("builds a sign-in href with an encoded return path", () => {
    expect(buildAuthHref("/sign-in", "/schemas/x")).toBe(
      "/sign-in?returnTo=%2Fschemas%2Fx",
    );
  });

  it("drops an external return path when building an href", () => {
    expect(buildAuthHref("/sign-up", "https://evil.com/x")).toBe(
      "/sign-up?returnTo=%2F",
    );
  });
});
