import { describe, expect, it } from "vitest";

import { relationShape } from "./relation.js";

const RELATION = {
  id: "rel_1",
  kind: "oneToMany",
  fromTableId: "tbl_2",
  toTableId: "tbl_1",
  columnPairs: [{ fromColumnId: "col_4", toColumnId: "col_1" }],
  onDelete: "cascade",
  onUpdate: "noAction",
};

describe("relationShape", () => {
  it("accepts a relation with one column pair", () => {
    expect(relationShape.safeParse(RELATION).data).toStrictEqual(RELATION);
  });

  it("rejects a relation with no column pairs", () => {
    expect(
      relationShape.safeParse({ ...RELATION, columnPairs: [] }).success,
    ).toBe(false);
  });

  it("rejects an unknown referential action", () => {
    expect(
      relationShape.safeParse({ ...RELATION, onDelete: "setNothing" }).success,
    ).toBe(false);
  });

  it("rejects an unknown relation kind", () => {
    expect(
      relationShape.safeParse({ ...RELATION, kind: "manyToMany" }).success,
    ).toBe(false);
  });
});
