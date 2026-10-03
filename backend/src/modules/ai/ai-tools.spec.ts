import type { AiFindingsData } from "@schemaforge/api-contract";
import { aiFindingsDataSchema } from "@schemaforge/api-contract";
import type { SchemaDocument } from "@schemaforge/core";
import type {
  AiColumnSpec,
  AiFinding,
  AiFindingsInput,
} from "@schemaforge/core/ai";
import { AI_TOOL_NAMES } from "@schemaforge/core/ai";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeTable,
} from "@schemaforge/core/testing";
import { isStepCount, streamText } from "ai";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createScriptedModel,
  scriptedFinish,
  scriptedText,
  scriptedToolCall,
} from "../../../test/mock-ai-model.js";
import { AI_TOOL_DESCRIPTIONS } from "./ai-tools-descriptions.js";
import type { AiToolOutput, AiToolSet, AiTurnState } from "./ai-tools.js";
import { buildAiTools, createAiTurnState } from "./ai-tools.js";

const SCHEMA = buildSchema({
  name: "shop",
  tables: [
    makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_users_id"] }),
    makeTable({
      id: "tbl_orders",
      position: { x: 400, y: 0 },
      primaryKeyColumnIds: ["col_orders_id"],
    }),
  ],
  columns: [
    makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
    makeColumn({ id: "col_orders_id", tableId: "tbl_orders", name: "id" }),
  ],
});

// The rightmost table of SCHEMA is at x 400, so the turn's grid starts at 800.
const GRID_ORIGIN_X = 800;

const PROTO_SCHEMA = buildSchema({
  name: "proto",
  tables: [
    makeTable({ id: "tbl_users", primaryKeyColumnIds: ["col_users_id"] }),
    makeTable({
      id: "tbl_proto",
      name: "__proto__",
      primaryKeyColumnIds: ["col_proto_id"],
    }),
  ],
  columns: [
    makeColumn({ id: "col_users_id", tableId: "tbl_users", name: "id" }),
    makeColumn({ id: "col_proto_id", tableId: "tbl_proto", name: "id" }),
    makeColumn({
      id: "col_proto_proto",
      tableId: "tbl_proto",
      name: "__proto__",
      isNullable: true,
    }),
  ],
});

const EXECUTION = { toolCallId: "call-1", messages: [], context: {} };

function toolsFor(state: AiTurnState): ReturnType<typeof buildAiTools> {
  return buildAiTools(state, createCounterIdGenerator());
}

function stateWith(
  overrides: Partial<AiTurnState>,
  original: SchemaDocument = SCHEMA,
): AiTurnState {
  return { ...createAiTurnState(original), ...overrides };
}

function columnSpec(name: string, isNullable = false): AiColumnSpec {
  return { name, type: { kind: "integer" }, isNullable };
}

function issueFinding(table: string): AiFindingsInput["findings"][number] {
  return {
    kind: "issue",
    category: "naming",
    title: "Unclear name",
    detail: "Rename the table.",
    table,
  };
}

const USERS_FINDING = issueFinding("users");

const SAMPLE_DATA = {
  tables: [{ table: "users", rows: [[{ column: "id", value: "1" }]] }],
};

