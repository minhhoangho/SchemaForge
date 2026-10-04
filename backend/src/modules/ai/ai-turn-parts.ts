import {
  type AiFindingsData,
  type AiProposalData,
  type AiSampleData,
  MAX_REQUEST_BODY_BYTES,
} from "@schemaforge/api-contract";
import {
  applyOperation,
  type BatchOperation,
  findIntroducedIssues,
  type Result,
} from "@schemaforge/core";

import { AI_MAX_PROPOSAL_BYTES } from "./ai.constants.js";
import type { AiTurnState } from "./ai-tools.js";

/** The data parts `AiChatService` writes after the model text (AI-R22). */
export type AiTurnDataPart =
  | { readonly type: "data-proposal"; readonly data: AiProposalData }
  | { readonly type: "data-sample-data"; readonly data: AiSampleData }
  | { readonly type: "data-findings"; readonly data: AiFindingsData };

/** Why the whole-turn check failed; logged, never sent to the client. */
export type AiTurnInvalidReason =
  | "operation-rejected"
  | "issues-introduced"
  | "document-too-large"
  | "part-too-large";

type TurnResult<T> = Result<T, AiTurnInvalidReason>;

function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value));
}

// AI-R17: each tool call kept the draft free of new issues, so a failure here
// is a programming error; the sizes bound what the client must accept (AI-R62).
function checkProposal(state: AiTurnState): TurnResult<BatchOperation> {
  const batch: BatchOperation = {
    type: "batch",
    operations: state.operations,
  };
  const applied = applyOperation(state.original, batch);
  if (!applied.isOk) {
    return { isOk: false, error: "operation-rejected" };
  }
  if (findIntroducedIssues(state.original, applied.value.schema).length > 0) {
    return { isOk: false, error: "issues-introduced" };
  }
  if (jsonBytes(applied.value.schema) > MAX_REQUEST_BODY_BYTES) {
    return { isOk: false, error: "document-too-large" };
  }
  return { isOk: true, value: batch };
}

function findingsData(state: AiTurnState): AiFindingsData {
  return {
    // The contract type has mutable arrays; core's findings are readonly.
    findings: state.findings.map((finding) => ({
      ...finding,
      targets: [...finding.targets],
    })),
  };
}

/**
 * Checks the whole turn and builds its data parts in stream order: a
 * proposal or sample data, then findings (AI-R22). Every part stays within
 * `AI_MAX_PROPOSAL_BYTES` (plan Vấn đề 59).
 */
export function buildAiTurnParts(
  state: AiTurnState,
  isStoppedEarly: boolean,
): TurnResult<readonly AiTurnDataPart[]> {
  const parts: AiTurnDataPart[] = [];
  if (state.operations.length > 0) {
    const proposal = checkProposal(state);
    if (!proposal.isOk) {
      return proposal;
    }
    parts.push({
      type: "data-proposal",
      data: { operation: proposal.value, stoppedEarly: isStoppedEarly },
    });
  }
  if (state.sampleData !== null) {
    parts.push({
      type: "data-sample-data",
      data: { dataset: state.sampleData },
    });
  }
  if (state.findings.length > 0) {
    parts.push({ type: "data-findings", data: findingsData(state) });
  }
  if (parts.some((part) => jsonBytes(part.data) > AI_MAX_PROPOSAL_BYTES)) {
    return { isOk: false, error: "part-too-large" };
  }
  return { isOk: true, value: parts };
}
