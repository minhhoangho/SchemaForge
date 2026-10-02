import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeRelation,
  makeTable,
} from "../../testing/factories.js";
import type { SeedDataset, SeedRow } from "./seed-dataset.js";
import {
  findDeferredSeedRelations,
  validateSeedDataset,
} from "./validate-seed-dataset.js";

// parents(id); children(id, parent → parents, code unique, flag, status,
// note with a default, counter auto-increment); nodes(id, parent → nodes);
// links(parent → parents, no primary key); optionals(id, parent → parents,
// nullable); pairs(left, right) unique on both.
function createSchema(): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({ id: "tbl_parents", primaryKeyColumnIds: ["col_parents_id"] }),
      makeTable({
        id: "tbl_children",
        primaryKeyColumnIds: ["col_children_id"],
      }),
      makeTable({ id: "tbl_nodes", primaryKeyColumnIds: ["col_nodes_id"] }),
      makeTable({ id: "tbl_links" }),
      makeTable({
        id: "tbl_optionals",
        primaryKeyColumnIds: ["col_optionals_id"],
      }),
    ],
    columns: [
      makeColumn({ id: "col_parents_id", tableId: "tbl_parents" }),
      makeColumn({ id: "col_children_id", tableId: "tbl_children" }),
      makeColumn({ id: "col_children_parent", tableId: "tbl_children" }),
      makeColumn({
        id: "col_children_code",
        tableId: "tbl_children",
        type: { kind: "varchar", length: 3 },
        isNullable: true,
        isUnique: true,
      }),
      makeColumn({
        id: "col_children_flag",
        tableId: "tbl_children",
        type: { kind: "boolean" },
        isNullable: true,
      }),
      makeColumn({
        id: "col_children_status",
        tableId: "tbl_children",
        type: { kind: "enum", enumId: "enum_status" },
        isNullable: true,
      }),
      makeColumn({
        id: "col_children_note",
        tableId: "tbl_children",
        type: { kind: "text" },
        defaultValue: { kind: "literal", value: "none" },
      }),
      makeColumn({
        id: "col_children_counter",
        tableId: "tbl_children",
        isAutoIncrement: true,
      }),
      makeColumn({ id: "col_nodes_id", tableId: "tbl_nodes" }),
      makeColumn({
        id: "col_nodes_parent",
        tableId: "tbl_nodes",
        isNullable: true,
      }),
      makeColumn({
        id: "col_links_parent",
        tableId: "tbl_links",
        isNullable: true,
      }),
      makeColumn({ id: "col_optionals_id", tableId: "tbl_optionals" }),
      makeColumn({
        id: "col_optionals_parent",
        tableId: "tbl_optionals",
        isNullable: true,
      }),
    ],
    relations: [
      makeRelation({
        id: "rel_children_parent",
        fromTableId: "tbl_children",
        toTableId: "tbl_parents",
        columnPairs: [
          { fromColumnId: "col_children_parent", toColumnId: "col_parents_id" },
        ],
      }),
      makeRelation({
        id: "rel_nodes_parent",
        fromTableId: "tbl_nodes",
        toTableId: "tbl_nodes",
        columnPairs: [
          { fromColumnId: "col_nodes_parent", toColumnId: "col_nodes_id" },
        ],
      }),
      makeRelation({
        id: "rel_links_parent",
        fromTableId: "tbl_links",
        toTableId: "tbl_parents",
        columnPairs: [
          { fromColumnId: "col_links_parent", toColumnId: "col_parents_id" },
        ],
      }),
      makeRelation({
        id: "rel_optionals_parent",
        fromTableId: "tbl_optionals",
        toTableId: "tbl_parents",
        columnPairs: [
          {
            fromColumnId: "col_optionals_parent",
            toColumnId: "col_parents_id",
          },
        ],
      }),
    ],
    enums: [makeEnum({ id: "enum_status", values: ["open", "closed"] })],
  });
}

const SCHEMA = createSchema();

const PARENTS: SeedDataset["tables"][number] = {
  tableId: "tbl_parents",
  rows: [{ col_parents_id: 1 }],
};

function child(overrides: SeedRow = {}): SeedRow {
  return { col_children_id: 1, col_children_parent: 1, ...overrides };
}

function withChildren(rows: readonly SeedRow[]): SeedDataset {
  return { tables: [PARENTS, { tableId: "tbl_children", rows }] };
}

