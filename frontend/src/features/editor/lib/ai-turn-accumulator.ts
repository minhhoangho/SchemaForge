import type {
  AiChatRequest,
  AiFindingsData,
  AiProposalData,
} from "@schemaforge/api-contract";

import type { AiChatClient, AiChatEvent } from "@/lib/api/ai-chat-client";
import type { Logger } from "@/lib/logger";

import type { AiChatFailure } from "../state/create-ai-chat-store";

// A client safety cap on the text of one reply (about 8192 output tokens at 4
// characters each; the backend limit is per step, so it does not bound the
// whole turn). Text beyond it is cut and the stream still ends normally.
export const AI_MAX_STREAMED_TEXT_LENGTH = 32_768;

export const INTERNAL_FAILURE: AiChatFailure = {
  kind: "error",
  code: "internal-error",
};

export type Accumulator = {
  readonly text: string;
  readonly failure: AiChatFailure | null;
  readonly proposal: AiProposalData | null;
  readonly findings: AiFindingsData["findings"] | null;
  readonly sampleDataset: unknown;
  readonly isTruncated: boolean;
};

export function createAccumulator(): Accumulator {
  return {
    text: "",
    failure: null,
    proposal: null,
    findings: null,
    sampleDataset: null,
    isTruncated: false,
  };
}

function collectEvent(
  acc: Accumulator,
  event: AiChatEvent,
  logger: Logger,
): Accumulator {
  switch (event.kind) {
    case "text": {
      const isOverCap = event.text.length > AI_MAX_STREAMED_TEXT_LENGTH;
      if (isOverCap && !acc.isTruncated) {
        logger.warn("ai.chat.text-truncated", {
          limit: AI_MAX_STREAMED_TEXT_LENGTH,
        });
      }
      return {
        ...acc,
        text: event.text.slice(0, AI_MAX_STREAMED_TEXT_LENGTH),
        isTruncated: acc.isTruncated || isOverCap,
      };
    }
    case "proposal":
      return { ...acc, proposal: event.data };
    case "findings":
      return { ...acc, findings: event.data.findings };
    case "sampleData":
      return { ...acc, sampleDataset: event.data.dataset ?? null };
    case "error":
      return { ...acc, failure: { kind: "error", code: event.code } };
    case "http-failure":
      return {
        ...acc,
        failure: { kind: "http-failure", failure: event.failure },
      };
    default:
      return event satisfies never;
  }
}

type ConsumeInput = {
  readonly client: AiChatClient;
  readonly request: AiChatRequest;
  readonly signal: AbortSignal;
  readonly logger: Logger;
  // Stops reading when the turn was replaced (reset or a newer turn).
  readonly isCurrent: () => boolean;
  // Called with the whole text so far each time it changed.
  readonly onText: (text: string) => void;
};

/**
 * Reads one turn to its end and returns what it carried. A stream that throws
 * ends the turn as an internal failure, keeping the text received so far.
 */
export async function consumeStream(input: ConsumeInput): Promise<Accumulator> {
  const { client, request, signal, logger } = input;
  let acc = createAccumulator();
  try {
    for await (const event of client.stream(request, { signal })) {
      if (!input.isCurrent()) {
        break;
      }
      const next = collectEvent(acc, event, logger);
      const hasTextChanged = next.text !== acc.text;
      acc = next;
      if (hasTextChanged) {
        input.onText(acc.text);
      }
    }
  } catch (error) {
    logger.error("ai.chat.stream-failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    acc = { ...acc, failure: INTERNAL_FAILURE };
  }
  return acc;
}

export function failedAccumulator(failure: AiChatFailure): Accumulator {
  return { ...createAccumulator(), failure };
}
