import { describe, expect, it } from "vitest";

import { toSourceExcerpt } from "./to-source-excerpt";

describe("toSourceExcerpt", () => {
  it("returns the line of the location with the mark column", () => {
    const excerpt = toSourceExcerpt("first\nCREATE TABEL a;\nthird", {
      line: 2,
      column: 8,
    });

    expect(excerpt).toStrictEqual({ line: "CREATE TABEL a;", markColumn: 8 });
  });

  it("handles carriage returns", () => {
    expect(toSourceExcerpt("one\r\ntwo", { line: 2, column: 1 })).toStrictEqual(
      { line: "two", markColumn: 1 },
    );
  });

  it("handles a line past the end", () => {
    expect(toSourceExcerpt("one", { line: 5, column: 3 })).toStrictEqual({
      line: "",
      markColumn: 1,
    });
  });

  it("cuts a long line to 200 characters around the column", () => {
    const source = `${"a".repeat(500)}X${"b".repeat(500)}`;

    const excerpt = toSourceExcerpt(source, { line: 1, column: 501 });

    expect(excerpt.line).toHaveLength(200);
    expect(excerpt.line[excerpt.markColumn - 1]).toBe("X");
  });

  it("keeps the column when the column is near the start of a long line", () => {
    const source = `X${"b".repeat(500)}`;

    const excerpt = toSourceExcerpt(source, { line: 1, column: 1 });

    expect(excerpt.line).toHaveLength(200);
    expect(excerpt.markColumn).toBe(1);
  });

  it("replaces control characters with the replacement character", () => {
    const excerpt = toSourceExcerpt("a\tb\u0000c‮d", {
      line: 1,
      column: 1,
    });

    expect(excerpt.line).toBe("a�b�c�d");
  });

  it("keeps the utf-16 columns when a non-bmp tag character is replaced", () => {
    const excerpt = toSourceExcerpt("a\u{E0041}bX", { line: 1, column: 5 });

    expect(excerpt.line).toBe("a��bX");
    expect(excerpt.line[excerpt.markColumn - 1]).toBe("X");
  });
});
