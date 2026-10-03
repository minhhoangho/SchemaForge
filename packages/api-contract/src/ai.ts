// Zod schemas are created when this module loads. In the browser it must load
// after frontend/src/lib/zod-config.ts (Zod jitless), like the core package.
import { z } from "zod";

import { AI_MAX_FINDINGS } from "./limits.js";

export type AiLocale = "vi" | "en";

export type AiProposalOutcome = "accepted" | "discarded";

export type AiChatMessage = {
  readonly role: "user" | "assistant";
  readonly text: string;
  // Only on an assistant message that carried a proposal.
  readonly proposalOutcome?: AiProposalOutcome;
};

export type AiChatRequest = {
  // Opaque on the wire; the backend passes it through parseSchemaDocument.
  readonly document: unknown;
  readonly messages: readonly AiChatMessage[];
  readonly locale: AiLocale;
};

// The errorText of an `error` chunk sent after the stream has started (AI-R24).
export const AI_STREAM_ERROR_CODES = [
  "ai-upstream-busy",
  "ai-upstream-failed",
  "ai-timeout",
  "ai-output-invalid",
  "internal-error",
] as const;

export type AiStreamErrorCode = (typeof AI_STREAM_ERROR_CODES)[number];

export const AI_DATA_PART_TYPES = {
  proposal: "data-proposal",
  findings: "data-findings",
  sampleData: "data-sample-data",
} as const;

const FINDING_TITLE_MAX_LENGTH = 200;
const FINDING_DETAIL_MAX_LENGTH = 2000;
const FINDING_MAX_TARGETS = 20;

export const aiProposalDataSchema = z.object({
  // The frontend passes it through parseOperation of core.
  operation: z.unknown(),
  stoppedEarly: z.boolean(),
});

export const aiFindingsDataSchema = z.object({
  findings: z
    .array(
      z.object({
        kind: z.enum(["suggestion", "issue"]),
        category: z.enum([
          "index",
          "normalization",
          "naming",
          "relation",
          "type",
          "other",
        ]),
        title: z.string().min(1).max(FINDING_TITLE_MAX_LENGTH),
        detail: z.string().max(FINDING_DETAIL_MAX_LENGTH),
        targets: z
          .array(
            z.object({ tableId: z.string(), columnId: z.string().nullable() }),
          )
          .max(FINDING_MAX_TARGETS),
      }),
    )
    .min(1)
    .max(AI_MAX_FINDINGS),
});

export const aiSampleDataSchema = z.object({
  // The frontend passes it through parseSeedDataset, then validateSeedDataset.
  dataset: z.unknown(),
});

export type AiProposalData = z.infer<typeof aiProposalDataSchema>;

export type AiFindingsData = z.infer<typeof aiFindingsDataSchema>;

export type AiSampleData = z.infer<typeof aiSampleDataSchema>;

const STREAM_ERROR_CODE_SET: ReadonlySet<string> = new Set(
  AI_STREAM_ERROR_CODES,
);

export function isAiStreamErrorCode(value: string): value is AiStreamErrorCode {
  return STREAM_ERROR_CODE_SET.has(value);
}
