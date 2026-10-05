import { describe, expect, it } from "vitest";

import {
  createLineStarts,
  fromParserPosition,
  toSourceLocation,
} from "./source-location.js";

describe("createLineStarts", () => {
  it("counts crlf, lf and lone cr as one line break", () => {
    expect(createLineStarts("a\r\nb\nc\rd")).toStrictEqual([0, 3, 5, 7]);
  });
});

describe("toSourceLocation", () => {
  it("maps the first character to line 1 column 1", () => {
    expect(toSourceLocation(createLineStarts("create table"), 0)).toStrictEqual(
      { line: 1, column: 1 },
    );
  });

  it.each([
    { offset: 3, expected: { line: 2, column: 1 } },
    { offset: 5, expected: { line: 3, column: 1 } },
    { offset: 8, expected: { line: 4, column: 2 } },
  ])(
    "maps offset $offset after mixed line breaks to $expected",
    ({ offset, expected }) => {
      expect(
        toSourceLocation(createLineStarts("a\r\nb\nc\rde"), offset),
      ).toStrictEqual(expected);
    },
  );

  it("counts columns in utf-16 code units after vietnamese text and an emoji", () => {
    const source = "x\nbảng 😀 y";

    expect(
      toSourceLocation(createLineStarts(source), source.indexOf("y")),
    ).toStrictEqual({ line: 2, column: 9 });
  });

  it("places an offset past the end after the last character", () => {
    const source = "ab\ncd";

    expect(
      toSourceLocation(createLineStarts(source), source.length),
    ).toStrictEqual({ line: 2, column: 3 });
  });
});

describe("fromParserPosition", () => {
  it("shifts a zero-based parser column by one", () => {
    expect(fromParserPosition(4, 0, 0)).toStrictEqual({ line: 4, column: 1 });
  });

  it("keeps a one-based parser column", () => {
    expect(fromParserPosition(4, 1, 1)).toStrictEqual({ line: 4, column: 1 });
  });
});
