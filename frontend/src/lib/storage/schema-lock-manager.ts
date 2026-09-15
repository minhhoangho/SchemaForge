export type SchemaLock = { readonly release: () => void };

export type SchemaLockManager = {
  readonly tryAcquire: (schemaId: string) => Promise<SchemaLock | null>;
  readonly acquire: (
    schemaId: string,
    signal: AbortSignal,
  ) => Promise<SchemaLock>;
};

// ifAvailable and signal are picked from the DOM type because their names are
// fixed by the Web Locks API.
export type LockRequestOptions = Readonly<
  Pick<LockOptions, "ifAvailable" | "signal">
> & { readonly mode: "exclusive" };

// A narrow port instead of the DOM LockManager type, whose generic request
// overloads cannot be implemented by a fake without type assertions.
export type LockRequest = (
  name: string,
  options: LockRequestOptions,
  callback: (lock: Lock | null) => Promise<void> | undefined,
) => Promise<void>;

const SCHEMA_LOCK_PREFIX = "schemaforge:schema:";

export function getSchemaLockName(schemaId: string): string {
  return `${SCHEMA_LOCK_PREFIX}${schemaId}`;
}

type HeldLock = {
  readonly lock: SchemaLock;
  readonly released: Promise<void>;
};

function createHeldLock(): HeldLock {
  let resolveReleased: () => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    resolveReleased = resolve;
  });
  // Resolving a settled promise does nothing, so a second release is ignored.
  const lock: SchemaLock = {
    release: () => {
      resolveReleased();
    },
  };
  return { lock, released };
}

function requestSchemaLock(
  request: LockRequest,
  schemaId: string,
  options: LockRequestOptions,
): Promise<SchemaLock | null> {
  return new Promise((resolve, reject) => {
    // The lock stays held until the promise returned from the callback settles.
    request(getSchemaLockName(schemaId), options, (lock) => {
      if (lock === null) {
        resolve(null);
        return undefined;
      }
      const heldLock = createHeldLock();
      resolve(heldLock.lock);
      return heldLock.released;
    }).catch(reject);
  });
}

export function createSchemaLockManager(
  request: LockRequest,
): SchemaLockManager {
  return {
    tryAcquire: (schemaId) =>
      requestSchemaLock(request, schemaId, {
        mode: "exclusive",
        ifAvailable: true,
      }),
    acquire: async (schemaId, signal) => {
      const lock = await requestSchemaLock(request, schemaId, {
        mode: "exclusive",
        signal,
      });
      if (lock === null) {
        throw new Error("The lock request finished without granting a lock.");
      }
      return lock;
    },
  };
}

export function createBrowserSchemaLockManager(): SchemaLockManager {
  // lib.dom types navigator.locks as always present, but browsers expose it
  // only in secure contexts (HTTPS or localhost).
  if (!("locks" in navigator)) {
    throw new Error(
      "The Web Locks API is unavailable. SchemaForge needs a secure context (HTTPS or localhost).",
    );
  }
  const { locks } = navigator;
  return createSchemaLockManager((name, options, callback) =>
    locks.request(name, options, callback),
  );
}
