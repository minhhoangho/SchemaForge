import { describe, expect, it } from "vitest";

import { createEmptySchema } from "../model/create-empty-schema.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { applyOperation } from "../operations/apply-operation.js";
import type { Operation, OperationType } from "../operations/operation.js";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeIndex,
  makeNote,
  makeRelation,
  makeSubjectArea,
  makeTable,
} from "./factories.js";
import type { OperationPlan } from "./operation-plans.js";
import { STEP_OPERATION_TYPES, resolveOperation } from "./operation-plans.js";

// Two keyed tables with a relation, an index, an enum in use, an unused enum,
// a subject area and a note, so every kind of element can be picked.
function buildShopSchema(): SchemaDocument {
  return buildSchema({
    name: "shop",
    tables: [
      makeTable({
        id: "tbl_users",
        subjectAreaId: "area_sales",
        primaryKeyColumnIds: ["col_users_id"],
      }),
      makeTable({ id: "tbl_orders", primaryKeyColumnIds: ["col_orders_id"] }),
    ],
    columns: [
      makeColumn({ id: "col_users_id", tableId: "tbl_users" }),
      makeColumn({ id: "col_users_email", tableId: "tbl_users" }),
      makeColumn({
        id: "col_users_status",
        tableId: "tbl_users",
        type: { kind: "enum", enumId: "enum_status" },
      }),
      makeColumn({ id: "col_orders_id", tableId: "tbl_orders" }),
      makeColumn({ id: "col_orders_user_id", tableId: "tbl_orders" }),
    ],
    relations: [
      makeRelation({
        id: "rel_orders_user",
        fromTableId: "tbl_orders",
        toTableId: "tbl_users",
        columnPairs: [
          { fromColumnId: "col_orders_user_id", toColumnId: "col_users_id" },
        ],
      }),
    ],
    indexes: [
      makeIndex({
        id: "idx_users_email",
        tableId: "tbl_users",
        columnIds: ["col_users_email"],
      }),
    ],
    enums: [makeEnum({ id: "enum_status" }), makeEnum({ id: "enum_unused" })],
    subjectAreas: [makeSubjectArea({ id: "area_sales" })],
    notes: [makeNote({ id: "note_todo" })],
  });
}

function makePlan(
  overrides: Partial<OperationPlan> & Pick<OperationPlan, "type">,
): OperationPlan {
  return {
    picks: [0, 0, 0, 0, 0, 0],
    text: "name",
    flags: [false, false, false, false],
    isCorrupted: false,
    steps: [],
    ...overrides,
  };
}

const CORRUPTION_VARIANTS = [0, 1, 2, 3];

const PLAN_TYPES: readonly OperationType[] = [...STEP_OPERATION_TYPES, "batch"];

// Every type with every corruption variant; the batch plans start with a
// buildManyToMany batch on even variants and carry two steps.
function buildCorruptedPlans(): readonly (readonly [string, OperationPlan])[] {
  return PLAN_TYPES.flatMap((type) =>
    CORRUPTION_VARIANTS.map((variant): readonly [string, OperationPlan] => [
      `${type} variant ${String(variant)}`,
      makePlan({
        type,
        picks: [1, 2, variant, 1, 2, variant],
        flags: [variant % 2 === 0, true, false, true],
        isCorrupted: true,
        steps: [
          makePlan({ type: "addTable" }),
          makePlan({ type: "addColumn" }),
        ],
      }),
    ]),
  );
}

describe("resolveOperation", () => {
  it("resolves a plan to an operation that references existing ids", () => {
    const schema = buildShopSchema();
    const picks = [0, 0, 3, 0, 0, 0];
    const types = [
      "removeTable",
      "removeColumn",
      "removeRelation",
      "removeIndex",
      "removeEnum",
      "removeSubjectArea",
      "removeNote",
    ] as const;

    const operations = types.map((type) =>
      resolveOperation(
        schema,
        makePlan({ type, picks }),
        createCounterIdGenerator(),
      ),
    );

    expect(operations).toStrictEqual([
      { type: "removeTable", tableId: "tbl_users" },
      { type: "removeColumn", columnId: "col_users_id" },
      { type: "removeRelation", relationId: "rel_orders_user" },
      { type: "removeIndex", indexId: "idx_users_email" },
      { type: "removeEnum", enumId: "enum_unused" },
      { type: "removeSubjectArea", subjectAreaId: "area_sales" },
      { type: "removeNote", noteId: "note_todo" },
    ] satisfies readonly Operation[]);
  });

  it("resolves a corrupted plan to an operation that applyOperation rejects", () => {
    const schemas = {
      empty: createEmptySchema("empty"),
      shop: buildShopSchema(),
    };

    const outcomes = Object.entries(schemas).flatMap(([label, schema]) =>
      buildCorruptedPlans().map(([name, plan]): readonly [string, boolean] => {
        const operation = resolveOperation(
          schema,
          plan,
          createCounterIdGenerator(),
        );
        return [`${label} ${name}`, applyOperation(schema, operation).isOk];
      }),
    );

    expect(Object.fromEntries(outcomes)).toStrictEqual(
      Object.fromEntries(outcomes.map(([name]) => [name, false])),
    );
  });
});
