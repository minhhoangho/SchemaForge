import { describe, test } from "vitest";

import type { GenerateId } from "../model/ids.js";
import { createCounterIdGenerator } from "../testing/factories.js";
import { createLargeSchema } from "../testing/large-schema.js";
import type { AiEdit } from "./ai-edit-tools.js";
import { applyAiEdit } from "./apply-ai-edit.js";
import { describeSchemaForAi } from "./describe-schema-for-ai.js";
import { createAiTablePlacement } from "./place-ai-table.js";

// AI-R57 budget: p95 <= 25 ms per call, read from the p99 column since the
// vitest bench table has no p95 (plan issue 49).
// Same value as AI_MAX_SCHEMA_PROMPT_LENGTH of @schemaforge/api-contract,
// which core cannot import.
const SCHEMA_PROMPT_LENGTH_LIMIT = 80_000;
// createLargeSchema rejects fewer tables.
const MIN_TABLE_COUNT = 2;
// Four benchmarks of at least 64 samples each; the margin covers a busy machine.
const BENCH_TIMEOUT_MS = 300_000;

function promptLength(tableCount: number): number {
  const schema = createLargeSchema({ tableCount });
  return JSON.stringify(describeSchemaForAi(schema)).length;
}

// The largest document the backend accepts for the AI (AI-R57, plan issue 21).
function findLargestTableCount(): number {
  let tableCount = MIN_TABLE_COUNT;
  while (promptLength(tableCount + 1) <= SCHEMA_PROMPT_LENGTH_LIMIT) {
    tableCount += 1;
  }
  return tableCount;
}

const tableCount = findLargestTableCount();
const schema = createLargeSchema({ tableCount });
const placement = createAiTablePlacement(schema);
const counter = createCounterIdGenerator();
// A prefix keeps new ids clear of the counter ids of the fixture.
const generateId: GenerateId = () => `bench${counter()}`;

const EDITS = {
  addColumn: {
    tool: "addColumn",
    input: {
      table: "table_001",
      column: { name: "note", type: { kind: "text" }, isNullable: true },
      after: "id",
    },
  },
  updateColumn: {
    tool: "updateColumn",
    input: {
      table: "table_001",
      column: "field_01",
      type: { kind: "bigint" },
      comment: "Widened",
    },
  },
  createTable: {
    tool: "createTable",
    input: {
      name: "audit_events",
      columns: [
        { name: "id", type: { kind: "uuid" }, isNullable: false },
        {
          name: "action",
          type: { kind: "varchar", length: 50 },
          isNullable: false,
        },
        { name: "payload", type: { kind: "json" }, isNullable: true },
        {
          name: "created_at",
          type: { kind: "timestamptz" },
          isNullable: false,
          defaultValue: { kind: "currentTimestamp" },
        },
      ],
      primaryKey: ["id"],
    },
  },
  addRelation: {
    tool: "addRelation",
    input: { fromTable: "table_003", toTable: "table_001", kind: "oneToMany" },
  },
} as const satisfies Record<string, AiEdit>;

function applyEdit(edit: AiEdit): boolean {
  return applyAiEdit(schema, edit, { generateId, placement }).isOk;
}

// A rejected edit stops early and would measure only name lookup.
const rejected = Object.entries(EDITS).filter(([, edit]) => !applyEdit(edit));
if (rejected.length > 0) {
  throw new Error(
    `benchmark edits are rejected: ${rejected.map(([name]) => name).join(", ")}`,
  );
}

// Vitest 5 registers benchmarks through the `bench` test fixture, not a module export.
describe(`applyAiEdit on createLargeSchema({ tableCount: ${String(tableCount)} })`, () => {
  test(
    "AI edit calls",
    async ({ bench }) => {
      await bench.compare(
        bench("applyAiEdit addColumn on the largest accepted document", () => {
          applyEdit(EDITS.addColumn);
        }),
        bench(
          "applyAiEdit updateColumn on the largest accepted document",
          () => {
            applyEdit(EDITS.updateColumn);
          },
        ),
        bench(
          "applyAiEdit createTable on the largest accepted document",
          () => {
            applyEdit(EDITS.createTable);
          },
        ),
        bench(
          "applyAiEdit addRelation on the largest accepted document",
          () => {
            applyEdit(EDITS.addRelation);
          },
        ),
      );
    },
    BENCH_TIMEOUT_MS,
  );
});
