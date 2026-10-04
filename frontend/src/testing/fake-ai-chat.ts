import { AI_DATA_PART_TYPES } from "@schemaforge/api-contract";
import type {
  AiFindingsData,
  AiProposalData,
  AiSampleData,
  AiStreamErrorCode,
} from "@schemaforge/api-contract";

// Written by hand, not with the `ai` package, so the journeys check the wire
// format itself (plan, Vấn đề 34).

export type FakeAiTurn = {
  readonly text: string;
  readonly proposal?: {
    readonly operation: unknown;
    readonly isStoppedEarly?: boolean;
  };
  readonly findings?: AiFindingsData["findings"];
  readonly dataset?: unknown;
  // When set, an `error` chunk replaces the data parts and `finish`.
  readonly errorCode?: AiStreamErrorCode;
};

type Chunk = Readonly<Record<string, unknown>>;

const TEXT_ID = "text-1";

function dataPartChunks(turn: FakeAiTurn): readonly Chunk[] {
  const chunks: Chunk[] = [];
  if (turn.proposal !== undefined) {
    chunks.push({
      type: AI_DATA_PART_TYPES.proposal,
      data: {
        operation: turn.proposal.operation,
        stoppedEarly: turn.proposal.isStoppedEarly ?? false,
      } satisfies AiProposalData,
    });
  } else if (turn.dataset !== undefined) {
    chunks.push({
      type: AI_DATA_PART_TYPES.sampleData,
      data: { dataset: turn.dataset } satisfies AiSampleData,
    });
  }
  if (turn.findings !== undefined) {
    chunks.push({
      type: AI_DATA_PART_TYPES.findings,
      data: { findings: turn.findings } satisfies AiFindingsData,
    });
  }
  return chunks;
}

function turnChunks(turn: FakeAiTurn): readonly Chunk[] {
  const middle = Math.ceil(turn.text.length / 2);
  const firstHalf = turn.text.slice(0, middle);
  const secondHalf = turn.text.slice(middle);
  return [
    { type: "start" },
    { type: "text-start", id: TEXT_ID },
    { type: "text-delta", id: TEXT_ID, delta: firstHalf },
    { type: "text-delta", id: TEXT_ID, delta: secondHalf },
    { type: "text-end", id: TEXT_ID },
    ...(turn.errorCode === undefined
      ? [...dataPartChunks(turn), { type: "finish" }]
      : [{ type: "error", errorText: turn.errorCode }]),
  ];
}

/** The 200 response of `POST /ai/chat` for `turn`, chunks in AI-R22 order. */
export function buildAiChatSseResponse(turn: FakeAiTurn): Response {
  const body = `${turnChunks(turn)
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .join("")}data: [DONE]\n\n`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "x-vercel-ai-ui-message-stream": "v1",
    },
  });
}
