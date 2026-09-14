import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createColumnId,
  createEnumId,
  createIndexId,
  createNoteId,
  createRelationId,
  createSubjectAreaId,
  createTableId,
  enumIdShape,
  isNoteId,
  isTableId,
  MAX_ID_LENGTH,
  tableIdShape,
} from "./ids.js";
import type { TableId } from "./ids.js";

const ID_CREATORS = [
  { prefix: "tbl_", createId: createTableId },
  { prefix: "col_", createId: createColumnId },
  { prefix: "rel_", createId: createRelationId },
  { prefix: "idx_", createId: createIndexId },
  { prefix: "enum_", createId: createEnumId },
  { prefix: "area_", createId: createSubjectAreaId },
  { prefix: "note_", createId: createNoteId },
];

describe("id shapes", () => {
  it("accepts a table id with a valid token", () => {
    expect(tableIdShape.safeParse("tbl_Ab9_-z").success).toBe(true);
  });

  it("rejects an id that has another element prefix", () => {
    expect(tableIdShape.safeParse("col_1").success).toBe(false);
  });

  it("rejects an id with an empty token", () => {
    expect(tableIdShape.safeParse("tbl_").success).toBe(false);
  });

  it("rejects a token containing a space", () => {
    expect(tableIdShape.safeParse("tbl_a b").success).toBe(false);
  });

  it("accepts an id of exactly 64 characters", () => {
    const id = `tbl_${"a".repeat(MAX_ID_LENGTH - "tbl_".length)}`;

    expect(tableIdShape.safeParse(id).success).toBe(true);
  });

  it("rejects an id of 65 characters", () => {
    const id = `tbl_${"a".repeat(MAX_ID_LENGTH + 1 - "tbl_".length)}`;

    expect(tableIdShape.safeParse(id).success).toBe(false);
  });

  it("limits the token of five-letter prefixes to 59 characters", () => {
    expect(enumIdShape.safeParse(`enum_${"a".repeat(59)}`).success).toBe(true);
    expect(enumIdShape.safeParse(`enum_${"a".repeat(60)}`).success).toBe(false);
  });
});

describe("id creators", () => {
  it.each(ID_CREATORS)(
    "creates an id by prefixing the generated token ($prefix)",
    ({ prefix, createId }) => {
      expect(createId(() => "7")).toBe(`${prefix}7`);
    },
  );

  it.each(ID_CREATORS)(
    "throws when the id generator returns an invalid token ($prefix)",
    ({ createId }) => {
      expect(() => createId(() => "not valid")).toThrow(Error);
    },
  );
});

describe("id type guards", () => {
  it("recognizes table ids with isTableId", () => {
    expect([isTableId("tbl_1"), isTableId("note_1")]).toStrictEqual([
      true,
      false,
    ]);
  });

  it("recognizes note ids with isNoteId", () => {
    expect([isNoteId("note_1"), isNoteId("tbl_1")]).toStrictEqual([
      true,
      false,
    ]);
  });
});

describe("id types", () => {
  it("infers TableId as the tbl_ template literal type", () => {
    expectTypeOf<TableId>().toEqualTypeOf<`tbl_${string}`>();
  });
});
