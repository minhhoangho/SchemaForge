import { AI_DATA_PART_TYPES } from "@schemaforge/api-contract";

export const TEST_AI_USER_ID = "11111111-1111-4111-8111-111111111111";

// The cookie that makes AuthProvider ask /auth/me on mount.
export const AUTH_HINT_COOKIE = "sf-auth-hint=1";

type StreamChunk = Readonly<Record<string, unknown>>;

function encodeChunks(chunks: readonly StreamChunk[]): string {
  return chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("");
}

export function textChunks(text: string): readonly StreamChunk[] {
  return [
    { type: "text-start", id: "t1" },
    { type: "text-delta", id: "t1", delta: text },
    { type: "text-end", id: "t1" },
  ];
}

export function proposalChunk(operation: unknown): StreamChunk {
  return {
    type: AI_DATA_PART_TYPES.proposal,
    data: { operation, stoppedEarly: false },
  };
}

/** A complete UI message stream of `POST /ai/chat` holding `chunks`. */
export function aiChatStreamResponse(chunks: readonly StreamChunk[]): Response {
  const body = `${encodeChunks([{ type: "start" }, ...chunks, { type: "finish" }])}data: [DONE]\n\n`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/**
 * A stream that sends `text` and then stays open, so the turn keeps running
 * until `signal` aborts it, as a real fetch body does.
 */
export function openAiChatStreamResponse(
  text: string,
  signal?: AbortSignal | null,
): Response {
  const encoded = new TextEncoder().encode(
    encodeChunks([{ type: "start" }, ...textChunks(text)]),
  );
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoded);
      signal?.addEventListener("abort", () => {
        controller.error(new DOMException("Aborted", "AbortError"));
      });
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

export type ControlledAiChatStream = {
  readonly response: Response;
  // Sends the rest of the turn and closes the stream.
  readonly finish: (chunks: readonly StreamChunk[]) => void;
};

/** A stream that starts now and ends when the test calls `finish`. */
export function createControlledAiChatStream(): ControlledAiChatStream {
  const encoder = new TextEncoder();
  let finish: ControlledAiChatStream["finish"] = () => {
    throw new Error("The stream has not started.");
  };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(encodeChunks([{ type: "start" }])));
      finish = (chunks) => {
        controller.enqueue(
          encoder.encode(
            `${encodeChunks([...chunks, { type: "finish" }])}data: [DONE]\n\n`,
          ),
        );
        controller.close();
      };
    },
  });
  return {
    response: new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }),
    finish: (chunks) => {
      finish(chunks);
    },
  };
}

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * A fetch for AuthProvider and the AI transport: `/auth/me` answers with a
 * signed-in user, `/ai/chat` with `answerChat`, anything else fails the test.
 */
export function createAiFetch(
  answerChat: (signal: AbortSignal | null) => Response | Promise<Response>,
): typeof fetch {
  return (input, init) => {
    const path =
      input instanceof URL
        ? input.pathname
        : new URL(typeof input === "string" ? input : input.url, "http://test")
            .pathname;
    if (path.endsWith("/auth/me")) {
      return Promise.resolve(
        jsonResponse(200, {
          user: {
            id: TEST_AI_USER_ID,
            email: "ai@example.com",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        }),
      );
    }
    if (path.endsWith("/ai/chat")) {
      return Promise.resolve(answerChat(init?.signal ?? null));
    }
    return Promise.reject(new Error(`Unexpected request to ${path}.`));
  };
}
