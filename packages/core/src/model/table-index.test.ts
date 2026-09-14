import { describe, expect, it } from "vitest";

import { indexShape } from "./table-index.js";

const INDEX = {
  id: "idx_1",
  tableId: "tbl_1",
  name: "users_email_idx",
  columnIds: ["col_2"],
  isUnique: true,
};

describe("indexShape", () => {
  it("accepts an index with one column", () => {
    expect(indexShape.safeParse(INDEX).data).toStrictEqual(INDEX);
  });

  it("rejects an index with no columns", () => {
    expect(indexShape.safeParse({ ...INDEX, columnIds: [] }).success).toBe(
      false,
    );
  });
});