describe("buildAiTools", () => {
  it("applies a successful edit to the draft and records the operation", () => {
    const state = createAiTurnState(SCHEMA);

    const output = toolsFor(state).addColumn.execute(
      { table: "users", column: columnSpec("age", true) },
      EXECUTION,
    );

    expect(output).toStrictEqual({
      ok: true,
      changes: ["added column users.age"],
    });
    expect(state.original).toBe(SCHEMA);
    expect(Object.values(state.draft.columns).map(({ name }) => name)).toEqual([
      "id",
      "id",
      "age",
    ]);
    expect(state.operations).toStrictEqual([
      expect.objectContaining({ type: "addColumn" }),
    ]);
  });

  it("returns changes with the new foreign key column name", () => {
    const state = createAiTurnState(SCHEMA);

    const output = toolsFor(state).addRelation.execute(
      { fromTable: "orders", toTable: "users", kind: "oneToMany" },
      EXECUTION,
    );

    expect(output).toStrictEqual({
      ok: true,
      changes: [
        "added column orders.users_id",
        "added relation orders(users_id) -> users(id)",
      ],
    });
  });

  it("returns errors with named paths and leaves the draft unchanged", () => {
    const state = createAiTurnState(SCHEMA);

    const output = toolsFor(state).removeColumn.execute(
      { table: "missing", column: "id" },
      EXECUTION,
    );

    expect(output).toStrictEqual({
      ok: false,
      errors: [{ code: "table-name-not-found", at: "tables.missing" }],
    });
    expect(state.draft).toBe(SCHEMA);
    expect(state.operations).toStrictEqual([]);
  });

  it("returns at most five errors per call", () => {
    const state = createAiTurnState(SCHEMA);
    const findings = ["a", "b", "c", "d", "e", "f"].map(issueFinding);

    const output = toolsFor(state).reportFindings.execute(
      { findings },
      EXECUTION,
    );

    expect(output).toStrictEqual({
      ok: false,
      errors: [
        { code: "table-name-not-found", at: "findings.0.tables.a" },
        { code: "table-name-not-found", at: "findings.1.tables.b" },
        { code: "table-name-not-found", at: "findings.2.tables.c" },
        { code: "table-name-not-found", at: "findings.3.tables.d" },
        { code: "table-name-not-found", at: "findings.4.tables.e" },
      ],
    });
  });

  it("places two created tables in the same row", () => {
    const state = createAiTurnState(SCHEMA);
    const tools = toolsFor(state);

    tools.createTable.execute(
      { name: "products", columns: [columnSpec("id")], primaryKey: ["id"] },
      EXECUTION,
    );
    tools.createTable.execute(
      { name: "tags", columns: [columnSpec("id")], primaryKey: ["id"] },
      EXECUTION,
    );

    expect(
      Object.values(state.draft.tables).map(({ name, position }) => ({
        name,
        position,
      })),
    ).toStrictEqual([
      { name: "users", position: { x: 0, y: 0 } },
      { name: "orders", position: { x: 400, y: 0 } },
      { name: "products", position: { x: GRID_ORIGIN_X, y: 0 } },
      { name: "tags", position: { x: GRID_ORIGIN_X + 400, y: 0 } },
    ]);
    expect(state.placement).toStrictEqual({
      originX: GRID_ORIGIN_X,
      placedCount: 2,
    });
  });

  it("rejects the 31st tool call with tool-call-limit", () => {
    const state = stateWith({ toolCallCount: 30 });

    const output = toolsFor(state).renameSchema.execute(
      { name: "store" },
      EXECUTION,
    );

    expect(output).toStrictEqual({
      ok: false,
      errors: [{ code: "tool-call-limit", at: "" }],
    });
    expect(state.draft).toBe(SCHEMA);
  });

  it("runs the 30th tool call", () => {
    const state = stateWith({ toolCallCount: 29 });

    const output = toolsFor(state).renameSchema.execute(
      { name: "store" },
      EXECUTION,
    );

    expect(output).toStrictEqual({
      ok: true,
      changes: ["renamed schema to store"],
    });
  });

  it("rejects sample data after an edit with turn-has-edits", () => {
    const state = createAiTurnState(SCHEMA);
    const tools = toolsFor(state);
    tools.renameSchema.execute({ name: "store" }, EXECUTION);

    const output = tools.proposeSampleData.execute(SAMPLE_DATA, EXECUTION);

    expect(output).toStrictEqual({
      ok: false,
      errors: [{ code: "turn-has-edits", at: "" }],
    });
    expect(state.sampleData).toBeNull();
  });

  it("rejects an edit after sample data with turn-has-sample-data", () => {
    const state = createAiTurnState(SCHEMA);
    const tools = toolsFor(state);
    tools.proposeSampleData.execute(SAMPLE_DATA, EXECUTION);

    const output = tools.renameSchema.execute({ name: "store" }, EXECUTION);

    expect(output).toStrictEqual({
      ok: false,
      errors: [{ code: "turn-has-sample-data", at: "" }],
    });
    expect(state.draft).toBe(SCHEMA);
  });

  it("appends findings from several calls", () => {
    const state = createAiTurnState(SCHEMA);
    const tools = toolsFor(state);
    tools.reportFindings.execute({ findings: [USERS_FINDING] }, EXECUTION);

    const output = tools.reportFindings.execute(
      { findings: [{ ...USERS_FINDING, columns: ["id"] }] },
      EXECUTION,
    );

    expect(output).toStrictEqual({ ok: true, changes: [] });
    expect(state.findings.map(({ targets }) => targets)).toStrictEqual([
      [{ tableId: "tbl_users", columnId: null }],
      [{ tableId: "tbl_users", columnId: "col_users_id" }],
    ]);
    expect(
      aiFindingsDataSchema.safeParse({ findings: state.findings }).success,
    ).toBe(true);
  });

  it("keeps findings field for field equal to the findings data contract", () => {
    type ContractFinding = AiFindingsData["findings"][number];

    // AiFinding's targets array is readonly, so it is compared field by field.
    expectTypeOf<keyof AiFinding>().toEqualTypeOf<keyof ContractFinding>();
    expectTypeOf<keyof AiFinding["targets"][number]>().toEqualTypeOf<
      keyof ContractFinding["targets"][number]
    >();
    expectTypeOf<Omit<AiFinding, "targets">>().toExtend<
      Omit<ContractFinding, "targets">
    >();
    expectTypeOf<AiFinding["targets"][number]>().toExtend<
      ContractFinding["targets"][number]
    >();
  });

  it("rejects findings beyond 30 with findings-limit", () => {
    const state = createAiTurnState(SCHEMA);
    const tools = toolsFor(state);
    tools.reportFindings.execute(
      { findings: Array.from({ length: 30 }, () => USERS_FINDING) },
      EXECUTION,
    );

    const output = tools.reportFindings.execute(
      { findings: [USERS_FINDING] },
      EXECUTION,
    );

    expect(output).toStrictEqual({
      ok: false,
      errors: [{ code: "findings-limit", at: "findings" }],
    });
    expect(state.findings).toHaveLength(30);
  });

  it("replaces the sample dataset of an earlier call", () => {
    const state = createAiTurnState(SCHEMA);
    const tools = toolsFor(state);
    tools.proposeSampleData.execute(SAMPLE_DATA, EXECUTION);

    const output = tools.proposeSampleData.execute(
      {
        tables: [{ table: "orders", rows: [[{ column: "id", value: "7" }]] }],
      },
      EXECUTION,
    );

    expect(output).toStrictEqual({ ok: true, changes: [] });
    expect(state.sampleData).toStrictEqual({
      tables: [{ tableId: "tbl_orders", rows: [{ col_orders_id: 7 }] }],
    });
  });

  it("does not run an edit after the abort signal fires", () => {
    const state = createAiTurnState(SCHEMA);
    const controller = new AbortController();
    controller.abort();

    expect(() =>
      toolsFor(state).renameSchema.execute(
        { name: "store" },
        { ...EXECUTION, abortSignal: controller.signal },
      ),
    ).toThrow();
    expect(state.draft).toBe(SCHEMA);
    expect(state.toolCallCount).toBe(0);
  });

  it("runs a tool call of the model on the turn draft through streamText", async () => {
    const state = createAiTurnState(SCHEMA);
    const model = createScriptedModel([
      [
        ...scriptedToolCall("call-1", "renameSchema", { name: "store" }),
        scriptedFinish("tool-calls"),
      ],
      [...scriptedText("text-1", "Renamed."), scriptedFinish("stop")],
    ]);

    await streamText({
      model,
      prompt: "fixture prompt",
      stopWhen: isStepCount(2),
      tools: toolsFor(state),
    }).consumeStream();

    expect(state.draft.name).toBe("store");
    expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain(
      '"changes":["renamed schema to store"]',
    );
  });

  it.each<[string, (tools: AiToolSet) => AiToolOutput, string]>([
    [
      "updateTable",
      (tools) =>
        tools.updateTable.execute(
          { table: "users", comment: "People" },
          EXECUTION,
        ),
      "updateTable",
    ],
    [
      "removeTable",
      (tools) => tools.removeTable.execute({ table: "orders" }, EXECUTION),
      "removeTable",
    ],
    [
      "updateColumn",
      (tools) =>
        tools.updateColumn.execute(
          { table: "users", column: "id", comment: "Key" },
          EXECUTION,
        ),
      "updateColumn",
    ],
    [
      "setPrimaryKey",
      (tools) =>
        tools.setPrimaryKey.execute(
          { table: "users", columns: ["id"] },
          EXECUTION,
        ),
      "setPrimaryKey",
    ],
    [
      "addIndex",
      (tools) =>
        tools.addIndex.execute(
          { table: "users", columns: ["id"], isUnique: false },
          EXECUTION,
        ),
      "addIndex",
    ],
    [
      "createEnum",
      (tools) =>
        tools.createEnum.execute(
          { name: "status", values: ["open"] },
          EXECUTION,
        ),
      "addEnum",
    ],
  ])("records the core operation of %s", (_name, run, operationType) => {
    const state = createAiTurnState(SCHEMA);

    run(toolsFor(state));

    expect(state.operations).toStrictEqual([
      expect.objectContaining({ type: operationType }),
    ]);
  });

  it.each<[string, (tools: AiToolSet) => AiToolOutput, AiToolOutput]>([
    [
      "updateRelation",
      (tools) =>
        tools.updateRelation.execute(
          { fromTable: "orders", toTable: "users", onDelete: "cascade" },
          EXECUTION,
        ),
      {
        ok: false,
        errors: [expect.objectContaining({ code: "relation-not-found" })],
      },
    ],
    [
      "removeRelation",
      (tools) =>
        tools.removeRelation.execute(
          { fromTable: "orders", toTable: "users" },
          EXECUTION,
        ),
      {
        ok: false,
        errors: [expect.objectContaining({ code: "relation-not-found" })],
      },
    ],
    [
      "removeIndex",
      (tools) =>
        tools.removeIndex.execute(
          { table: "users", index: "missing" },
          EXECUTION,
        ),
      {
        ok: false,
        errors: [expect.objectContaining({ code: "index-name-not-found" })],
      },
    ],
    [
      "updateEnum",
      (tools) =>
        tools.updateEnum.execute(
          { enum: "missing", values: ["open"] },
          EXECUTION,
        ),
      {
        ok: false,
        errors: [expect.objectContaining({ code: "enum-name-not-found" })],
      },
    ],
    [
      "removeEnum",
      (tools) => tools.removeEnum.execute({ enum: "missing" }, EXECUTION),
      {
        ok: false,
        errors: [expect.objectContaining({ code: "enum-name-not-found" })],
      },
    ],
  ])("routes %s to its core translator", (_name, run, expected) => {
    expect(run(toolsFor(createAiTurnState(SCHEMA)))).toStrictEqual(expected);
  });

  it("describes every tool in English", () => {
    const tools = toolsFor(createAiTurnState(SCHEMA));

    expect(Object.keys(tools)).toStrictEqual([...AI_TOOL_NAMES]);
    expect(
      Object.fromEntries(
        Object.entries(tools).map(([name, { description }]) => [
          name,
          description,
        ]),
      ),
    ).toStrictEqual(AI_TOOL_DESCRIPTIONS);
    expect(
      Object.values(AI_TOOL_DESCRIPTIONS).filter(
        (description) => !/^[A-Z][\x20-\x7E]+\.$/.test(description),
      ),
    ).toStrictEqual([]);
  });
});

