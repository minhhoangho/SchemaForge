import type { AiChatRequest } from "@schemaforge/api-contract";
import { buildSchema } from "@schemaforge/core/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";

import {
  AI_CLIENT_TIMEOUT_MS,
  AI_FIRST_BYTE_TIMEOUT_MS,
  createAiChatClient,
} from "./ai-chat-client";
import type { AiChatEvent, AiChatTransport } from "./ai-chat-client";
import type { SessionRefresher } from "./session-refresher";

const BASE_URL = "https://api.example.test";

type FetchStub = ReturnType<typeof vi.fn<typeof fetch>>;

const START = { type: "start", messageId: "message-1" };
const TEXT_START = { type: "text-start", id: "text-1" };
const TEXT_END = { type: "text-end", id: "text-1" };
const FINISH = { type: "finish" };

function textDelta(delta: string): unknown {
  return { type: "text-delta", id: "text-1", delta };
}

function createRequest(): AiChatRequest {
  return {
    document: buildSchema({ name: "shop" }),
    messages: [{ role: "user", text: "Add an orders table" }],
    locale: "en",
  };
}

function sseText(chunks: readonly unknown[]): string {
  return chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("");
}

function sseResponse(chunks: readonly unknown[]): Response {
  return new Response(`${sseText(chunks)}data: [DONE]\n\n`, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function rawSseResponse(text: string): Response {
  return new Response(text, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function errorResponse(
  status: number,
  code: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ statusCode: status, code }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function requireSignal(init: RequestInit | undefined): AbortSignal {
  const signal = init?.signal;
  if (signal === undefined || signal === null) {
    throw new Error("Expected the AI chat client to pass a signal to fetch.");
  }
  return signal;
}

// Like a real fetch: rejects with the abort reason once the signal aborts.
function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      "abort",
      () => {
        reject(new DOMException("The request was aborted.", "AbortError"));
      },
      { once: true },
    );
  });
}

// A 200 response whose body sends one text delta and then stays open until
// the request signal aborts, like a real fetch body.
function openEndedResponse(signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(sseText([START, TEXT_START, textDelta("Hi")])),
      );
      signal.addEventListener(
        "abort",
        () => {
          controller.error(signal.reason);
        },
        { once: true },
      );
    },
  });
  return new Response(body, { status: 200 });
}

function createRefresher(
  result: Awaited<ReturnType<SessionRefresher["refresh"]>> = {
    isOk: true,
    value: undefined,
  },
): SessionRefresher & {
  readonly refresh: ReturnType<typeof vi.fn<SessionRefresher["refresh"]>>;
} {
  return {
    refresh: vi.fn<SessionRefresher["refresh"]>(() => Promise.resolve(result)),
  };
}

function createTransport(
  fetchImpl: FetchStub,
  overrides: Partial<AiChatTransport> = {},
): AiChatTransport {
  return {
    baseUrl: BASE_URL,
    fetchImpl,
    sessionRefresher: createRefresher(),
    onSessionExpired: vi.fn<() => void>(),
    ...overrides,
  };
}

function respondWith(...responses: readonly Response[]): FetchStub {
  const queue = [...responses];
  return vi.fn<typeof fetch>(() => {
    const next = queue.shift();
    if (next === undefined) {
      throw new Error("The test did not expect another request.");
    }
    return Promise.resolve(next);
  });
}

async function collect(
  iterable: AsyncIterable<AiChatEvent>,
): Promise<AiChatEvent[]> {
  const events: AiChatEvent[] = [];
  for await (const event of iterable) {
    events.push(event);
  }
  return events;
}

function streamOnce(
  transport: AiChatTransport,
  signal: AbortSignal = new AbortController().signal,
): AsyncIterable<AiChatEvent> {
  return createAiChatClient(transport).stream(createRequest(), { signal });
}

