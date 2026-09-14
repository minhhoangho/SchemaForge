import { describe, expect, it } from "vitest";

import { compareDocumentPaths, sortByPathThenCode } from "./document-path.js";

describe("compareDocumentPaths", () => {
  it("orders numeric segments by value", () => {
    expect(
      compareDocumentPaths(["columnIds", 2], ["columnIds", 10]),
    ).toBeLessThan(0);
  });

  it("orders string segments by UTF-16 code unit instead of locale", () => {
    expect(compareDocumentPaths(["tables", "Z"], ["tables", "a"])).toBeLessThan(
      0,
    );
  });

  it("places a numeric segment before a string segment at the same position", () => {
    expect(compareDocumentPaths(["values", 9], ["values", "0"])).toBeLessThan(
      0,
    );
  });

  it("places a path before a longer path that starts with it", () => {
    expect(
      compareDocumentPaths(["tables", "tbl_1", "name"], ["tables", "tbl_1"]),
    ).toBeGreaterThan(0);
  });
});

describe("sortByPathThenCode", () => {
  it("sorts items with equal paths by code", () => {
    const items = [
      { code: "name-too-long", path: ["tables", "tbl_1", "name"] },
      { code: "name-invalid", path: ["tables", "tbl_1", "name"] },
      { code: "name-empty", path: ["tables", "tbl_0", "name"] },
    ];

    expect(sortByPathThenCode(items)).toStrictEqual([
      { code: "name-empty", path: ["tables", "tbl_0", "name"] },
      { code: "name-invalid", path: ["tables", "tbl_1", "name"] },
      { code: "name-too-long", path: ["tables", "tbl_1", "name"] },
    ]);
  });

  it("returns a new array and leaves the input unchanged", () => {
    const items = [
      { code: "table-not-found", path: ["tables", "tbl_2"] },
      { code: "table-not-found", path: ["tables", "tbl_1"] },
    ];

    const sorted = sortByPathThenCode(items);

    expect(sorted).not.toBe(items);
    expect(items).toStrictEqual([
      { code: "table-not-found", path: ["tables", "tbl_2"] },
      { code: "table-not-found", path: ["tables", "tbl_1"] },
    ]);
  });
});
