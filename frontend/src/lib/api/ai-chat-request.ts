import type { AiChatRequest } from "@schemaforge/api-contract";
import type { Result } from "@schemaforge/core";

import { logger } from "@/lib/logger";

import type { ApiFailure } from "./api-failure";
import { parseErrorBody, readJsonBody } from "./api-transport";
import type { SessionRefresher } from "./session-refresher";

// The request half of an AI chat turn. It must not import the `ai` package:
// only ai-chat-client.ts may (AI spec section 5; eslint.config.mjs).
export const AI_FIRST_BYTE_TIMEOUT_MS = 30_000;
export const AI_CLIENT_TIMEOUT_MS = 120_000;
export const AI_CHAT_ROUTE = "/ai/chat";

export type AiChatTransport = {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;
  readonly sessionRefresher: SessionRefresher;
  readonly onSessionExpired: () => void;
};

export type TurnRun = {
  readonly callerSignal: AbortSignal;
  readonly signal: AbortSignal;
  readonly hasTimedOut: () => boolean;
  // Starts a timer that aborts the turn as a timeout; returns its canceller.
  readonly startTimer: (ms: number) => () => void;
  readonly dispose: () => void;
};

// setTimeout instead of AbortSignal.timeout so fake timers drive both limits
// (AI plan, Vấn đề 25).
export function startRun(callerSignal: AbortSignal): TurnRun {
  const internal = new AbortController();
  let hasTimedOut = false;
  const startTimer = (ms: number): (() => void) => {
    const timer = setTimeout(() => {
      hasTimedOut = true;
      internal.abort();
    }, ms);
    return () => {
      clearTimeout(timer);
    };
  };
  const clearTotalTimer = startTimer(AI_CLIENT_TIMEOUT_MS);
  return {
    callerSignal,
    signal: AbortSignal.any([callerSignal, internal.signal]),
    hasTimedOut: () => hasTimedOut,
    startTimer,
    dispose: () => {
      clearTotalTimer();
      // Releases the connection when the reader stopped early.
      internal.abort();
    },
  };
}

function buildRequestInit(
  request: AiChatRequest,
  signal: AbortSignal,
): RequestInit {
  return {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    signal,
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  };
}

async function readFailure(
  response: Response,
  run: TurnRun,
): Promise<Result<never, ApiFailure>> {
  const body = await readJsonBody(response, {
    caller: run.callerSignal,
    combined: run.signal,
  });
  if (body.kind === "network" || body.kind === "timeout") {
    return { isOk: false, error: body };
  }
  return parseErrorBody(
    response,
    AI_CHAT_ROUTE,
    body.kind === "parsed" ? body.value : undefined,
  );
}

/** Throws only when the caller's own signal aborted the request. */
export async function openStream(
  transport: AiChatTransport,
  request: AiChatRequest,
  run: TurnRun,
): Promise<Result<ReadableStream<Uint8Array>, ApiFailure>> {
  const clearFirstByteTimer = run.startTimer(AI_FIRST_BYTE_TIMEOUT_MS);
  let response: Response;
  try {
    response = await transport.fetchImpl(
      new URL(AI_CHAT_ROUTE, transport.baseUrl),
      buildRequestInit(request, run.signal),
    );
  } catch (cause) {
    if (run.callerSignal.aborted) {
      throw cause;
    }
    return {
      isOk: false,
      error: { kind: run.hasTimedOut() ? "timeout" : "network" },
    };
  } finally {
    clearFirstByteTimer();
  }
  if (!response.ok) {
    return readFailure(response, run);
  }
  if (response.body === null) {
    logger.warn("api.invalid-response", {
      route: AI_CHAT_ROUTE,
      status: response.status,
    });
    return { isOk: false, error: { kind: "invalid-response" } };
  }
  return { isOk: true, value: response.body };
}
