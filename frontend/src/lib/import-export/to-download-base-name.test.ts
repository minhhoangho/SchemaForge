import { describe, expect, it } from "vitest";

import { toDownloadBaseName } from "./to-download-base-name";

describe("toDownloadBaseName", () => {
  it("removes vietnamese diacritics and maps đ to d", () => {
    expect(toDownloadBaseName("Quản lý Đơn hàng")).toBe("quan-ly-don-hang");
    expect(toDownloadBaseName("đĐ")).toBe("dd");
  });

  it("collapses runs of other characters into one dash", () => {
    expect(toDownloadBaseName("my  schema__v2!!")).toBe("my-schema-v2");
  });

  it("trims dashes at both ends", () => {
    expect(toDownloadBaseName("  --blog--  ")).toBe("blog");
  });

  it("cuts names longer than sixty characters", () => {
    expect(toDownloadBaseName("a".repeat(80))).toHaveLength(60);
    expect(toDownloadBaseName(`${"a".repeat(59)} b`)).toBe("a".repeat(59));
  });

  it("returns schema for an empty result", () => {
    expect(toDownloadBaseName("")).toBe("schema");
    expect(toDownloadBaseName("日本語")).toBe("schema");
  });
});
