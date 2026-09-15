import { describe, expect, it } from "vitest";

import type { SchemaParts } from "../testing/factories.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeIndex,
  makeNote,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "../testing/factories.js";
import {
  sortEnums,
  sortIndexes,
  sortNotes,
  sortRelations,
  sortSubjectAreas,
  sortTables,
} from "./ordering.js";
import type { SchemaDocument } from "./schema-document.js";

function idsOf(elements: readonly { readonly id: string }[]): string[] {
  return elements.map((element) => element.id);
}

describe("sortTables", () => {
  it("sorts tables by name without regard to case", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "Zebra" }),
        makeTable({ id: "tbl_2", name: "apple" }),
        makeTable({ id: "tbl_3", name: "Mango" }),
      ],
    });

    expect(idsOf(sortTables(schema))).toStrictEqual([
      "tbl_2",
      "tbl_3",
      "tbl_1",
    ]);
  });

  it("breaks a case-insensitive tie by exact name", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "users" }),
        makeTable({ id: "tbl_2", name: "Users" }),
      ],
    });

    expect(idsOf(sortTables(schema))).toStrictEqual(["tbl_2", "tbl_1"]);
  });

  it("breaks an exact name tie by id", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_b", name: "users" }),
        makeTable({ id: "tbl_a", name: "users" }),
      ],
    });

    expect(idsOf(sortTables(schema))).toStrictEqual(["tbl_a", "tbl_b"]);
  });

  it("compares names by code unit rather than locale", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "đơn_hàng" }),
        makeTable({ id: "tbl_2", name: "zones" }),
      ],
    });

    expect(idsOf(sortTables(schema))).toStrictEqual(["tbl_2", "tbl_1"]);
  });
});

describe("sortEnums", () => {
  it("sorts enums by the same name rule as tables", () => {
    const schema = buildSchema({
      enums: [
        makeEnum({ id: "enum_a", name: "status" }),
        makeEnum({ id: "enum_b", name: "role" }),
        makeEnum({ id: "enum_c", name: "Role" }),
        makeEnum({ id: "enum_0", name: "role" }),
      ],
    });

    expect(idsOf(sortEnums(schema))).toStrictEqual([
      "enum_c",
      "enum_0",
      "enum_b",
      "enum_a",
    ]);
  });
});

describe("sortSubjectAreas", () => {
  it("sorts subject areas by the same name rule as tables", () => {
    const schema = buildSchema({
      subjectAreas: [
        makeSubjectArea({ id: "area_a", name: "sales" }),
        makeSubjectArea({ id: "area_b", name: "billing" }),
        makeSubjectArea({ id: "area_c", name: "Billing" }),
        makeSubjectArea({ id: "area_0", name: "billing" }),
      ],
    });

    expect(idsOf(sortSubjectAreas(schema))).toStrictEqual([
      "area_c",
      "area_0",
      "area_b",
      "area_a",
    ]);
  });
});

describe("sortIndexes", () => {
  it("sorts indexes by table order, then name, then id", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "orders" }),
        makeTable({ id: "tbl_2", name: "Accounts" }),
      ],
      columns: [
        makeColumn({ id: "col_1", tableId: "tbl_1" }),
        makeColumn({ id: "col_2", tableId: "tbl_2" }),
      ],
      indexes: [
        makeIndex({
          id: "idx_1",
          tableId: "tbl_1",
          name: "a_index",
          columnIds: ["col_1"],
        }),
        makeIndex({
          id: "idx_2",
          tableId: "tbl_2",
          name: "Z_index",
          columnIds: ["col_2"],
        }),
        makeIndex({
          id: "idx_5",
          tableId: "tbl_2",
          name: "m_index",
          columnIds: ["col_2"],
        }),
        makeIndex({
          id: "idx_4",
          tableId: "tbl_2",
          name: "m_index",
          columnIds: ["col_2"],
        }),
      ],
    });

    expect(idsOf(sortIndexes(schema))).toStrictEqual([
      "idx_4",
      "idx_5",
      "idx_2",
      "idx_1",
    ]);
  });
});

