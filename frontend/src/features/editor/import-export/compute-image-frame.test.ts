import {
  buildSchema,
  makeColumn,
  makeRelation,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import {
  computeImageFrame,
  hasSelfRelation,
  IMAGE_PADDING,
  MAX_PNG_PIXELS,
  MAX_PNG_SIDE,
  SELF_RELATION_LOOP_WIDTH,
} from "./compute-image-frame";

const SMALL_BOUNDS = { x: 100, y: -50, width: 600, height: 400 };

describe("computeImageFrame", () => {
  it("adds forty pixels of padding on every side", () => {
    const frame = computeImageFrame({
      bounds: SMALL_BOUNDS,
      hasSelfRelation: false,
      format: "svg",
    });

    expect(frame).toStrictEqual({
      width: 680,
      height: 480,
      translateX: IMAGE_PADDING - 100,
      translateY: IMAGE_PADDING + 50,
      pixelRatio: 1,
      isScaledDown: false,
    });
  });

  it("widens the right edge for a self relation", () => {
    const frame = computeImageFrame({
      bounds: SMALL_BOUNDS,
      hasSelfRelation: true,
      format: "svg",
    });

    expect(frame.width).toBe(680 + SELF_RELATION_LOOP_WIDTH);
    expect(frame.translateX).toBe(IMAGE_PADDING - 100);
  });

  it("uses a pixel ratio of two for a small png", () => {
    const frame = computeImageFrame({
      bounds: SMALL_BOUNDS,
      hasSelfRelation: false,
      format: "png",
    });

    expect(frame.pixelRatio).toBe(2);
    expect(frame.isScaledDown).toBe(false);
  });

  it("scales a png down to the pixel area limit", () => {
    // 8000 x 8000 with padding: the area limit binds before the side limit.
    const frame = computeImageFrame({
      bounds: { x: 0, y: 0, width: 7920, height: 7920 },
      hasSelfRelation: false,
      format: "png",
    });

    expect(frame.pixelRatio).toBeCloseTo(Math.sqrt(MAX_PNG_PIXELS / 64e6));
    expect(frame.width * frame.height * frame.pixelRatio ** 2).toBeCloseTo(
      MAX_PNG_PIXELS,
    );
    expect(frame.isScaledDown).toBe(true);
  });

  it("scales a png down to the side limit", () => {
    // A long, thin schema: 32 000 px wide, 200 px high.
    const frame = computeImageFrame({
      bounds: { x: 0, y: 0, width: 31_920, height: 120 },
      hasSelfRelation: false,
      format: "png",
    });

    expect(frame.pixelRatio).toBe(MAX_PNG_SIDE / 32_000);
    expect(frame.isScaledDown).toBe(true);
  });

  it("keeps svg at ratio one without limits", () => {
    const frame = computeImageFrame({
      bounds: { x: 0, y: 0, width: 31_920, height: 7920 },
      hasSelfRelation: false,
      format: "svg",
    });

    expect(frame.pixelRatio).toBe(1);
    expect(frame.isScaledDown).toBe(false);
  });
});

describe("hasSelfRelation", () => {
  const tables = [
    makeTable({ id: "tbl_a", name: "a" }),
    makeTable({ id: "tbl_b", name: "b" }),
  ];
  const columns = [
    makeColumn({ id: "col_a", tableId: "tbl_a" }),
    makeColumn({ id: "col_b", tableId: "tbl_b" }),
  ];

  it("is true when a relation starts and ends on the same table", () => {
    const schema = buildSchema({
      tables,
      columns,
      relations: [
        makeRelation({
          id: "rel_a_a",
          fromTableId: "tbl_a",
          toTableId: "tbl_a",
          columnPairs: [{ fromColumnId: "col_a", toColumnId: "col_a" }],
        }),
      ],
    });
    expect(hasSelfRelation(schema)).toBe(true);
  });

  it("is false when every relation joins two tables", () => {
    const schema = buildSchema({
      tables,
      columns,
      relations: [
        makeRelation({
          id: "rel_a_b",
          fromTableId: "tbl_a",
          toTableId: "tbl_b",
          columnPairs: [{ fromColumnId: "col_a", toColumnId: "col_b" }],
        }),
      ],
    });
    expect(hasSelfRelation(schema)).toBe(false);
  });
});
