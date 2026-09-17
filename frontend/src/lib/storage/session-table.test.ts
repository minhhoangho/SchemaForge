import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { afterEach, describe, expect, it } from "vitest";

import { SchemaforgeDatabase } from "./database";
import { createSessionTable } from "./session-table";
import type { SessionTable } from "./session-table";

const USER_ID = "5f1c2d3e-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

type Fixture = {
  readonly database: SchemaforgeDatabase;
  readonly sessionTable: SessionTable;
};

describe("createSessionTable", () => {
  const databases = new Set<SchemaforgeDatabase>();

  function setUp(): Fixture {
    const database = new SchemaforgeDatabase({
      indexedDB: new IDBFactory(),
      IDBKeyRange,
    });
    databases.add(database);
    return { database, sessionTable: createSessionTable(database) };
  }

  afterEach(() => {
    databases.forEach((database) => {
      database.close();
    });
    databases.clear();
  });

  it("writes and reads the current session", async () => {
    const { sessionTable } = setUp();

    await sessionTable.writeSession({
      userId: USER_ID,
      email: "ada@example.com",
    });

    await expect(sessionTable.readSession()).resolves.toEqual({
      key: "current",
      userId: USER_ID,
      email: "ada@example.com",
    });
  });

  it("replaces the current session when another one is written", async () => {
    const { database, sessionTable } = setUp();
    await sessionTable.writeSession({
      userId: USER_ID,
      email: "ada@example.com",
    });

    await sessionTable.writeSession({
      userId: USER_ID,
      email: "grace@example.com",
    });

    await expect(database.session.count()).resolves.toBe(1);
    await expect(sessionTable.readSession()).resolves.toMatchObject({
      email: "grace@example.com",
    });
  });

  it("returns null when no session is stored", async () => {
    const { sessionTable } = setUp();

    await expect(sessionTable.readSession()).resolves.toBeNull();
  });

  it("deletes the current session", async () => {
    const { sessionTable } = setUp();
    await sessionTable.writeSession({
      userId: USER_ID,
      email: "ada@example.com",
    });

    await sessionTable.deleteSession();

    await expect(sessionTable.readSession()).resolves.toBeNull();
  });

  it("returns null for a session row with an invalid shape", async () => {
    const { database, sessionTable } = setUp();
    await database
      .table<unknown>("session")
      .put({ key: "current", userId: "user-1", email: "ada@example.com" });

    await expect(sessionTable.readSession()).resolves.toBeNull();
  });
});