describe("sortRelations", () => {
  it("sorts relations by foreign key table order", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "orders" }),
        makeTable({ id: "tbl_2", name: "items" }),
        makeTable({ id: "tbl_3", name: "users" }),
      ],
      columns: [
        makeColumn({ id: "col_order_id", tableId: "tbl_1" }),
        makeColumn({ id: "col_order_user_id", tableId: "tbl_1" }),
        makeColumn({ id: "col_item_order_id", tableId: "tbl_2" }),
        makeColumn({ id: "col_user_id", tableId: "tbl_3" }),
      ],
      relations: [
        makeRelation({
          id: "rel_1",
          fromTableId: "tbl_1",
          toTableId: "tbl_3",
          columnPairs: [
            { fromColumnId: "col_order_user_id", toColumnId: "col_user_id" },
          ],
        }),
        makeRelation({
          id: "rel_2",
          fromTableId: "tbl_2",
          toTableId: "tbl_1",
          columnPairs: [
            { fromColumnId: "col_item_order_id", toColumnId: "col_order_id" },
          ],
        }),
      ],
    });

    expect(idsOf(sortRelations(schema))).toStrictEqual(["rel_2", "rel_1"]);
  });

  it("sorts relations of one table by the position of their first foreign key column", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "orders" }),
        makeTable({ id: "tbl_2", name: "users" }),
      ],
      columns: [
        makeColumn({ id: "col_z", tableId: "tbl_1" }),
        makeColumn({ id: "col_m", tableId: "tbl_1" }),
        makeColumn({ id: "col_a", tableId: "tbl_1" }),
        makeColumn({ id: "col_x", tableId: "tbl_2" }),
        makeColumn({ id: "col_y", tableId: "tbl_2" }),
      ],
      relations: [
        makeRelation({
          id: "rel_1",
          fromTableId: "tbl_1",
          toTableId: "tbl_2",
          columnPairs: [{ fromColumnId: "col_a", toColumnId: "col_x" }],
        }),
        makeRelation({
          id: "rel_2",
          fromTableId: "tbl_1",
          toTableId: "tbl_2",
          columnPairs: [
            { fromColumnId: "col_z", toColumnId: "col_x" },
            { fromColumnId: "col_a", toColumnId: "col_y" },
          ],
        }),
        makeRelation({
          id: "rel_3",
          fromTableId: "tbl_1",
          toTableId: "tbl_2",
          columnPairs: [{ fromColumnId: "col_m", toColumnId: "col_x" }],
        }),
      ],
    });

    expect(idsOf(sortRelations(schema))).toStrictEqual([
      "rel_2",
      "rel_3",
      "rel_1",
    ]);
  });

  it("breaks a relation tie by id", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_1", name: "orders" }),
        makeTable({ id: "tbl_2", name: "users" }),
      ],
      columns: [
        makeColumn({ id: "col_user_id", tableId: "tbl_1" }),
        makeColumn({ id: "col_id", tableId: "tbl_2" }),
      ],
      relations: [
        makeRelation({
          id: "rel_b",
          fromTableId: "tbl_1",
          toTableId: "tbl_2",
          columnPairs: [{ fromColumnId: "col_user_id", toColumnId: "col_id" }],
        }),
        makeRelation({
          id: "rel_a",
          fromTableId: "tbl_1",
          toTableId: "tbl_2",
          columnPairs: [{ fromColumnId: "col_user_id", toColumnId: "col_id" }],
        }),
      ],
    });

    expect(idsOf(sortRelations(schema))).toStrictEqual(["rel_a", "rel_b"]);
  });
});

describe("sortNotes", () => {
  it("sorts notes by id", () => {
    const schema = buildSchema({
      notes: [
        makeNote({ id: "note_b" }),
        makeNote({ id: "note_c" }),
        makeNote({ id: "note_a" }),
      ],
    });

    expect(idsOf(sortNotes(schema))).toStrictEqual([
      "note_a",
      "note_b",
      "note_c",
    ]);
  });
});

const ORDERING_PARTS = {
  tables: [
    makeTable({ id: "tbl_1", name: "orders" }),
    makeTable({ id: "tbl_2", name: "users" }),
  ],
  columns: [
    makeColumn({ id: "col_order_user_id", tableId: "tbl_1" }),
    makeColumn({ id: "col_order_total", tableId: "tbl_1" }),
    makeColumn({ id: "col_user_id", tableId: "tbl_2" }),
  ],
  relations: [
    makeRelation({
      id: "rel_1",
      fromTableId: "tbl_1",
      toTableId: "tbl_2",
      columnPairs: [
        { fromColumnId: "col_order_user_id", toColumnId: "col_user_id" },
      ],
    }),
    makeRelation({
      id: "rel_2",
      fromTableId: "tbl_2",
      toTableId: "tbl_2",
      columnPairs: [{ fromColumnId: "col_user_id", toColumnId: "col_user_id" }],
    }),
  ],
  indexes: [
    makeIndex({ id: "idx_1", tableId: "tbl_2", columnIds: ["col_user_id"] }),
    makeIndex({
      id: "idx_2",
      tableId: "tbl_1",
      columnIds: ["col_order_total"],
    }),
  ],
  enums: [makeEnum({ id: "enum_1" }), makeEnum({ id: "enum_2" })],
  subjectAreas: [
    makeSubjectArea({ id: "area_1" }),
    makeSubjectArea({ id: "area_2" }),
  ],
  notes: [makeNote({ id: "note_1" }), makeNote({ id: "note_2" })],
} satisfies SchemaParts;

// Columns keep their order because it is meaningful storage order, not map order.
function buildWithReversedMaps(parts: typeof ORDERING_PARTS): SchemaDocument {
  return buildSchema({
    tables: parts.tables.toReversed(),
    columns: parts.columns,
    relations: parts.relations.toReversed(),
    indexes: parts.indexes.toReversed(),
    enums: parts.enums.toReversed(),
    subjectAreas: parts.subjectAreas.toReversed(),
    notes: parts.notes.toReversed(),
  });
}

function sortEverything(
  schema: SchemaDocument,
): readonly (readonly string[])[] {
  return [
    idsOf(sortTables(schema)),
    idsOf(sortIndexes(schema)),
    idsOf(sortRelations(schema)),
    idsOf(sortEnums(schema)),
    idsOf(sortSubjectAreas(schema)),
    idsOf(sortNotes(schema)),
  ];
}

describe("ordering", () => {
  it("returns the same order when map keys were inserted in a different order", () => {
    const forward = buildSchema(ORDERING_PARTS);
    const reversed = buildWithReversedMaps(ORDERING_PARTS);

    expect(sortEverything(reversed)).toStrictEqual(sortEverything(forward));
  });
});
