import { applyOperation, validateSchema } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
  unwrapOk,
} from "@schemaforge/core/testing";
import { describe, expect, it, vi } from "vitest";

import type { Logger } from "@/lib/logger";
import type { Notify } from "@/lib/notify";

import { createEditorStore } from "../state/create-editor-store";
import {
  buildRelationOperation,
  validateRelationDraft,
} from "./build-relation-operation";
import type { RelationDraft } from "./to-relation-draft";

type DocumentOptions = {
  readonly userKeyColumnIds?: readonly ("col_users_id" | "col_users_tenant")[];
  readonly userIdType?: "integer" | "text";
};

function createDocument(options: DocumentOptions = {}): SchemaDocument {
  return buildSchema({
    tables: [
      makeTable({
        id: "tbl_users",
        name: "users",
        position: { x: 0, y: 100 },
        primaryKeyColumnIds: options.userKeyColumnIds ?? ["col_users_id"],
      }),
      makeTable({
        id: "tbl_orders",
        name: "orders",
        position: { x: 400, y: 300 },
        primaryKeyColumnIds: ["col_orders_id"],
      }),
    ],
    columns: [
      makeColumn({
        id: "col_users_id",
        tableId: "tbl_users",
        name: "id",
        type: { kind: options.userIdType ?? "integer" },
      }),
      makeColumn({
        id: "col_users_tenant",
        tableId: "tbl_users",
        name: "tenant",
      }),
      makeColumn({ id: "col_orders_id", tableId: "tbl_orders", name: "id" }),
      makeColumn({
        id: "col_orders_user_id",
        tableId: "tbl_orders",
        name: "user_id",
      }),
      makeColumn({
        id: "col_orders_note",
        tableId: "tbl_orders",
        name: "note",
      }),
    ],
  });
}

function makeDraft(overrides: Partial<RelationDraft> = {}): RelationDraft {
  return {
    fromTableId: "tbl_orders",
    toTableId: "tbl_users",
    kind: "oneToMany",
    foreignKeyMode: "new-columns",
    referencedColumnIds: ["col_users_id"],
    columnPairs: [],
    junctionTableName: "orders_users",
    onDelete: "noAction",
    onUpdate: "noAction",
    ...overrides,
  };
}

const EXISTING_PAIR = {
  fromColumnId: "col_orders_user_id",
  toColumnId: "col_users_id",
} as const;

function applyDraft(
  document: SchemaDocument,
  draft: RelationDraft,
): SchemaDocument {
  const operation = unwrapOk(
    buildRelationOperation(document, draft, createCounterIdGenerator()),
  );
  return unwrapOk(applyOperation(document, operation)).schema;
}

describe("validateRelationDraft", () => {
  it("reports a missing primary key on the referenced columns", () => {
    const document = createDocument({ userKeyColumnIds: [] });

    expect(
      validateRelationDraft(document, makeDraft({ referencedColumnIds: [] })),
    ).toStrictEqual([
      { field: "referencedColumnIds", reason: "primary-key-missing" },
    ]);
  });

  it("reports a missing primary key of either table for many-to-many", () => {
    const document = createDocument({ userKeyColumnIds: [] });

    expect(
      validateRelationDraft(document, makeDraft({ kind: "manyToMany" })),
    ).toStrictEqual([
      { field: "referencedColumnIds", reason: "primary-key-missing" },
    ]);
  });

  it("reports an unmatched referenced column", () => {
    const draft = makeDraft({
      foreignKeyMode: "existing-columns",
      referencedColumnIds: ["col_users_id", "col_users_tenant"],
      columnPairs: [EXISTING_PAIR],
    });

    expect(validateRelationDraft(createDocument(), draft)).toStrictEqual([
      { field: "columnPairs", reason: "unmatched-column" },
    ]);
  });

  it("reports the same column chosen twice", () => {
    const draft = makeDraft({
      foreignKeyMode: "existing-columns",
      referencedColumnIds: ["col_users_id", "col_users_tenant"],
      columnPairs: [
        EXISTING_PAIR,
        { fromColumnId: "col_orders_user_id", toColumnId: "col_users_tenant" },
      ],
    });

    expect(validateRelationDraft(createDocument(), draft)).toStrictEqual([
      { field: "columnPairs", reason: "duplicate-column" },
    ]);
  });

  it.each(["new-columns", "existing-columns"] as const)(
    "reports a referenced column chosen twice with %s",
    (foreignKeyMode) => {
      const draft = makeDraft({
        foreignKeyMode,
        referencedColumnIds: ["col_users_id", "col_users_id"],
        columnPairs: [EXISTING_PAIR],
      });

      expect(validateRelationDraft(createDocument(), draft)).toContainEqual({
        field: "referencedColumnIds",
        reason: "duplicate-column",
      });
    },
  );

  it("does not block a type mismatch", () => {
    const draft = makeDraft({
      foreignKeyMode: "existing-columns",
      columnPairs: [EXISTING_PAIR],
    });

    expect(
      validateRelationDraft(createDocument({ userIdType: "text" }), draft),
    ).toStrictEqual([]);
  });
});

