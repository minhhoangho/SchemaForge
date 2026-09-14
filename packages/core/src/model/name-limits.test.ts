import { describe, expect, it } from "vitest";

import { toNameKey, utf8ByteLength } from "./name-limits.js";

describe("utf8ByteLength", () => {
  it("counts ASCII characters as one byte", () => {
    expect(utf8ByteLength("users")).toBe(5);
  });

  it("counts a Latin-1 letter such as é as two bytes", () => {
    expect(utf8ByteLength("é")).toBe(2);
  });

  it("counts a Vietnamese letter such as ệ as three bytes", () => {
    expect(utf8ByteLength("ệ")).toBe(3);
  });

  it("counts an emoji as four bytes", () => {
    expect(utf8ByteLength("\u{1F600}")).toBe(4);
  });

  it("counts a lone surrogate as three bytes", () => {
    expect(utf8ByteLength("\uD800")).toBe(3);
  });
});

describe("toNameKey", () => {
  it("lowercases names for comparison without depending on locale", () => {
    expect(toNameKey("Đơn_HÀNG_TITLE")).toBe("đơn_hàng_title");
  });
});