describe("createAiChatClient", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sends a POST with credentials, the JSON body and the event stream accept header", async () => {
    const fetchImpl = respondWith(sseResponse([START, FINISH]));

    await collect(streamOnce(createTransport(fetchImpl)));

    const [input, init] = fetchImpl.mock.calls[0] ?? [];
    expect(input).toEqual(new URL("/ai/chat", BASE_URL));
    expect(init).toMatchObject({
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createRequest()),
    });
  });

  it("yields the accumulated text of text deltas", async () => {
    const fetchImpl = respondWith(
      sseResponse([
        START,
        TEXT_START,
        textDelta("Hel"),
        textDelta("lo"),
        TEXT_END,
        FINISH,
      ]),
    );

    const events = await collect(streamOnce(createTransport(fetchImpl)));

    expect(events).toEqual([
      { kind: "text", text: "Hel" },
      { kind: "text", text: "Hello" },
    ]);
  });

  it("yields a proposal, findings and sample data parsed with the contract schemas", async () => {
    const proposal = { operation: { kind: "anything" }, stoppedEarly: false };
    const findings = {
      findings: [
        {
          kind: "suggestion",
          category: "index",
          title: "Index users.email",
          detail: "Lookups by email scan the table.",
          targets: [{ tableId: "t1", columnId: null }],
        },
      ],
    };
    const sampleData = { dataset: { rows: [] } };
    const fetchImpl = respondWith(
      sseResponse([
        START,
        { type: "data-proposal", data: proposal },
        { type: "data-findings", data: findings },
        { type: "data-sample-data", data: sampleData },
        FINISH,
      ]),
    );

    const events = await collect(streamOnce(createTransport(fetchImpl)));

    expect(events).toEqual([
      { kind: "proposal", data: proposal },
      { kind: "findings", data: findings },
      { kind: "sampleData", data: sampleData },
    ]);
  });

  it("yields the code of an error chunk as the last event", async () => {
    const fetchImpl = respondWith(
      sseResponse([
        START,
        TEXT_START,
        textDelta("Hi"),
        { type: "error", errorText: "ai-upstream-busy" },
        textDelta(" there"),
      ]),
    );

    const events = await collect(streamOnce(createTransport(fetchImpl)));

    expect(events).toEqual([
      { kind: "text", text: "Hi" },
      { kind: "error", code: "ai-upstream-busy" },
    ]);
  });

  it("maps an unknown error text to internal-error", async () => {
    const fetchImpl = respondWith(
      sseResponse([
        START,
        { type: "error", errorText: "https://provider.example/secret failed" },
      ]),
    );

    const events = await collect(streamOnce(createTransport(fetchImpl)));

    expect(events).toEqual([{ kind: "error", code: "internal-error" }]);
  });

  it("yields ai-output-invalid and logs a warning for a data part of the wrong shape", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    const fetchImpl = respondWith(
      sseResponse([
        START,
        { type: "data-proposal", data: { operation: {} } },
        { type: "data-findings", data: { findings: [] } },
        FINISH,
      ]),
    );

    const events = await collect(streamOnce(createTransport(fetchImpl)));

    expect(events).toEqual([{ kind: "error", code: "ai-output-invalid" }]);
    expect(warn).toHaveBeenCalledWith("ai.chat.invalid-data-part", {
      type: "data-proposal",
    });
  });

  it("yields ai-output-invalid for an event that is not a UI message chunk", async () => {
    const fetchImpl = respondWith(
      rawSseResponse(
        `${sseText([START, TEXT_START, textDelta("Hi")])}data: {"type":"made-up"}\n\n`,
      ),
    );

    const events = await collect(streamOnce(createTransport(fetchImpl)));

    expect(events).toEqual([
      { kind: "text", text: "Hi" },
      { kind: "error", code: "ai-output-invalid" },
    ]);
  });

  it("yields invalid-response for a success response without a body", async () => {
    const fetchImpl = respondWith(new Response(null, { status: 200 }));

    const events = await collect(streamOnce(createTransport(fetchImpl)));

    expect(events).toEqual([{ kind: "error", code: "invalid-response" }]);
  });

  it("refreshes the session after a 401 and sends the request once more", async () => {
    const sessionRefresher = createRefresher();
    const fetchImpl = respondWith(
      errorResponse(401, "unauthenticated"),
      sseResponse([START, TEXT_START, textDelta("Hi"), TEXT_END, FINISH]),
    );

    const events = await collect(
      streamOnce(createTransport(fetchImpl, { sessionRefresher })),
    );

    expect(sessionRefresher.refresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(events).toEqual([{ kind: "text", text: "Hi" }]);
  });

  it("calls onSessionExpired when the refresh fails with 401", async () => {
    const onSessionExpired = vi.fn<() => void>();
    const sessionRefresher = createRefresher({
      isOk: false,
      error: {
        kind: "http",
        status: 401,
        body: { statusCode: 401, code: "session-expired" },
        retryAfterSeconds: null,
      },
    });
    const fetchImpl = respondWith(errorResponse(401, "unauthenticated"));

    const events = await collect(
      streamOnce(
        createTransport(fetchImpl, { sessionRefresher, onSessionExpired }),
      ),
    );

    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(events).toMatchObject([
      { kind: "http-failure", failure: { kind: "http", status: 401 } },
    ]);
  });

  it("yields an http failure with retry after seconds for a 429", async () => {
    const fetchImpl = respondWith(
      errorResponse(429, "too-many-requests", { "Retry-After": "30" }),
    );

    const events = await collect(streamOnce(createTransport(fetchImpl)));

    expect(events).toMatchObject([
      {
        kind: "http-failure",
        failure: {
          kind: "http",
          status: 429,
          body: { code: "too-many-requests" },
          retryAfterSeconds: 30,
        },
      },
    ]);
  });

  it("yields network when fetch rejects", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.reject(new TypeError("Failed to fetch")),
    );

    const events = await collect(streamOnce(createTransport(fetchImpl)));

    expect(events).toEqual([{ kind: "error", code: "network" }]);
  });

  it("yields timeout when no response arrives within 30 seconds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetchImpl = vi.fn<typeof fetch>((_input, init) =>
      rejectOnAbort(requireSignal(init)),
    );
    const collecting = collect(streamOnce(createTransport(fetchImpl)));

    await vi.advanceTimersByTimeAsync(AI_FIRST_BYTE_TIMEOUT_MS);

    expect(await collecting).toEqual([{ kind: "error", code: "timeout" }]);
  });

  it("yields timeout when the stream runs past 120 seconds", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const fetchImpl = vi.fn<typeof fetch>((_input, init) =>
      Promise.resolve(openEndedResponse(requireSignal(init))),
    );
    const events: AiChatEvent[] = [];
    const reading = (async () => {
      for await (const event of streamOnce(createTransport(fetchImpl))) {
        events.push(event);
      }
    })();

    await vi.advanceTimersByTimeAsync(AI_FIRST_BYTE_TIMEOUT_MS * 2);
    expect(events).toEqual([{ kind: "text", text: "Hi" }]);
    await vi.advanceTimersByTimeAsync(AI_CLIENT_TIMEOUT_MS);
    await reading;

    expect(events).toEqual([
      { kind: "text", text: "Hi" },
      { kind: "error", code: "timeout" },
    ]);
  });

  it("ends without an event when the caller aborts", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>((_input, init) =>
      rejectOnAbort(requireSignal(init)),
    );
    const collecting = collect(
      streamOnce(createTransport(fetchImpl), controller.signal),
    );

    controller.abort();

    expect(await collecting).toEqual([]);
  });

  it("ends without another event when the caller aborts mid-stream", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>((_input, init) =>
      Promise.resolve(openEndedResponse(requireSignal(init))),
    );
    const events: AiChatEvent[] = [];

    for await (const event of streamOnce(
      createTransport(fetchImpl),
      controller.signal,
    )) {
      events.push(event);
      controller.abort();
    }

    expect(events).toEqual([{ kind: "text", text: "Hi" }]);
  });
});