describe("buildRelationOperation", () => {
  it("builds one addRelation for existing columns", () => {
    const draft = makeDraft({
      foreignKeyMode: "existing-columns",
      columnPairs: [EXISTING_PAIR],
    });

    const result = buildRelationOperation(
      createDocument(),
      draft,
      createCounterIdGenerator(),
    );

    expect(result).toStrictEqual({
      isOk: true,
      value: {
        type: "addRelation",
        relation: {
          id: "rel_1",
          kind: "oneToMany",
          fromTableId: "tbl_orders",
          toTableId: "tbl_users",
          columnPairs: [EXISTING_PAIR],
          onDelete: "noAction",
          onUpdate: "noAction",
        },
      },
    });
  });

  it("delegates to buildRelation for new columns", () => {
    const schema = applyDraft(createDocument(), makeDraft());

    expect(schema.relations).toMatchObject({
      rel_2: {
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: [{ fromColumnId: "col_1", toColumnId: "col_users_id" }],
      },
    });
    expect(schema.columns.col_1).toMatchObject({
      tableId: "tbl_orders",
      name: "users_id",
      isUnique: false,
    });
  });

  it("references the dropped column when creating new columns", () => {
    const document = buildSchema({
      tables: [
        makeTable({
          id: "tbl_users",
          name: "users",
          primaryKeyColumnIds: ["col_users_id"],
        }),
        makeTable({ id: "tbl_orders", name: "orders" }),
      ],
      columns: [
        makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
        makeColumn({
          id: "col_users_email",
          tableId: "tbl_users",
          name: "email",
          type: { kind: "text" },
          isUnique: true,
        }),
      ],
    });

    const schema = applyDraft(
      document,
      makeDraft({ referencedColumnIds: ["col_users_email"] }),
    );

    expect(Object.values(schema.relations)).toMatchObject([
      {
        columnPairs: [{ fromColumnId: "col_1", toColumnId: "col_users_email" }],
      },
    ]);
    expect(schema.columns.col_1).toMatchObject({
      tableId: "tbl_orders",
      name: "users_email",
      type: { kind: "text" },
    });
  });

  it("creates new columns against a target without a primary key", () => {
    const document = createDocument({ userKeyColumnIds: [] });

    const schema = applyDraft(
      document,
      makeDraft({ referencedColumnIds: ["col_users_tenant"] }),
    );

    expect(Object.values(schema.relations)).toMatchObject([
      {
        columnPairs: [
          { fromColumnId: "col_1", toColumnId: "col_users_tenant" },
        ],
      },
    ]);
  });

  it("reports a referenced column of another table from core", () => {
    const result = buildRelationOperation(
      createDocument(),
      makeDraft({ referencedColumnIds: ["col_orders_note"] }),
      createCounterIdGenerator(),
    );

    expect(result).toStrictEqual({
      isOk: false,
      error: {
        code: "column-not-in-table",
        path: ["referencedColumnIds", 0],
      },
    });
  });

  it("marks a single new column unique for a one-to-one relation", () => {
    const schema = applyDraft(
      createDocument(),
      makeDraft({ kind: "oneToOne" }),
    );

    expect(schema.columns.col_1?.isUnique).toBe(true);
    expect(validateSchema(schema)).toStrictEqual([]);
  });

  it("adds a unique index for a composite one-to-one relation", () => {
    const document = createDocument({
      userKeyColumnIds: ["col_users_id", "col_users_tenant"],
    });

    // A draft prefilled from the table handle references the whole key.
    const schema = applyDraft(
      document,
      makeDraft({
        kind: "oneToOne",
        referencedColumnIds: ["col_users_id", "col_users_tenant"],
      }),
    );

    expect(Object.values(schema.indexes)).toMatchObject([
      { tableId: "tbl_orders", columnIds: ["col_1", "col_2"], isUnique: true },
    ]);
  });

  it("delegates to buildManyToMany", () => {
    const schema = applyDraft(
      createDocument(),
      makeDraft({ kind: "manyToMany", junctionTableName: "user_orders" }),
    );

    expect(schema.tables.tbl_1).toMatchObject({
      name: "user_orders",
      position: { x: 200, y: 200 },
    });
    expect(Object.values(schema.relations)).toHaveLength(2);
  });

  it("reports a missing table", () => {
    const result = buildRelationOperation(
      createDocument(),
      makeDraft({ fromTableId: "tbl_missing" }),
      createCounterIdGenerator(),
    );

    expect(result).toStrictEqual({
      isOk: false,
      error: { code: "table-not-found", path: ["fromTableId"] },
    });
  });

  it("undoes a many-to-many relation in one step", () => {
    const document = createDocument();
    const store = createEditorStore({
      schemaId: "0b7d4c1e-2f3a-4b5c-8d6e-7f8091a2b3c4",
      document,
      generateId: createCounterIdGenerator(),
      notify: vi.fn<Notify>(),
      logger: {
        error: vi.fn<Logger["error"]>(),
        warn: vi.fn<Logger["warn"]>(),
      },
    });
    const operation = unwrapOk(
      buildRelationOperation(
        document,
        makeDraft({ kind: "manyToMany" }),
        createCounterIdGenerator(),
      ),
    );

    store.getState().dispatch(operation);
    store.getState().undo();

    expect(store.getState().document).toStrictEqual(document);
    expect(store.getState().history.future).toHaveLength(1);
  });
});
