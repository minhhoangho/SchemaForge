import { describe, expect, it } from "vitest";

import {
  AI_DATA_PART_TYPES,
  AI_STREAM_ERROR_CODES,
  aiFindingsDataSchema,
  aiProposalDataSchema,
  aiSampleDataSchema,
  isAiStreamErrorCode,
} from "./ai.js";

const TARGET = { tableId: "tbl_1", columnId: null };

const FINDING = {
  kind: "suggestion",
  category: "index",
  title: "Index the foreign key",
  detail: "orders.customer_id is used in joins but has no index.",
  targets: [TARGET],
};

describe("aiProposalDataSchema", () => {
  it("accepts a proposal data part with any operation value", () => {
    const operation = { type: "batch", operations: [{ anything: true }] };

    const result = aiProposalDataSchema.safeParse({
      operation,
      stoppedEarly: true,
    });

    expect(result.data).toStrictEqual({ operation, stoppedEarly: true });
  });

  it("rejects a proposal data part without stoppedEarly", () => {
    const result = aiProposalDataSchema.safeParse({ operation: {} });

    expect(result.success).toBe(false);
  });
});

describe("aiFindingsDataSchema", () => {
  it("accepts findings with targets", () => {
    const findings = [
      FINDING,
      {
        ...FINDING,
        kind: "issue",
        category: "naming",
        detail: "",
        targets: [{ tableId: "tbl_2", columnId: "col_3" }],
      },
    ];

    const result = aiFindingsDataSchema.safeParse({ findings });

    expect(result.data).toStrictEqual({ findings });
  });

  it.each([
    ["an empty findings list", 0],
    ["more than 30 findings", 31],
  ])("rejects %s", (_label, count) => {
    const result = aiFindingsDataSchema.safeParse({
      findings: Array.from({ length: count }, () => FINDING),
    });

    expect(result.success).toBe(false);
  });

  it("accepts exactly 30 findings", () => {
    const result = aiFindingsDataSchema.safeParse({
      findings: Array.from({ length: 30 }, () => FINDING),
    });

    expect(result.success).toBe(true);
  });

  it("rejects a finding title over 200 characters", () => {
    const result = aiFindingsDataSchema.safeParse({
      findings: [{ ...FINDING, title: "x".repeat(201) }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects more than 20 targets", () => {
    const result = aiFindingsDataSchema.safeParse({
      findings: [
        { ...FINDING, targets: Array.from({ length: 21 }, () => TARGET) },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe("aiSampleDataSchema", () => {
  it("accepts a sample data part with any dataset value", () => {
    const dataset = { tables: [{ rows: [{ id: 1 }] }] };

    const result = aiSampleDataSchema.safeParse({ dataset });

    expect(result.data).toStrictEqual({ dataset });
  });
});

describe("AI_DATA_PART_TYPES", () => {
  it("names the three data parts of the stream", () => {
    expect(AI_DATA_PART_TYPES).toStrictEqual({
      proposal: "data-proposal",
      findings: "data-findings",
      sampleData: "data-sample-data",
    });
  });
});

describe("AI_STREAM_ERROR_CODES", () => {
  it("lists the five stream error codes", () => {
    expect(AI_STREAM_ERROR_CODES).toStrictEqual([
      "ai-upstream-busy",
      "ai-upstream-failed",
      "ai-timeout",
      "ai-output-invalid",
      "internal-error",
    ]);
  });

  it.each([
    ["ai-upstream-busy", true],
    ["internal-error", true],
    ["ai-unavailable", false],
    ["", false],
  ])("recognizes stream error codes: %s", (value, isCode) => {
    expect(isAiStreamErrorCode(value)).toBe(isCode);
  });
});
