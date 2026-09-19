import type { SchemaLockManager } from "@/lib/storage/schema-lock-manager";
import type { SchemaRepository } from "@/lib/storage/schema-repository";

type ForgetInput = {
  readonly repository: SchemaRepository;
  readonly lockManager: SchemaLockManager;
  readonly previousUserId: string;
};

type ForgetPreviousAccountReport = {
  readonly removedIds: readonly string[];
  readonly keptIds: readonly string[];
};

// Re-read inside the lock: another tab may have saved the schema between the
// listing and the lock, and then its changes exist only in this cache.
async function removeIfStillSynced(
  input: ForgetInput,
  schemaId: string,
): Promise<boolean> {
  const lock = await input.lockManager.tryAcquire(schemaId);
  if (lock === null) {
    return false;
  }
  try {
    const record = await input.repository.readSchemaRecord(schemaId);
    if (
      record?.ownerId !== input.previousUserId ||
      record.syncStatus !== "synced"
    ) {
      return false;
    }
    await input.repository.deleteSchema(schemaId);
    return true;
  } finally {
    lock.release();
  }
}

/**
 * Runs when a different account signs in (auth-cloud spec, section 7 "Phiên
 * hết hạn và đổi tài khoản"). Synced schemas of the previous account are
 * already in its cloud, so their cache goes; anything with unsent changes
 * stays hidden until that account signs in here again. A schema whose lock is
 * busy is kept rather than waited for. The session record is left to the
 * caller, which replaces it afterwards.
 */
export async function forgetPreviousAccount(
  input: ForgetInput,
): Promise<ForgetPreviousAccountReport> {
  const records = await input.repository.listOwnedSchemas(input.previousUserId);
  const synced = records.filter((record) => record.syncStatus === "synced");
  const removed = await Promise.all(
    synced.map((record) => removeIfStillSynced(input, record.id)),
  );
  const removedIds = synced
    .filter((_record, index) => removed[index] === true)
    .map((record) => record.id);
  const keptIds = records
    .map((record) => record.id)
    .filter((id) => !removedIds.includes(id));
  return { removedIds, keptIds };
}
