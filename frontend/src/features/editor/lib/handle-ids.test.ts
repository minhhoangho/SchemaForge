import { describe, expect, it } from "vitest";

import {
  chooseHandleSides,
  formatColumnHandleId,
  formatTableHandleId,
  parseHandleId,
} from "./handle-ids";
import type { ParsedHandle } from "./handle-ids";

describe("formatColumnHandleId and formatTableHandleId", () => {
  it.each([
    ["left column", formatColumnHandleId("col_1", "left"), "column:col_1:left"],
    [
      "right column",
      formatColumnHandleId("col_1", "right"),
      "column:col_1:right",
    ],
    ["left table", formatTableHandleId("tbl_1", "left"), "table:tbl_1:left"],
    ["right table", formatTableHandleId("tbl_1", "right"), "table:tbl_1:right"],
  ])("formats a %s handle id", (_name, handleId, expected) => {
    expect(handleId).toBe(expected);
  });
});

describe("parseHandleId", () => {
  it.each<[string, ParsedHandle]>([
    ["column:col_1:left", { kind: "column", columnId: "col_1", side: "left" }],
    [
      "column:col_1:right",
      { kind: "column", columnId: "col_1", side: "right" },
    ],
    ["table:tbl_1:left", { kind: "table", tableId: "tbl_1", side: "left" }],
    ["table:tbl_1:right", { kind: "table", tableId: "tbl_1", side: "right" }],
  ])("parses %s back into its parts", (handleId, expected) => {
    expect(parseHandleId(handleId)).toEqual(expected);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["an empty string", ""],
    ["column:col_1", "column:col_1"],
    ["column:col_1:middle", "column:col_1:middle"],
    ["other:col_1:left", "other:col_1:left"],
    ["column:col_1:left:extra", "column:col_1:left:extra"],
    ["column::left", "column::left"],
  ])("rejects %s", (_name, handleId) => {
    expect(parseHandleId(handleId)).toBeNull();
  });
});

describe("chooseHandleSides", () => {
  it("puts the source on the right when the from table is to the left", () => {
    expect(chooseHandleSides({ x: 0, y: 0 }, { x: 300, y: -50 })).toEqual({
      source: "right",
      target: "left",
    });
  });

  it("puts the source on the left when the from table is to the right", () => {
    expect(chooseHandleSides({ x: 300, y: 0 }, { x: 0, y: 50 })).toEqual({
      source: "left",
      target: "right",
    });
  });
});
