import { describe, expect, it } from "vitest";

import type { DocumentPath } from "../../document-path.js";
import { createImportTestOptions } from "../../testing/import-test-options.js";
import { TEST_LAYOUT_METRICS } from "../../testing/import-test-options.js";
import { unwrapError, unwrapOk } from "../../testing/unwrap-result.js";
import { assembleDocument } from "./assemble-document.js";
import type {
  DraftColumn,
  DraftIndex,
  DraftRelation,
  DraftTable,
  DraftTarget,
  ImportDraft,
} from "./import-draft.js";
import { MAX_IMPORTED_ELEMENTS } from "./import-limits.js";
import type { SourceLocation } from "./import-types.js";
import { placeElements } from "./place-elements.js";

function at(line: number): SourceLocation {
  return { line, column: 1 };
}

function makeDraftColumn(
  overrides: Partial<DraftColumn> & Pick<DraftColumn, "name">,
): DraftColumn {
  return {
    type: { kind: "integer" },
    isNullable: false,
    isUnique: false,
    isAutoIncrement: false,
    defaultValue: null,
    comment: "",
    location: null,
    ...overrides,
  };
}

function makeDraftTable(
  overrides: Partial<DraftTable> & Pick<DraftTable, "name">,
): DraftTable {
  return {
    comment: "",
    subjectAreaName: null,
    columns: [],
    primaryKeyColumnNames: [],
    location: null,
    ...overrides,
  };
}

function makeDraftIndex(overrides: Partial<DraftIndex> = {}): DraftIndex {
  return {
    tableName: "orders",
    name: "orders_user_idx",
    columnNames: ["user_id"],
    isUnique: false,
    location: at(20),
    ...overrides,
  };
}

function makeDraftRelation(
  overrides: Partial<DraftRelation> = {},
): DraftRelation {
  return {
    fromTableName: "orders",
    toTableName: "users",
    columnPairs: [{ fromColumnName: "user_id", toColumnName: "id" }],
    kind: "oneToMany",
    onDelete: "noAction",
    onUpdate: "noAction",
    location: at(30),
    ...overrides,
  };
}

function makeUsersTable(overrides: Partial<DraftTable> = {}): DraftTable {
  return makeDraftTable({
    name: "users",
    subjectAreaName: "Sales",
    columns: [
      makeDraftColumn({ name: "id", location: at(2) }),
      makeDraftColumn({
        name: "status",
        type: { kind: "enum", enumName: "status" },
        location: at(3),
      }),
    ],
    primaryKeyColumnNames: ["id"],
    location: at(1),
    ...overrides,
  });
}

function makeOrdersTable(overrides: Partial<DraftTable> = {}): DraftTable {
  return makeDraftTable({
    name: "orders",
    columns: [
      makeDraftColumn({ name: "id", location: at(11) }),
      makeDraftColumn({ name: "user_id", location: at(12) }),
    ],
    primaryKeyColumnNames: ["id"],
    location: at(10),
    ...overrides,
  });
}

// Counter ids: enum_1, tbl_2 users, tbl_3 orders, col_4 to col_7, idx_8,
// rel_9, area_10, note_11.
function makeShopDraft(overrides: Partial<ImportDraft> = {}): ImportDraft {
  return {
    name: "Shop",
    tables: [makeUsersTable(), makeOrdersTable()],
    indexes: [makeDraftIndex()],
    relations: [makeDraftRelation()],
    enums: [{ name: "status", values: ["active"], location: at(40) }],
    subjectAreas: [{ name: "Sales", location: at(50) }],
    notes: [{ text: "Remember", location: at(60) }],
    diagnostics: [],
    ...overrides,
  };
}

function makeEmptyDraft(overrides: Partial<ImportDraft> = {}): ImportDraft {
  return makeShopDraft({
    name: null,
    tables: [],
    indexes: [],
    relations: [],
    enums: [],
    subjectAreas: [],
    notes: [],
    ...overrides,
  });
}

