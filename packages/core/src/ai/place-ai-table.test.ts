import { describe, expect, it } from "vitest";

import { buildSchema, makeTable } from "../testing/factories.js";
import {
  AI_TABLE_GRID_STEP_X,
  AI_TABLE_GRID_STEP_Y,
  AI_TABLES_PER_ROW,
  aiTablePosition,
  createAiTablePlacement,
} from "./place-ai-table.js";

const SCHEMA = buildSchema({
  tables: [
    makeTable({ id: "tbl_left", position: { x: -50, y: 900 } }),
    makeTable({ id: "tbl_right", position: { x: 820, y: 0 } }),
    makeTable({ id: "tbl_middle", position: { x: 400, y: 400 } }),
  ],
});

describe("createAiTablePlacement", () => {
  it("starts at x 0 for an empty schema", () => {
    expect(createAiTablePlacement(buildSchema({}))).toStrictEqual({
      originX: 0,
      placedCount: 0,
    });
  });

  it("starts one grid step right of the rightmost table", () => {
    expect(createAiTablePlacement(SCHEMA)).toStrictEqual({
      originX: 820 + AI_TABLE_GRID_STEP_X,
      placedCount: 0,
    });
  });

  it("starts one grid step right of a table left of the origin", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_only", position: { x: -1000, y: 0 } })],
    });

    expect(createAiTablePlacement(schema).originX).toBe(
      -1000 + AI_TABLE_GRID_STEP_X,
    );
  });
});

describe("aiTablePosition", () => {
  it("uses grid constants of 4 tables per row and 400 by 400 steps", () => {
    expect([
      AI_TABLES_PER_ROW,
      AI_TABLE_GRID_STEP_X,
      AI_TABLE_GRID_STEP_Y,
    ]).toStrictEqual([4, 400, 400]);
  });

  it("two createTable calls in one turn are placed in the same row", () => {
    const placement = createAiTablePlacement(SCHEMA);

    expect([
      aiTablePosition(placement),
      aiTablePosition({ ...placement, placedCount: 1 }),
    ]).toStrictEqual([
      { x: 1220, y: 0 },
      { x: 1620, y: 0 },
    ]);
  });

  it.each([
    [3, { x: 1200, y: 0 }],
    [4, { x: 0, y: 400 }],
    [5, { x: 400, y: 400 }],
    [8, { x: 0, y: 800 }],
  ])(
    "wraps to the next row after four tables (table %i)",
    (placedCount, position) => {
      expect(aiTablePosition({ originX: 0, placedCount })).toStrictEqual(
        position,
      );
    },
  );
});
