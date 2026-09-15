import type {
  LockRequest,
  LockRequestOptions,
} from "@/lib/storage/schema-lock-manager";

export type FakeLockRegistry = {
  readonly request: LockRequest;
  readonly isHeld: (name: string) => boolean;
  readonly countWaiting: (name: string) => number;
};

type LockCallback = Parameters<LockRequest>[2];

type PendingRequest = {
  readonly name: string;
  readonly callback: LockCallback;
  readonly signal: AbortSignal | undefined;
  readonly resolve: () => void;
  readonly reject: (reason: unknown) => void;
  readonly onAbort: () => void;
};

function createAbortError(): DOMException {
  return new DOMException("The request was aborted.", "AbortError");
}

// Simulates exclusive Web Locks in memory: one holder per name, FIFO waiters,
// and the lock is held until the promise returned from the callback settles.
export function createFakeLockRegistry(): FakeLockRegistry {
  const heldNames = new Set<string>();
  const waitingByName = new Map<string, PendingRequest[]>();

  function getQueue(name: string): PendingRequest[] {
    const queue = waitingByName.get(name) ?? [];
    waitingByName.set(name, queue);
    return queue;
  }

  function releaseAndGrantNext(name: string): void {
    heldNames.delete(name);
    const next = getQueue(name).shift();
    if (next !== undefined) {
      grant(next);
    }
  }

  function grant(pending: PendingRequest): void {
    heldNames.add(pending.name);
    pending.signal?.removeEventListener("abort", pending.onAbort);
    const lock: Lock = { name: pending.name, mode: "exclusive" };
    // Web Locks invokes the callback asynchronously; a thrown error rejects
    // the request just like a rejected promise does.
    Promise.resolve()
      .then(() => pending.callback(lock))
      .then(
        () => {
          releaseAndGrantNext(pending.name);
          pending.resolve();
        },
        (error: unknown) => {
          releaseAndGrantNext(pending.name);
          pending.reject(error);
        },
      );
  }

  function callBackUnavailable(pending: PendingRequest): void {
    Promise.resolve()
      .then(() => pending.callback(null))
      .then(pending.resolve, pending.reject);
  }

  function enqueue(pending: PendingRequest): void {
    getQueue(pending.name).push(pending);
    pending.signal?.addEventListener("abort", pending.onAbort, { once: true });
  }

  const request: LockRequest = (name, options, callback) =>
    new Promise<void>((resolve, reject) => {
      const pending = createPendingRequest(name, options, callback, {
        resolve,
        reject,
        onAbort: () => {
          const queue = getQueue(name);
          queue.splice(queue.indexOf(pending), 1);
          reject(createAbortError());
        },
      });
      if (options.signal?.aborted === true) {
        reject(createAbortError());
      } else if (!heldNames.has(name)) {
        grant(pending);
      } else if (options.ifAvailable === true) {
        callBackUnavailable(pending);
      } else {
        enqueue(pending);
      }
    });

  return {
    request,
    isHeld: (name) => heldNames.has(name),
    countWaiting: (name) => waitingByName.get(name)?.length ?? 0,
  };
}

function createPendingRequest(
  name: string,
  options: LockRequestOptions,
  callback: LockCallback,
  handlers: Pick<PendingRequest, "resolve" | "reject" | "onAbort">,
): PendingRequest {
  return { name, callback, signal: options.signal, ...handlers };
}