describe("accepts a table and columns named __proto__ through createTable, addColumn, addRelation, reportFindings and proposeSampleData", () => {
  it("creates a table and a column named __proto__", () => {
    const output = toolsFor(createAiTurnState(SCHEMA)).createTable.execute(
      {
        name: "__proto__",
        columns: [columnSpec("id"), columnSpec("__proto__", true)],
        primaryKey: ["id"],
      },
      EXECUTION,
    );

    expect(output).toStrictEqual({
      ok: true,
      changes: [
        "added table __proto__",
        "added column __proto__.id",
        "added column __proto__.__proto__",
      ],
    });
  });

  it("adds a column named __proto__ after another", () => {
    const output = toolsFor(createAiTurnState(PROTO_SCHEMA)).addColumn.execute(
      { table: "users", column: columnSpec("__proto__", true), after: "id" },
      EXECUTION,
    );

    expect(output).toStrictEqual({
      ok: true,
      changes: ["added column users.__proto__"],
    });
  });

  it("relates a __proto__ column to another table", () => {
    const output = toolsFor(
      createAiTurnState(PROTO_SCHEMA),
    ).addRelation.execute(
      {
        fromTable: "__proto__",
        toTable: "users",
        kind: "oneToMany",
        fromColumns: ["__proto__"],
      },
      EXECUTION,
    );

    expect(output).toStrictEqual({
      ok: true,
      changes: ["added relation __proto__(__proto__) -> users(id)"],
    });
  });

  it("reports a finding on a __proto__ column", () => {
    const state = createAiTurnState(PROTO_SCHEMA);

    toolsFor(state).reportFindings.execute(
      { findings: [{ ...issueFinding("__proto__"), columns: ["__proto__"] }] },
      EXECUTION,
    );

    expect(state.findings.map(({ targets }) => targets)).toStrictEqual([
      [{ tableId: "tbl_proto", columnId: "col_proto_proto" }],
    ]);
  });

  it("proposes sample data for a __proto__ column", () => {
    const state = createAiTurnState(PROTO_SCHEMA);

    toolsFor(state).proposeSampleData.execute(
      {
        tables: [
          {
            table: "__proto__",
            rows: [
              [
                { column: "id", value: "1" },
                { column: "__proto__", value: "2" },
              ],
            ],
          },
        ],
      },
      EXECUTION,
    );

    expect(state.sampleData).toStrictEqual({
      tables: [
        {
          tableId: "tbl_proto",
          rows: [{ col_proto_id: 1, col_proto_proto: 2 }],
        },
      ],
    });
  });
});