function makeEnums(count: number): ImportDraft["enums"] {
  return Array.from({ length: count }, (_, index) => ({
    name: `enum${String(index)}`,
    values: [],
    location: null,
  }));
}

function assemble(draft: ImportDraft): ReturnType<typeof assembleDocument> {
  return assembleDocument(draft, createImportTestOptions());
}

const REFERENCE_NOT_FOUND = "reference-not-found";
const UNNAMED_INDEX_COUNT = 5000;

describe("assembleDocument", () => {
  it("assigns ids in the documented order", () => {
    const { document } = unwrapOk(assemble(makeShopDraft()));

    expect(document).toStrictEqual({
      version: 1,
      name: "Shop",
      tables: {
        tbl_2: {
          id: "tbl_2",
          name: "users",
          comment: "",
          position: { x: 0, y: 0 },
          subjectAreaId: "area_10",
          columnIds: ["col_4", "col_5"],
          primaryKeyColumnIds: ["col_4"],
        },
        tbl_3: {
          id: "tbl_3",
          name: "orders",
          comment: "",
          position: { x: 0, y: 176 },
          subjectAreaId: null,
          columnIds: ["col_6", "col_7"],
          primaryKeyColumnIds: ["col_6"],
        },
      },
      columns: {
        col_4: {
          id: "col_4",
          tableId: "tbl_2",
          name: "id",
          type: { kind: "integer" },
          isNullable: false,
          defaultValue: null,
          isUnique: false,
          isAutoIncrement: false,
          comment: "",
        },
        col_5: {
          id: "col_5",
          tableId: "tbl_2",
          name: "status",
          type: { kind: "enum", enumId: "enum_1" },
          isNullable: false,
          defaultValue: null,
          isUnique: false,
          isAutoIncrement: false,
          comment: "",
        },
        col_6: {
          id: "col_6",
          tableId: "tbl_3",
          name: "id",
          type: { kind: "integer" },
          isNullable: false,
          defaultValue: null,
          isUnique: false,
          isAutoIncrement: false,
          comment: "",
        },
        col_7: {
          id: "col_7",
          tableId: "tbl_3",
          name: "user_id",
          type: { kind: "integer" },
          isNullable: false,
          defaultValue: null,
          isUnique: false,
          isAutoIncrement: false,
          comment: "",
        },
      },
      relations: {
        rel_9: {
          id: "rel_9",
          kind: "oneToMany",
          fromTableId: "tbl_3",
          toTableId: "tbl_2",
          columnPairs: [{ fromColumnId: "col_7", toColumnId: "col_4" }],
          onDelete: "noAction",
          onUpdate: "noAction",
        },
      },
      indexes: {
        idx_8: {
          id: "idx_8",
          tableId: "tbl_3",
          name: "orders_user_idx",
          columnIds: ["col_7"],
          isUnique: false,
        },
      },
      enums: { enum_1: { id: "enum_1", name: "status", values: ["active"] } },
      subjectAreas: { area_10: { id: "area_10", name: "Sales" } },
      notes: {
        note_11: {
          id: "note_11",
          text: "Remember",
          position: { x: 0, y: 352 },
        },
      },
    });
  });

  it("returns no diagnostics for a draft whose references all resolve", () => {
    const { diagnostics } = unwrapOk(assemble(makeShopDraft()));

    expect(diagnostics).toStrictEqual([]);
  });

  it("gives the same document for the same draft and id generator", () => {
    expect(assemble(makeShopDraft())).toStrictEqual(assemble(makeShopDraft()));
  });

  it("uses the fallback schema name when the draft has none", () => {
    const { document } = unwrapOk(assemble(makeEmptyDraft()));

    expect(document.name).toBe("Imported");
  });

  it("resolves references that differ only in letter case", () => {
    const draft = makeShopDraft({
      relations: [
        makeDraftRelation({
          toTableName: "USERS",
          columnPairs: [{ fromColumnName: "User_Id", toColumnName: "ID" }],
        }),
      ],
    });

    const { document } = unwrapOk(assemble(draft));

    expect(document.relations.rel_9?.columnPairs).toStrictEqual([
      { fromColumnId: "col_7", toColumnId: "col_4" },
    ]);
  });

  it("drops a relation with an unknown column and reports reference-not-found at its location", () => {
    const draft = makeShopDraft({
      relations: [
        makeDraftRelation({
          columnPairs: [{ fromColumnName: "user_id", toColumnName: "uuid" }],
        }),
      ],
    });

    const { document, diagnostics } = unwrapOk(assemble(draft));

    expect({ relations: document.relations, diagnostics }).toStrictEqual({
      relations: {},
      diagnostics: [
        { code: REFERENCE_NOT_FOUND, location: at(30), path: null },
      ],
    });
  });

  it.each([
    ["from", { fromTableName: "payments" }],
    ["to", { toTableName: "customers" }],
  ])(
    "drops a relation with an unknown %s table",
    (_side, overrides: Partial<DraftRelation>) => {
      const draft = makeShopDraft({
        relations: [makeDraftRelation(overrides)],
      });

      const { document, diagnostics } = unwrapOk(assemble(draft));

      expect({ relations: document.relations, diagnostics }).toStrictEqual({
        relations: {},
        diagnostics: [
          { code: REFERENCE_NOT_FOUND, location: at(30), path: null },
        ],
      });
    },
  );

  it.each([
    ["table", { tableName: "payments" }],
    ["column", { columnNames: ["user_id", "total"] }],
  ])(
    "drops an index with an unknown %s and reports reference-not-found",
    (_reference, overrides: Partial<DraftIndex>) => {
      const draft = makeShopDraft({ indexes: [makeDraftIndex(overrides)] });

      const { document, diagnostics } = unwrapOk(assemble(draft));

      expect({ indexes: document.indexes, diagnostics }).toStrictEqual({
        indexes: {},
        diagnostics: [
          { code: REFERENCE_NOT_FOUND, location: at(20), path: null },
        ],
      });
    },
  );

  it("drops a primary key with an unknown column but keeps the table", () => {
    const draft = makeShopDraft({
      tables: [
        makeUsersTable({ primaryKeyColumnNames: ["id", "tenant_id"] }),
        makeOrdersTable(),
      ],
    });

    const { document, diagnostics } = unwrapOk(assemble(draft));

    expect({ table: document.tables.tbl_2, diagnostics }).toStrictEqual({
      table: {
        id: "tbl_2",
        name: "users",
        comment: "",
        position: { x: 0, y: 0 },
        subjectAreaId: "area_10",
        columnIds: ["col_4", "col_5"],
        primaryKeyColumnIds: [],
      },
      diagnostics: [{ code: REFERENCE_NOT_FOUND, location: at(1), path: null }],
    });
  });

  it("drops a column whose enum is unknown and reports reference-not-found at its location", () => {
    const draft = makeShopDraft({ enums: [] });

    const { document, diagnostics } = unwrapOk(assemble(draft));

    expect({
      columnIds: document.tables.tbl_1?.columnIds,
      diagnostics,
    }).toStrictEqual({
      columnIds: ["col_3"],
      diagnostics: [{ code: REFERENCE_NOT_FOUND, location: at(3), path: null }],
    });
  });

  it("drops an index on a column that was dropped for its unknown enum", () => {
    const draft = makeShopDraft({
      enums: [],
      indexes: [
        makeDraftIndex({ tableName: "users", columnNames: ["status"] }),
      ],
    });

    const { document, diagnostics } = unwrapOk(assemble(draft));

    expect({ indexes: document.indexes, diagnostics }).toStrictEqual({
      indexes: {},
      diagnostics: [
        { code: REFERENCE_NOT_FOUND, location: at(3), path: null },
        { code: REFERENCE_NOT_FOUND, location: at(20), path: null },
      ],
    });
  });

  it("keeps a table with an unknown subject area outside any area and reports reference-not-found", () => {
    const draft = makeShopDraft({ subjectAreas: [] });

    const { document, diagnostics } = unwrapOk(assemble(draft));

    expect({
      subjectAreaId: document.tables.tbl_2?.subjectAreaId,
      diagnostics,
    }).toStrictEqual({
      subjectAreaId: null,
      diagnostics: [{ code: REFERENCE_NOT_FOUND, location: at(1), path: null }],
    });
  });

  it("suggests a name for an index without one from the resolved names", () => {
    const draft = makeShopDraft({
      indexes: [makeDraftIndex({ name: null, columnNames: ["USER_ID"] })],
    });

    const { document } = unwrapOk(assemble(draft));

    expect(document.indexes.idx_8?.name).toBe("orders_user_id_idx");
  });

  it("suggests index names in draft order so a later name avoids an earlier one", () => {
    const draft = makeShopDraft({
      indexes: [makeDraftIndex({ name: null }), makeDraftIndex({ name: null })],
    });

    const { document } = unwrapOk(assemble(draft));

    expect([
      document.indexes.idx_8?.name,
      document.indexes.idx_9?.name,
    ]).toStrictEqual(["orders_user_id_idx", "orders_user_id_idx2"]);
  });

  // Each name resumes the number search of the one before it; restarting at 2
  // every time took about 15 s for this draft.
  it("names 5000 unnamed indexes on one column distinctly in draft order", () => {
    const draft = makeShopDraft({
      indexes: Array.from({ length: UNNAMED_INDEX_COUNT }, () =>
        makeDraftIndex({ name: null }),
      ),
    });

    const names = Object.values(unwrapOk(assemble(draft)).document.indexes).map(
      (index) => index.name,
    );

    expect(names).toStrictEqual([
      "orders_user_id_idx",
      ...Array.from(
        { length: UNNAMED_INDEX_COUNT - 1 },
        (_, position) => `orders_user_id_idx${String(position + 2)}`,
      ),
    ]);
  });

  it("places tables through placeElements", () => {
    const draft = makeShopDraft({
      enums: [],
      subjectAreas: [{ name: "sales", location: null }],
      notes: [],
    });
    const expected = placeElements(
      {
        tables: [
          { columnCount: 1, subjectAreaName: "sales" },
          { columnCount: 2, subjectAreaName: null },
        ],
        noteCount: 0,
      },
      TEST_LAYOUT_METRICS,
    );

    const { document } = unwrapOk(assemble(draft));

    expect(
      Object.values(document.tables).map((table) => table.position),
    ).toStrictEqual(expected.tables);
  });

  it.each<[string, DraftTarget, DocumentPath]>([
    ["table", { kind: "table", tableIndex: 1 }, ["tables", "tbl_3"]],
    [
      "table field",
      { kind: "table", tableIndex: 1, field: "name" },
      ["tables", "tbl_3", "name"],
    ],
    [
      "column field",
      { kind: "column", tableIndex: 1, columnIndex: 1, field: "type" },
      ["columns", "col_7", "type"],
    ],
    ["index", { kind: "index", index: 0 }, ["indexes", "idx_8"]],
    ["relation", { kind: "relation", index: 0 }, ["relations", "rel_9"]],
    ["enum", { kind: "enum", index: 0 }, ["enums", "enum_1"]],
    [
      "subject area",
      { kind: "subjectArea", index: 0 },
      ["subjectAreas", "area_10"],
    ],
    ["note", { kind: "note", index: 0 }, ["notes", "note_11"]],
  ])(
    "maps a diagnostic target to the element path (%s)",
    (_kind, target, path) => {
      const draft = makeShopDraft({
        diagnostics: [{ code: "type-approximated", location: at(5), target }],
      });

      const { diagnostics } = unwrapOk(assemble(draft));

      expect(diagnostics).toStrictEqual([
        { code: "type-approximated", location: at(5), path },
      ]);
    },
  );

  it("maps a missing diagnostic target to a null path", () => {
    const draft = makeShopDraft({
      diagnostics: [
        { code: "view-not-supported", location: at(5), target: null },
      ],
    });

    const { diagnostics } = unwrapOk(assemble(draft));

    expect(diagnostics).toStrictEqual([
      { code: "view-not-supported", location: at(5), path: null },
    ]);
  });

  it.each<[string, DraftTarget]>([
    ["column", { kind: "column", tableIndex: 0, columnIndex: 1 }],
    ["relation", { kind: "relation", index: 0 }],
  ])(
    "maps a diagnostic target on a dropped %s to a null path",
    (_kind, target) => {
      const draft = makeShopDraft({
        enums: [],
        relations: [makeDraftRelation({ toTableName: "customers" })],
        diagnostics: [{ code: "type-approximated", location: at(99), target }],
      });

      const { diagnostics } = unwrapOk(assemble(draft));

      expect(diagnostics).toContainEqual({
        code: "type-approximated",
        location: at(99),
        path: null,
      });
    },
  );

  it("sorts and deduplicates the diagnostics", () => {
    const repeated = {
      code: "view-not-supported",
      location: at(9),
      target: null,
    } as const;
    const draft = makeShopDraft({
      diagnostics: [
        repeated,
        { code: "routine-not-supported", location: at(2), target: null },
        repeated,
      ],
    });

    const { diagnostics } = unwrapOk(assemble(draft));

    expect(diagnostics).toStrictEqual([
      { code: "routine-not-supported", location: at(2), path: null },
      { code: "view-not-supported", location: at(9), path: null },
    ]);
  });

  it("accepts a draft with exactly the element limit", () => {
    const draft = makeEmptyDraft({
      enums: makeEnums(MAX_IMPORTED_ELEMENTS - 2),
      tables: [
        makeDraftTable({
          name: "t",
          columns: [makeDraftColumn({ name: "c" })],
        }),
      ],
    });

    expect(assemble(draft).isOk).toBe(true);
  });

  it("reports too-many-elements one element over the limit", () => {
    const draft = makeEmptyDraft({
      enums: makeEnums(MAX_IMPORTED_ELEMENTS - 1),
      tables: [
        makeDraftTable({
          name: "t",
          columns: [makeDraftColumn({ name: "c" })],
        }),
      ],
    });

    expect(unwrapError(assemble(draft))).toStrictEqual({
      diagnostics: [{ code: "too-many-elements", location: null, path: null }],
    });
  });

  it("keeps the first occurrence of a column repeated in a primary key", () => {
    const draft = makeShopDraft({
      tables: [
        makeUsersTable({ primaryKeyColumnNames: ["id", "ID"] }),
        makeOrdersTable(),
      ],
    });

    const { document, diagnostics } = unwrapOk(assemble(draft));

    expect({
      primaryKeyColumnIds: document.tables.tbl_2?.primaryKeyColumnIds,
      diagnostics,
    }).toStrictEqual({ primaryKeyColumnIds: ["col_4"], diagnostics: [] });
  });

  it("keeps the first occurrence of a column repeated in an index", () => {
    const draft = makeShopDraft({
      indexes: [makeDraftIndex({ columnNames: ["user_id", "id", "USER_ID"] })],
    });

    const { document, diagnostics } = unwrapOk(assemble(draft));

    expect({
      columnIds: document.indexes.idx_8?.columnIds,
      diagnostics,
    }).toStrictEqual({ columnIds: ["col_7", "col_6"], diagnostics: [] });
  });

  it("removes a repeated column pair from a relation", () => {
    const draft = makeShopDraft({
      relations: [
        makeDraftRelation({
          columnPairs: [
            { fromColumnName: "user_id", toColumnName: "id" },
            { fromColumnName: "USER_ID", toColumnName: "ID" },
          ],
        }),
      ],
    });

    const { document, diagnostics } = unwrapOk(assemble(draft));

    expect({
      columnPairs: document.relations.rel_9?.columnPairs,
      diagnostics,
    }).toStrictEqual({
      columnPairs: [{ fromColumnId: "col_7", toColumnId: "col_4" }],
      diagnostics: [],
    });
  });

  it.each([
    [
      "from",
      [
        { fromColumnName: "user_id", toColumnName: "id" },
        { fromColumnName: "user_id", toColumnName: "status" },
      ],
    ],
    [
      "to",
      [
        { fromColumnName: "user_id", toColumnName: "id" },
        { fromColumnName: "id", toColumnName: "id" },
      ],
    ],
  ])(
    "drops a relation that uses a %s column in two pairs and reports reference-not-found",
    (_side, columnPairs: DraftRelation["columnPairs"]) => {
      const draft = makeShopDraft({
        relations: [makeDraftRelation({ columnPairs })],
      });

      const { document, diagnostics } = unwrapOk(assemble(draft));

      expect({ relations: document.relations, diagnostics }).toStrictEqual({
        relations: {},
        diagnostics: [
          { code: REFERENCE_NOT_FOUND, location: at(30), path: null },
        ],
      });
    },
  );

  it("drops an index without columns and leaves its diagnostic to the format importer", () => {
    const draft = makeShopDraft({
      indexes: [makeDraftIndex({ columnNames: [] })],
    });

    const { document, diagnostics } = unwrapOk(assemble(draft));

    expect({ indexes: document.indexes, diagnostics }).toStrictEqual({
      indexes: {},
      diagnostics: [],
    });
  });

  it("drops a relation without column pairs and leaves its diagnostic to the format importer", () => {
    const draft = makeShopDraft({
      relations: [makeDraftRelation({ columnPairs: [] })],
    });

    const { document, diagnostics } = unwrapOk(assemble(draft));

    expect({ relations: document.relations, diagnostics }).toStrictEqual({
      relations: {},
      diagnostics: [],
    });
  });

  it("maps a diagnostic target on an index dropped for having no columns to a null path", () => {
    const draft = makeShopDraft({
      indexes: [makeDraftIndex({ columnNames: [] })],
      diagnostics: [
        {
          code: "index-expression-not-supported",
          location: at(20),
          target: { kind: "index", index: 0 },
        },
      ],
    });

    const { diagnostics } = unwrapOk(assemble(draft));

    expect(diagnostics).toStrictEqual([
      { code: "index-expression-not-supported", location: at(20), path: null },
    ]);
  });

  // Importers never throw: a draft the importer got wrong still yields a
  // Result, as an exception from a parser library does.
  it("returns parse-failed when the draft holds a value outside the model shape", () => {
    const draft = makeEmptyDraft({
      tables: [
        makeDraftTable({
          name: "prices",
          columns: [
            makeDraftColumn({
              name: "amount",
              type: { kind: "decimal", precision: 0, scale: 0 },
            }),
          ],
        }),
      ],
    });

    expect(unwrapError(assemble(draft))).toStrictEqual({
      diagnostics: [{ code: "parse-failed", location: null, path: null }],
    });
  });

  it("returns parse-failed when a diagnostic target points past the draft", () => {
    const draft = makeShopDraft({
      diagnostics: [
        {
          code: "type-approximated",
          location: null,
          target: { kind: "table", tableIndex: 5 },
        },
      ],
    });

    expect(unwrapError(assemble(draft))).toStrictEqual({
      diagnostics: [{ code: "parse-failed", location: null, path: null }],
    });
  });
});
