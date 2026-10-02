import { describe, expect, it } from "vitest";
import {
  getTableAccent,
  getTableAccentColor,
  TABLE_ACCENT_COUNT,
  type TableAccentIndex,
} from "./table-accent";

const ACCENTS_OF_1000_IDS = new Set<TableAccentIndex>(
  Array.from({ length: 1000 }, (_, index) =>
    getTableAccent(`tbl_${String(index)}`),
  ),
);

describe("table-accent", () => {
  it("returns the same accent for the same table id", () => {
    const id = "tbl_users";
    const first = getTableAccent(id);
    const second = getTableAccent(id);
    expect(first).toBe(second);
  });

  it("returns an accent between 1 and 8", () => {
    const id = "tbl_test";
    const accent = getTableAccent(id);
    expect(accent).toBeGreaterThanOrEqual(1);
    expect(accent).toBeLessThanOrEqual(8);
  });

  it("spreads 1000 generated table ids over all 8 accents", () => {
    expect(ACCENTS_OF_1000_IDS.size).toBe(TABLE_ACCENT_COUNT);
  });

  it("formats the accent as a css variable reference", () => {
    const id = "tbl_test";
    const color = getTableAccentColor(id);
    expect(color).toMatch(/^var\(--table-accent-[1-8]\)$/);
  });

  it("keeps the accent of a known id stable", () => {
    expect(getTableAccent("tbl_users")).toBe(7);
    expect(getTableAccent("tbl_orders")).toBe(8);
  });
});
