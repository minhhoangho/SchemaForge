import { describe, expect, it } from "vitest";

import { unwrapError, unwrapOk } from "../../testing/unwrap-result.js";
import {
  SEED_DATASET_MAX_DEPTH,
  SEED_ROWS_PER_TABLE_MAXIMUM,
  assertSeedDatasetOptions,
  parseSeedDataset,
} from "./seed-dataset.js";

const MAX_SEED = 0xffffffff;
// Root 0, tables 1, table 2, rows 3, row 4: a column value container is at 5.
const COLUMN_VALUE_DEPTH = 5;
const WIDE_ARRAY_LENGTH = 200_000;

function datasetWithValue(value: unknown): unknown {
  return { tables: [{ tableId: "tbl_a", rows: [{ col_a: value }] }] };
}

function nestedArrays(levels: number): unknown {
  return JSON.parse("[".repeat(levels) + "]".repeat(levels));
}

describe("assertSeedDatasetOptions", () => {
  it.each([
    [1, 0],
    [SEED_ROWS_PER_TABLE_MAXIMUM, MAX_SEED],
  ])(
    "accepts rows per table from 1 to 1000 and seeds from 0 to 2^32 - 1 (%i, %i)",
    (rowsPerTable, seed) => {
      expect(() => {
        assertSeedDatasetOptions({ rowsPerTable, seed });
      }).not.toThrow();
    },
  );

  it.each([0, 1001, 1.5])(
    "throws RangeError for rows per table %s",
    (rowsPerTable) => {
      expect(() => {
        assertSeedDatasetOptions({ rowsPerTable, seed: 1 });
      }).toThrow(RangeError);
    },
  );

  it.each([-1, 0.5, MAX_SEED + 1])(
    "throws RangeError for a negative, fractional or too large seed %s",
    (seed) => {
      expect(() => {
        assertSeedDatasetOptions({ rowsPerTable: 1, seed });
      }).toThrow(RangeError);
    },
  );
});

describe("parseSeedDataset", () => {
  it("parses a valid dataset", () => {
    const input = {
      tables: [
        {
          tableId: "tbl_a",
          rows: [{ col_a: 1, col_b: "x", col_c: null, col_d: { value: [1] } }],
        },
        { tableId: "tbl_b", rows: [] },
      ],
    };
    expect(unwrapOk(parseSeedDataset(input))).toStrictEqual(input);
  });

  it.each([
    ["an unknown key", { tables: [], extra: 1 }, ["extra"]],
    [
      "a bad table id",
      { tables: [{ tableId: "users", rows: [] }] },
      ["tables", 0, "tableId"],
    ],
    [
      "a non-json value",
      datasetWithValue(Number.NaN),
      ["tables", 0, "rows", 0, "col_a"],
    ],
  ])(
    "rejects a dataset with %s with an invalid-shape error at its path",
    (_label, input, path) => {
      expect(unwrapError(parseSeedDataset(input))).toStrictEqual([
        { code: "invalid-shape", path },
      ]);
    },
  );

  it("rejects a row key that is not a column id", () => {
    const input = { tables: [{ tableId: "tbl_a", rows: [{ name: 1 }] }] };
    expect(unwrapError(parseSeedDataset(input))).toStrictEqual([
      { code: "invalid-shape", path: ["tables", 0, "rows", 0, "name"] },
    ]);
  });

  it("parses rows that omit columns", () => {
    const input = { tables: [{ tableId: "tbl_a", rows: [{}, { col_a: 2 }] }] };
    expect(unwrapOk(parseSeedDataset(input))).toStrictEqual(input);
  });

  it("parses a row keyed by a column id that the schema does not have", () => {
    const input = datasetWithValue("x");
    expect(unwrapOk(parseSeedDataset(input))).toStrictEqual(input);
  });

  it("rejects a table with more than 1000 rows with invalid-shape", () => {
    const input = {
      tables: [
        {
          tableId: "tbl_a",
          rows: Array.from({ length: SEED_ROWS_PER_TABLE_MAXIMUM + 1 }, () => ({
            col_a: 1,
          })),
        },
      ],
    };
    expect(unwrapError(parseSeedDataset(input))).toStrictEqual([
      { code: "invalid-shape", path: ["tables", 0, "rows"] },
    ]);
  });

  it("returns invalid-shape instead of throwing for deeply nested values", () => {
    const [error] = unwrapError(
      parseSeedDataset(datasetWithValue(nestedArrays(100_000))),
    );
    expect(error?.code).toBe("invalid-shape");
    expect(error?.path.slice(0, COLUMN_VALUE_DEPTH)).toStrictEqual([
      "tables",
      0,
      "rows",
      0,
      "col_a",
    ]);
  });

  // 150 000 elements already overflowed the call stack when spread into push.
  it("returns invalid-shape instead of throwing for a very wide array", () => {
    const [error] = unwrapError(
      parseSeedDataset({
        tables: new Array<number>(WIDE_ARRAY_LENGTH).fill(0),
      }),
    );
    expect(error).toStrictEqual({ code: "invalid-shape", path: ["tables", 0] });
  });

  it("reports the first container past the depth limit", () => {
    const levels = SEED_DATASET_MAX_DEPTH - COLUMN_VALUE_DEPTH + 2;
    const [error] = unwrapError(
      parseSeedDataset(datasetWithValue(nestedArrays(levels))),
    );
    expect(error?.path).toHaveLength(SEED_DATASET_MAX_DEPTH + 1);
  });

  it("accepts a json value nested up to the depth limit", () => {
    const input = datasetWithValue(
      nestedArrays(SEED_DATASET_MAX_DEPTH - COLUMN_VALUE_DEPTH + 1),
    );
    expect(unwrapOk(parseSeedDataset(input))).toStrictEqual(input);
  });

  it("checks depth on objects as well as arrays", () => {
    const deep: unknown = JSON.parse(
      '{"a":'.repeat(SEED_DATASET_MAX_DEPTH) +
        "1" +
        "}".repeat(SEED_DATASET_MAX_DEPTH),
    );
    expect(unwrapError(parseSeedDataset(datasetWithValue(deep)))).toHaveLength(
      1,
    );
  });
});
