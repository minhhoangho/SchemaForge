import type { SchemaDetail } from "@schemaforge/api-contract";

import type { ApiClient } from "@/lib/api/api-client";
import { logger } from "@/lib/logger";
import type { SchemaRepository } from "@/lib/storage/schema-repository";

import { pushSchemaOnce } from "./push-schema-once";
import type { PushFailureCode, PushOutcome } from "./push-schema-once";
import { nextRetryDelayMs } from "./retry-scheduler";
import type { RetryScheduler } from "./retry-scheduler";

export type CloudPushState =
  | { readonly kind: "idle" }
  | { readonly kind: "sending" }
  | { readonly kind: "synced" }
  | { readonly kind: "waiting-retry"; readonly reason: "offline" | "server" }
  | { readonly kind: "session-expired" }
  | { readonly kind: "conflict"; readonly cloud: SchemaDetail | null }
  | { readonly kind: "deleted-in-cloud" }
  | { readonly kind: "failed"; readonly code: PushFailureCode };

export type CloudPusher = {
  /** After each successful cache write, on "Retry", and on sign-in again. */
  readonly requestPush: () => void;
  /** Leaves the stopped states (conflict, deleted, session expired). */
  readonly resume: () => void;
  readonly getState: () => CloudPushState;
  readonly subscribe: (listener: (state: CloudPushState) => void) => () => void;
  readonly dispose: () => void;
};

export type CloudPusherInput = {
  readonly api: ApiClient;
  readonly repository: SchemaRepository;
  readonly schemaId: string;
  readonly userId: string;
  readonly scheduler: RetryScheduler;
  readonly onlineEvents: {
    readonly subscribe: (listener: () => void) => () => void;
  };
  readonly isOnline: () => boolean;
};

type Retry = {
  readonly retryAfterSeconds: number | null;
  readonly isNetworkFailure: boolean;
};

type PusherRuntime = {
  readonly input: CloudPusherInput;
  readonly listeners: Set<(state: CloudPushState) => void>;
  state: CloudPushState;
  attempt: number;
  isSending: boolean;
  hasQueuedPush: boolean;
  isStopped: boolean;
  isDisposed: boolean;
  cancelRetry: (() => void) | null;
};

const IDLE: CloudPushState = { kind: "idle" };
const SENDING: CloudPushState = { kind: "sending" };
const THROWN_PUSH_RETRY: Retry = {
  retryAfterSeconds: null,
  isNetworkFailure: false,
};

function publish(runtime: PusherRuntime, state: CloudPushState): void {
  runtime.state = state;
  runtime.listeners.forEach((listener) => {
    listener(state);
  });
}

function clearRetry(runtime: PusherRuntime): void {
  runtime.cancelRetry?.();
  runtime.cancelRetry = null;
}

function startPush(runtime: PusherRuntime): void {
  if (runtime.isDisposed || runtime.isStopped) {
    return;
  }
  clearRetry(runtime);
  if (runtime.isSending) {
    runtime.hasQueuedPush = true;
    return;
  }
  runtime.isSending = true;
  runtime.hasQueuedPush = false;
  publish(runtime, SENDING);
  // Fire-and-forget: runPush never rejects (pushSafely catches) and reports
  // through published states, not through the returned promise.
  void runPush(runtime);
}

// A storage error thrown while pushing must not become an unhandled
// rejection; it backs off like a server error. Only the error name is logged.
async function pushSafely(runtime: PusherRuntime): Promise<PushOutcome | null> {
  const { api, repository, schemaId, userId } = runtime.input;
  try {
    return await pushSchemaOnce({ api, repository, schemaId, userId });
  } catch (error) {
    logger.error("cloud-push.unexpected-error", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

async function runPush(runtime: PusherRuntime): Promise<void> {
  const outcome = await pushSafely(runtime);
  runtime.isSending = false;
  if (runtime.isDisposed) {
    return;
  }
  if (outcome === null) {
    scheduleRetry(runtime, THROWN_PUSH_RETRY);
    return;
  }
  handleOutcome(runtime, outcome);
}

// A change requested while the request was in flight is sent right away with
// the latest document; otherwise the settled state is published.
function settle(runtime: PusherRuntime, state: CloudPushState): void {
  if (runtime.hasQueuedPush) {
    startPush(runtime);
    return;
  }
  publish(runtime, state);
}

function stop(runtime: PusherRuntime, state: CloudPushState): void {
  runtime.isStopped = true;
  runtime.hasQueuedPush = false;
  publish(runtime, state);
}

function scheduleRetry(runtime: PusherRuntime, retry: Retry): void {
  // A change that arrived during the send goes out now; only a real wait
  // counts as an attempt, so it does not lengthen the next backoff.
  if (runtime.hasQueuedPush) {
    startPush(runtime);
    return;
  }
  const delayMs = nextRetryDelayMs({
    attempt: runtime.attempt,
    retryAfterSeconds: retry.retryAfterSeconds,
  });
  runtime.attempt += 1;
  const isOffline = retry.isNetworkFailure || !runtime.input.isOnline();
  publish(runtime, {
    kind: "waiting-retry",
    reason: isOffline ? "offline" : "server",
  });
  runtime.cancelRetry = runtime.input.scheduler.schedule(delayMs, () => {
    runtime.cancelRetry = null;
    startPush(runtime);
  });
}

function handleOutcome(runtime: PusherRuntime, outcome: PushOutcome): void {
  switch (outcome.kind) {
    case "synced":
      runtime.attempt = 0;
      settle(runtime, { kind: "synced" });
      return;
    case "changed-while-sending":
      runtime.attempt = 0;
      startPush(runtime);
      return;
    case "conflict":
    case "deleted-in-cloud":
    case "session-expired":
      stop(runtime, outcome);
      return;
    case "failed":
      settle(runtime, outcome);
      return;
    case "not-pushable":
      settle(runtime, IDLE);
      return;
    case "retryable":
      scheduleRetry(runtime, {
        retryAfterSeconds: outcome.retryAfterSeconds,
        isNetworkFailure: outcome.failure === "network",
      });
      return;
    default: {
      const unhandledOutcome: never = outcome;
      return unhandledOutcome;
    }
  }
}

/**
 * Pushes one owned schema to the cloud, one request at a time, with backoff
 * on transient failures. The caller holds the schema's Web Lock for the whole
 * lifetime of the pusher and turns the published states into UI.
 */
export function createCloudPusher(input: CloudPusherInput): CloudPusher {
  const runtime: PusherRuntime = {
    input,
    listeners: new Set(),
    state: IDLE,
    attempt: 0,
    isSending: false,
    hasQueuedPush: false,
    isStopped: false,
    isDisposed: false,
    cancelRetry: null,
  };
  // Only a push that is waiting to retry goes out early when the network
  // comes back; synced or failed schemas have nothing new to send.
  const unsubscribeOnline = input.onlineEvents.subscribe(() => {
    if (runtime.cancelRetry !== null) {
      startPush(runtime);
    }
  });
  return {
    requestPush: () => {
      startPush(runtime);
    },
    resume: () => {
      runtime.isStopped = false;
      runtime.attempt = 0;
      startPush(runtime);
    },
    getState: () => runtime.state,
    subscribe: (listener) => {
      runtime.listeners.add(listener);
      return () => {
        runtime.listeners.delete(listener);
      };
    },
    dispose: () => {
      runtime.isDisposed = true;
      clearRetry(runtime);
      unsubscribeOnline();
    },
  };
}