describe("validateSeedDataset", () => {
  it.each<[string, SeedRow]>([
    ["col_children_id", { col_children_id: "1" }],
    ["col_children_flag", { col_children_flag: 1 }],
    ["col_children_status", { col_children_status: "lost" }],
    ["col_children_code", { col_children_code: "abcd" }],
  ])(
    "reports seed-value-invalid for a value of the wrong representation in %s",
    (columnId, overrides) => {
      expect(
        validateSeedDataset(SCHEMA, withChildren([child(overrides)])),
      ).toStrictEqual([
        {
          code: "seed-value-invalid",
          path: ["tables", 1, "rows", 0, columnId],
        },
      ]);
    },
  );

  it("reports seed-value-invalid for an unknown table and an unknown column", () => {
    const dataset: SeedDataset = {
      tables: [
        { tableId: "tbl_missing", rows: [{}] },
        { tableId: "tbl_parents", rows: [{ col_parents_id: 1, col_zz: 1 }] },
      ],
    };
    expect(validateSeedDataset(SCHEMA, dataset)).toStrictEqual([
      { code: "seed-value-invalid", path: ["tables", 0, "tableId"] },
      { code: "seed-value-invalid", path: ["tables", 1, "rows", 0, "col_zz"] },
    ]);
  });

  it("reports seed-value-null for null and for a missing required column without default", () => {
    const rows = [child({ col_children_parent: null }), { col_children_id: 2 }];
    expect(validateSeedDataset(SCHEMA, withChildren(rows))).toStrictEqual([
      {
        code: "seed-value-null",
        path: ["tables", 1, "rows", 0, "col_children_parent"],
      },
      {
        code: "seed-value-null",
        path: ["tables", 1, "rows", 1, "col_children_parent"],
      },
    ]);
  });

  // child() leaves out col_children_note (default) and col_children_counter
  // (auto-increment), and the nullable columns.
  it("accepts a missing column that has a default or auto-increment", () => {
    expect(validateSeedDataset(SCHEMA, withChildren([child()]))).toStrictEqual(
      [],
    );
  });

  it("reports seed-identity-partial on each row that omits an auto-increment column another row sets", () => {
    const rows = [
      child(),
      child({ col_children_id: 2, col_children_counter: 5 }),
      child({ col_children_id: 3 }),
    ];
    expect(validateSeedDataset(SCHEMA, withChildren(rows))).toStrictEqual([
      {
        code: "seed-identity-partial",
        path: ["tables", 1, "rows", 0, "col_children_counter"],
      },
      {
        code: "seed-identity-partial",
        path: ["tables", 1, "rows", 2, "col_children_counter"],
      },
    ]);
  });

  it("accepts an auto-increment column that every row sets", () => {
    const rows = [
      child({ col_children_counter: 1 }),
      child({ col_children_id: 2, col_children_counter: 2 }),
    ];
    expect(validateSeedDataset(SCHEMA, withChildren(rows))).toStrictEqual([]);
  });

  it("accepts an auto-increment column that every row omits", () => {
    const rows = [child(), child({ col_children_id: 2 })];
    expect(validateSeedDataset(SCHEMA, withChildren(rows))).toStrictEqual([]);
  });

  it("reports seed-unique-violation on the later row", () => {
    const rows = [
      child({ col_children_code: "a" }),
      child({ col_children_id: 2, col_children_code: "b" }),
      child({ col_children_id: 1, col_children_code: "a" }),
    ];
    expect(validateSeedDataset(SCHEMA, withChildren(rows))).toStrictEqual([
      {
        code: "seed-unique-violation",
        path: ["tables", 1, "rows", 2, "col_children_code"],
      },
      {
        code: "seed-unique-violation",
        path: ["tables", 1, "rows", 2, "col_children_id"],
      },
    ]);
  });

  it("ignores null in unique keys", () => {
    const rows = [
      child({ col_children_code: null }),
      child({ col_children_id: 2, col_children_code: null }),
    ];
    expect(validateSeedDataset(SCHEMA, withChildren(rows))).toStrictEqual([]);
  });

  it("reports seed-foreign-key-missing for a missing parent row and for a parent table absent from the dataset", () => {
    const dataset: SeedDataset = {
      tables: [
        PARENTS,
        { tableId: "tbl_children", rows: [child({ col_children_parent: 9 })] },
      ],
    };
    const withoutParents: SeedDataset = {
      tables: [{ tableId: "tbl_children", rows: [child()] }],
    };
    expect([
      ...validateSeedDataset(SCHEMA, dataset),
      ...validateSeedDataset(SCHEMA, withoutParents),
    ]).toStrictEqual([
      {
        code: "seed-foreign-key-missing",
        path: ["tables", 1, "rows", 0, "col_children_parent"],
      },
      {
        code: "seed-foreign-key-missing",
        path: ["tables", 0, "rows", 0, "col_children_parent"],
      },
    ]);
  });

  it("reports seed-order-invalid for a reference to a later table through a required column", () => {
    const dataset: SeedDataset = {
      tables: [{ tableId: "tbl_children", rows: [child()] }, PARENTS],
    };
    expect(validateSeedDataset(SCHEMA, dataset)).toStrictEqual([
      {
        code: "seed-order-invalid",
        path: ["tables", 0, "rows", 0, "col_children_parent"],
      },
    ]);
  });

  it("accepts a reference to a later table through nullable columns of a table with a primary key", () => {
    const dataset: SeedDataset = {
      tables: [
        {
          tableId: "tbl_optionals",
          rows: [{ col_optionals_id: 1, col_optionals_parent: 1 }],
        },
        PARENTS,
      ],
    };
    expect(validateSeedDataset(SCHEMA, dataset)).toStrictEqual([]);
  });

  it("reports seed-order-invalid for a later table referenced from a table without a primary key", () => {
    const dataset: SeedDataset = {
      tables: [
        { tableId: "tbl_links", rows: [{ col_links_parent: 1 }] },
        PARENTS,
      ],
    };
    expect(validateSeedDataset(SCHEMA, dataset)).toStrictEqual([
      {
        code: "seed-order-invalid",
        path: ["tables", 0, "rows", 0, "col_links_parent"],
      },
    ]);
  });

  it("reports seed-order-invalid for a repeated table and for a self-reference to a later row", () => {
    const dataset: SeedDataset = {
      tables: [
        {
          tableId: "tbl_nodes",
          rows: [
            { col_nodes_id: 1, col_nodes_parent: 2 },
            { col_nodes_id: 2, col_nodes_parent: null },
          ],
        },
        PARENTS,
        PARENTS,
      ],
    };
    expect(validateSeedDataset(SCHEMA, dataset)).toStrictEqual([
      {
        code: "seed-order-invalid",
        path: ["tables", 0, "rows", 0, "col_nodes_parent"],
      },
      { code: "seed-order-invalid", path: ["tables", 2, "tableId"] },
    ]);
  });

  it("accepts a self-reference to the same row and to an earlier row", () => {
    const dataset: SeedDataset = {
      tables: [
        {
          tableId: "tbl_nodes",
          rows: [
            { col_nodes_id: 1, col_nodes_parent: 1 },
            { col_nodes_id: 2, col_nodes_parent: 1 },
          ],
        },
      ],
    };
    expect(validateSeedDataset(SCHEMA, dataset)).toStrictEqual([]);
  });

  it("returns issues sorted by path then code", () => {
    const rows = [
      child({ col_children_parent: 9, col_children_flag: "yes" }),
      { col_children_id: "x" },
    ];
    expect(validateSeedDataset(SCHEMA, withChildren(rows))).toStrictEqual([
      {
        code: "seed-value-invalid",
        path: ["tables", 1, "rows", 0, "col_children_flag"],
      },
      {
        code: "seed-foreign-key-missing",
        path: ["tables", 1, "rows", 0, "col_children_parent"],
      },
      {
        code: "seed-value-invalid",
        path: ["tables", 1, "rows", 1, "col_children_id"],
      },
      {
        code: "seed-value-null",
        path: ["tables", 1, "rows", 1, "col_children_parent"],
      },
    ]);
  });

  it("does not throw for a dataset that mentions nothing in the schema", () => {
    const dataset: SeedDataset = {
      tables: [
        { tableId: "tbl_x", rows: [{ col_x: 1 }, {}] },
        { tableId: "tbl_x", rows: [] },
      ],
    };
    expect(validateSeedDataset(SCHEMA, dataset)).toStrictEqual([
      { code: "seed-value-invalid", path: ["tables", 0, "tableId"] },
      { code: "seed-value-invalid", path: ["tables", 1, "tableId"] },
    ]);
  });
});

describe("findDeferredSeedRelations", () => {
  it("returns relations whose target table is loaded later", () => {
    const dataset: SeedDataset = {
      tables: [
        { tableId: "tbl_optionals", rows: [] },
        { tableId: "tbl_children", rows: [] },
        PARENTS,
      ],
    };
    expect(findDeferredSeedRelations(SCHEMA, dataset)).toStrictEqual([
      "rel_children_parent",
      "rel_optionals_parent",
    ]);
  });

  it("ignores self-references and tables absent from the dataset", () => {
    const dataset: SeedDataset = {
      tables: [{ tableId: "tbl_nodes", rows: [] }],
    };
    expect(findDeferredSeedRelations(SCHEMA, dataset)).toStrictEqual([]);
  });
});
