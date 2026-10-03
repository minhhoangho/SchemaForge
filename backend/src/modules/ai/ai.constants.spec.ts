import * as contract from "@schemaforge/api-contract";
import * as coreAi from "@schemaforge/core/ai";
import { describe, expect, it } from "vitest";

import {
  AI_BUSY_RETRY_AFTER_SECONDS,
  AI_GLOBAL_BUDGET_WINDOW_SECONDS,
  AI_MAX_OUTPUT_TOKENS,
  AI_MAX_PROPOSAL_BYTES,
  AI_MAX_RETRIES,
  AI_MAX_STEPS,
  AI_MAX_TOOL_CALLS_PER_TURN,
  AI_MAX_TOOL_ERRORS_PER_CALL,
  AI_TIMEOUT,
} from "./ai.constants.js";

describe("ai.constants", () => {
  it("defines the model call constants of spec section 6", () => {
    expect({
      AI_MAX_STEPS,
      AI_MAX_OUTPUT_TOKENS,
      AI_TIMEOUT,
      AI_BUSY_RETRY_AFTER_SECONDS,
      AI_MAX_PROPOSAL_BYTES,
      AI_MAX_RETRIES,
      AI_MAX_TOOL_CALLS_PER_TURN,
      AI_MAX_TOOL_ERRORS_PER_CALL,
      AI_GLOBAL_BUDGET_WINDOW_SECONDS,
    }).toEqual({
      AI_MAX_STEPS: 8,
      AI_MAX_OUTPUT_TOKENS: 8192,
      AI_TIMEOUT: { totalMs: 90_000, stepMs: 45_000 },
      AI_BUSY_RETRY_AFTER_SECONDS: 10,
      AI_MAX_PROPOSAL_BYTES: 1024 * 1024,
      AI_MAX_RETRIES: 1,
      AI_MAX_TOOL_CALLS_PER_TURN: 30,
      AI_MAX_TOOL_ERRORS_PER_CALL: 5,
      AI_GLOBAL_BUDGET_WINDOW_SECONDS: 3600,
    });
  });

  it("keeps the sample and findings limits of core and api-contract equal", () => {
    expect({
      AI_MAX_SAMPLE_ROWS_PER_TABLE: coreAi.AI_MAX_SAMPLE_ROWS_PER_TABLE,
      AI_MAX_SAMPLE_ROWS_PER_TURN: coreAi.AI_MAX_SAMPLE_ROWS_PER_TURN,
      AI_MAX_FINDINGS: coreAi.AI_MAX_FINDINGS,
    }).toEqual({
      AI_MAX_SAMPLE_ROWS_PER_TABLE: contract.AI_MAX_SAMPLE_ROWS_PER_TABLE,
      AI_MAX_SAMPLE_ROWS_PER_TURN: contract.AI_MAX_SAMPLE_ROWS_PER_TURN,
      AI_MAX_FINDINGS: contract.AI_MAX_FINDINGS,
    });
  });
});
