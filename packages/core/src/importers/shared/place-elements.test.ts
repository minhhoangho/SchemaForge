import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { Position } from "../../model/position.js";
import { PROPERTY_RUNS, PROPERTY_SEED } from "../../testing/arbitraries.js";
import { TEST_LAYOUT_METRICS } from "../../testing/import-test-options.js";
import type { LayoutMetrics } from "./import-types.js";
import { placeElements, type PlacementInput } from "./place-elements.js";

// TEST_LAYOUT_METRICS: cells are 320 + 80 = 400 wide; a row is
// 40 + (tallest column count) × 28 + 80 high.

function ungroupedTables(
  columnCounts: readonly number[],
): PlacementInput["tables"] {
  return columnCounts.map((columnCount) => ({
    columnCount,
    subjectAreaName: null,
  }));
}

function groupedTables(
  subjectAreaNames: readonly (string | null)[],
): PlacementInput["tables"] {
  return subjectAreaNames.map((subjectAreaName) => ({
    columnCount: 1,
    subjectAreaName,
  }));
}

describe("placeElements", () => {
  it("places a single table at the origin", () => {
    const placement = placeElements(
      { tables: ungroupedTables([3]), noteCount: 0 },
      TEST_LAYOUT_METRICS,
    );

    expect(placement).toStrictEqual({ tables: [{ x: 0, y: 0 }], notes: [] });
  });

  it("wraps rows after ceil(sqrt(n)) tables", () => {
    const placement = placeElements(
      { tables: ungroupedTables([2, 2, 2, 2, 2]), noteCount: 0 },
      TEST_LAYOUT_METRICS,
    );

    expect(placement.tables).toStrictEqual([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 800, y: 0 },
      { x: 0, y: 176 },
      { x: 400, y: 176 },
    ]);
  });

  it("starts each subject area on a new row", () => {
    const placement = placeElements(
      { tables: groupedTables(["Billing", "Sales"]), noteCount: 0 },
      TEST_LAYOUT_METRICS,
    );

    expect(placement.tables).toStrictEqual([
      { x: 0, y: 0 },
      { x: 0, y: 148 },
    ]);
  });

  it("orders groups by name and puts tables without a group last", () => {
    const placement = placeElements(
      { tables: groupedTables([null, "beta", "alpha", "Alpha"]), noteCount: 0 },
      TEST_LAYOUT_METRICS,
    );

    expect(placement.tables).toStrictEqual([
      { x: 0, y: 444 },
      { x: 0, y: 296 },
      { x: 0, y: 148 },
      { x: 0, y: 0 },
    ]);
  });

  it("keeps the source order of tables inside a group", () => {
    const placement = placeElements(
      { tables: groupedTables(["Sales", null, "Sales"]), noteCount: 0 },
      TEST_LAYOUT_METRICS,
    );

    expect(placement.tables).toStrictEqual([
      { x: 0, y: 0 },
      { x: 0, y: 148 },
      { x: 400, y: 0 },
    ]);
  });

  it("uses the tallest table of a row for the row height", () => {
    const placement = placeElements(
      { tables: ungroupedTables([1, 5, 2, 0]), noteCount: 0 },
      TEST_LAYOUT_METRICS,
    );

    expect(placement.tables).toStrictEqual([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 0, y: 260 },
      { x: 400, y: 260 },
    ]);
  });

  it.each<{
    name: string;
    columnCounts: readonly number[];
    notes: readonly Position[];
  }>([
    {
      name: "below every table",
      columnCounts: [2, 3],
      notes: [
        { x: 0, y: 204 },
        { x: 400, y: 204 },
        { x: 800, y: 204 },
      ],
    },
    {
      name: "at the origin when there is no table",
      columnCounts: [],
      notes: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 800, y: 0 },
      ],
    },
  ])("places notes on their own row $name", ({ columnCounts, notes }) => {
    const placement = placeElements(
      { tables: ungroupedTables(columnCounts), noteCount: 3 },
      TEST_LAYOUT_METRICS,
    );

    expect(placement.notes).toStrictEqual(notes);
  });

  it("returns integer coordinates", () => {
    const layout: LayoutMetrics = {
      tableWidth: 100.4,
      headerHeight: 10.25,
      columnRowHeight: 7.5,
      gap: 0.3,
    };

    const placement = placeElements(
      { tables: ungroupedTables([1, 1, 1, 1]), noteCount: 1 },
      layout,
    );

    expect(placement).toStrictEqual({
      tables: [
        { x: 0, y: 0 },
        { x: 101, y: 0 },
        { x: 0, y: 18 },
        { x: 101, y: 18 },
      ],
      notes: [{ x: 0, y: 36 }],
    });
  });

  it("never overlaps two tables for the given metrics", () => {
    const layoutArbitrary = fc.record({
      tableWidth: fc.integer({ min: 1, max: 400 }),
      headerHeight: fc.integer({ min: 0, max: 60 }),
      columnRowHeight: fc.integer({ min: 0, max: 40 }),
      gap: fc.integer({ min: 0, max: 100 }),
    });
    const tablesArbitrary = fc.array(
      fc.record({
        columnCount: fc.integer({ min: 0, max: 30 }),
        subjectAreaName: fc.constantFrom(null, "a", "A", "b"),
      }),
      { maxLength: 40 },
    );

    fc.assert(
      fc.property(layoutArbitrary, tablesArbitrary, (layout, tables) => {
        const { tables: positions } = placeElements(
          { tables, noteCount: 0 },
          layout,
        );
        const boxes = positions.map((position, index) => ({
          ...position,
          height:
            layout.headerHeight +
            (tables[index]?.columnCount ?? 0) * layout.columnRowHeight,
        }));
        return boxes.every((box, index) =>
          boxes
            .slice(index + 1)
            .every(
              (other) =>
                box.x + layout.tableWidth <= other.x ||
                other.x + layout.tableWidth <= box.x ||
                box.y + box.height <= other.y ||
                other.y + other.height <= box.y,
            ),
        );
      }),
      { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS },
    );
  });

  it.each<{ field: keyof LayoutMetrics; value: number }>([
    { field: "tableWidth", value: -1 },
    { field: "headerHeight", value: -0.5 },
    { field: "columnRowHeight", value: Number.NaN },
    { field: "gap", value: Number.POSITIVE_INFINITY },
  ])("throws a range error when $field is $value", ({ field, value }) => {
    const layout = { ...TEST_LAYOUT_METRICS, [field]: value };

    expect(() =>
      placeElements({ tables: ungroupedTables([1]), noteCount: 0 }, layout),
    ).toThrow(RangeError);
  });
});
