import { describe, expect, it } from "vitest";

import { IMPORT_LAYOUT_METRICS } from "./import-layout";

describe("IMPORT_LAYOUT_METRICS", () => {
  it("uses positive whole numbers", () => {
    const values = Object.values(IMPORT_LAYOUT_METRICS);

    expect(values.every(Number.isInteger)).toBe(true);
    expect(Math.min(...values)).toBeGreaterThan(0);
  });

  it("matches the table width of the table node", () => {
    expect(IMPORT_LAYOUT_METRICS.tableWidth).toBe(320);
  });
});
