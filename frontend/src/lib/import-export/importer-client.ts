import {
  isImportResponse,
  type ImportRequest,
  type ImportResponse,
} from "./import-protocol";

export const IMPORT_TIMEOUT_MS = 30_000;

export type ImportOutcome =
  | ImportResponse
  | { readonly kind: "timeout" }
  | { readonly kind: "cancelled" };

export type ImporterClient = {
  readonly run: (
    request: Omit<ImportRequest, "requestId">,
  ) => Promise<ImportOutcome>;
  readonly cancel: () => void;
  // Ends the worker; called when the dialog closes.
  readonly dispose: () => void;
};

export type ImporterClientOptions = {
  readonly createWorker?: () => Worker;
  readonly timeoutMs?: number;
  // Returns the function that cancels the timer.
  readonly schedule?: (callback: () => void, delayMs: number) => () => void;
};

type PendingRun = {
  readonly resolve: (outcome: ImportOutcome) => void;
  readonly cancelTimer: () => void;
};

function createDefaultWorker(): Worker {
  return new Worker(new URL("./importer.worker.ts", import.meta.url), {
    type: "module",
  });
}

function scheduleTimeout(callback: () => void, delayMs: number): () => void {
  const handle = setTimeout(callback, delayMs);
  return () => {
    clearTimeout(handle);
  };
}

/**
 * One cancellable import at a time. The worker is created on the first run
 * and replaced after a cancel, a timeout or an error, so a dead worker is
 * never reused.
 */
export function createImporterClient(
  options?: ImporterClientOptions,
): ImporterClient {
  const createWorker = options?.createWorker ?? createDefaultWorker;
  const timeoutMs = options?.timeoutMs ?? IMPORT_TIMEOUT_MS;
  const schedule = options?.schedule ?? scheduleTimeout;
  let worker: Worker | null = null;
  let pending: PendingRun | null = null;
  let lastRequestId = 0;

  function dropWorker(): void {
    worker?.terminate();
    worker = null;
  }

  function settle(outcome: ImportOutcome): void {
    const run = pending;
    if (run === null) return;
    pending = null;
    run.cancelTimer();
    run.resolve(outcome);
  }

  function cancel(): void {
    dropWorker();
    settle({ kind: "cancelled" });
  }

  function start(
    request: ImportRequest,
    resolve: (outcome: ImportOutcome) => void,
  ): void {
    const current = (worker ??= createWorker());
    const { requestId } = request;
    pending = {
      resolve,
      cancelTimer: schedule(() => {
        dropWorker();
        settle({ kind: "timeout" });
      }, timeoutMs),
    };
    current.onmessage = (event: MessageEvent<unknown>): void => {
      const response = event.data;
      if (isImportResponse(response) && response.requestId === requestId) {
        settle(response);
      }
    };
    const fail = (): void => {
      dropWorker();
      settle({ requestId, kind: "crashed" });
    };
    current.onerror = fail;
    current.onmessageerror = fail;
    current.postMessage(request);
  }

  return {
    run: (request) => {
      if (pending !== null) cancel();
      lastRequestId += 1;
      return new Promise<ImportOutcome>((resolve) => {
        start({ ...request, requestId: lastRequestId }, resolve);
      });
    },
    cancel,
    dispose: cancel,
  };
}
