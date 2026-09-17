import type { SchemaforgeDatabase } from "./database";
import { parseSessionRecord, SESSION_KEY } from "./records";
import type { SessionRecord } from "./records";

export type SessionInput = Omit<SessionRecord, "key">;

export type SessionTable = {
  readonly readSession: () => Promise<SessionRecord | null>;
  readonly writeSession: (input: SessionInput) => Promise<void>;
  readonly deleteSession: () => Promise<void>;
};

/**
 * The last signed-in account, kept in a single row. Reads go through
 * parseSessionRecord because the row may come from another release.
 */
export function createSessionTable(
  database: SchemaforgeDatabase,
): SessionTable {
  return {
    readSession: async () =>
      parseSessionRecord(await database.session.get(SESSION_KEY)),
    writeSession: async ({ userId, email }) => {
      await database.session.put({ key: SESSION_KEY, userId, email });
    },
    deleteSession: async () => {
      await database.session.delete(SESSION_KEY);
    },
  };
}
