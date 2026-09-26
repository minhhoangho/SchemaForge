import { logger } from "@/lib/logger";
import type { SchemaLockManager } from "@/lib/storage/schema-lock-manager";
import type { SchemaRepository } from "@/lib/storage/schema-repository";

/**
 * Deletes cached schemas that a complete cloud list no longer has. A schema
 * open in another tab is skipped; that tab learns about the deletion itself.
 */
export async function removeStaleCache(input: {
  readonly schemaIds: readonly string[];
  readonly repository: SchemaRepository;
  readonly lockManager: SchemaLockManager;
}): Promise<void> {
  for (const schemaId of input.schemaIds) {
    try {
      const lock = await input.lockManager.tryAcquire(schemaId);
      if (lock === null) {
        continue;
      }
      try {
        await input.repository.deleteSchema(schemaId);
      } finally {
        lock.release();
      }
    } catch (cause: unknown) {
      logger.warn("schema-list.remove-stale-cache-failed", {
        errorName: cause instanceof Error ? cause.name : "unknown",
      });
    }
  }
}
