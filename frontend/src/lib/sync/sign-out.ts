import type { Result } from "@schemaforge/core";

import type { ApiClient } from "@/lib/api/api-client";
import type { ApiFailure } from "@/lib/api/api-failure";
import type {
  SchemaLock,
  SchemaLockManager,
} from "@/lib/storage/schema-lock-manager";
import type { SchemaRepository } from "@/lib/storage/schema-repository";

export const SIGN_OUT_LOCK_TIMEOUT_MS = 5_000;

const UNAUTHORIZED_STATUS = 401;

export type SignOutFailure = {
  readonly kind: "logout-failed";
  readonly failure: ApiFailure;
};

type SignOutInput = {
  readonly api: ApiClient;
  readonly repository: SchemaRepository;
  readonly lockManager: SchemaLockManager;
  readonly userId: string;
  readonly clearAuthHint: () => void;
  readonly broadcastSignedOut: () => void;
  readonly createTimeoutSignal: (ms: number) => AbortSignal;
};

export async function countUnsyncedSchemas(input: {
  readonly repository: SchemaRepository;
  readonly userId: string;
}): Promise<number> {
  const records = await input.repository.listOwnedSchemas(input.userId);
  return records.filter((record) => record.syncStatus !== "synced").length;
}

// A 401 means the server no longer knows the session, so the cookies are
// already useless and the local cleanup can go ahead.
function isSessionAlreadyGone(failure: ApiFailure): boolean {
  return failure.kind === "http" && failure.status === UNAUTHORIZED_STATUS;
}

// The wait is bounded so a tab that never lets go cannot keep the account's
// data in the browser. Only the timeout is tolerated: any other lock error
// propagates.
async function acquireWithinTimeout(
  lockManager: SchemaLockManager,
  schemaId: string,
  signal: AbortSignal,
): Promise<SchemaLock | null> {
  try {
    return await lockManager.acquire(schemaId, signal);
  } catch (error: unknown) {
    if (signal.aborted) {
      return null;
    }
    throw error;
  }
}

async function deleteOwnedSchema(
  input: SignOutInput,
  schemaId: string,
): Promise<void> {
  const signal = input.createTimeoutSignal(SIGN_OUT_LOCK_TIMEOUT_MS);
  const lock = await acquireWithinTimeout(input.lockManager, schemaId, signal);
  try {
    await input.repository.deleteSchema(schemaId);
  } finally {
    lock?.release();
  }
}

async function deleteAccountCache(input: SignOutInput): Promise<void> {
  const records = await input.repository.listOwnedSchemas(input.userId);
  const outcomes = await Promise.allSettled(
    records.map((record) => deleteOwnedSchema(input, record.id)),
  );
  // A row that no longer parses never reaches listOwnedSchemas, so it would
  // outlive the account and surface for the next user of this browser. The
  // sweep removes what is left of the account by ownerId alone.
  const sweep = await Promise.allSettled([
    input.repository.deleteOwnedRowsExcept(
      input.userId,
      records.map((record) => record.id),
    ),
  ]);
  // The session and the hint are cleared even when a deletion failed: the
  // server session is already gone, so keeping them would claim a sign-in
  // that no longer exists.
  await input.repository.deleteSession();
  input.clearAuthHint();
  const failure = [...outcomes, ...sweep].find(
    (outcome) => outcome.status === "rejected",
  );
  if (failure !== undefined) {
    throw new Error("Deleting the account cache failed during sign-out.", {
      cause: failure.reason,
    });
  }
}

/**
 * Signs out on the server, then removes every cached schema of the account
 * from this browser while guest schemas stay (auth-cloud spec, section 7
 * "Đăng xuất", steps 2 to 4). The caller asks about unsynced changes first,
 * then sets the auth state and navigates.
 */
export async function signOut(
  input: SignOutInput,
): Promise<Result<void, SignOutFailure>> {
  const logoutResult = await input.api.auth.logout();
  if (!logoutResult.isOk && !isSessionAlreadyGone(logoutResult.error)) {
    // The HttpOnly cookies may still be valid, so nothing is reported or
    // deleted as if the user had signed out.
    return {
      isOk: false,
      error: { kind: "logout-failed", failure: logoutResult.error },
    };
  }
  input.broadcastSignedOut();
  await deleteAccountCache(input);
  return { isOk: true, value: undefined };
}
