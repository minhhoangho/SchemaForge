import { sortRelations, sortTables } from "@schemaforge/core";
import type { GeneratorDiagnostic, SchemaDocument } from "@schemaforge/core";
import { generatePostgresql } from "@schemaforge/core/generators/postgresql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { startDatabaseServer } from "./support/containers.js";
import type { DatabaseServer, DatabaseSession } from "./support/containers.js";
import {
  listConformanceFixtures,
  withDialectCustomTypes,
} from "./support/fixtures.js";

const DIALECT = "postgresql";

const COUNT_FOREIGN_KEYS_SQL =
  "SELECT COUNT(*) AS count FROM pg_constraint WHERE contype = 'f'";
const TABLE_COMMENTS_SQL =
  "SELECT c.relname AS name, obj_description(c.oid, 'pg_class') AS comment FROM pg_class c WHERE c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace ORDER BY c.relname";

const countShape = z.array(z.object({ count: z.coerce.number() }));
const tableCommentShape = z.array(
  z.object({ name: z.string(), comment: z.string().nullable() }),
);

let server: DatabaseServer | undefined;
let databaseCount = 0;
const openSessions: DatabaseSession[] = [];

beforeAll(async () => {
  server = await startDatabaseServer(DIALECT);
});

afterEach(async () => {
  await Promise.all(openSessions.splice(0).map((session) => session.close()));
});

afterAll(async () => {
  await server?.stop();
});

type DdlRun = {
  readonly session: DatabaseSession;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

async function runDdl(schema: SchemaDocument): Promise<DdlRun> {
  if (server === undefined) {
    throw new Error("The PostgreSQL server did not start");
  }
  databaseCount += 1;
  const session = await server.createDatabase(`f_${String(databaseCount)}`);
  openSessions.push(session);
  const { file, diagnostics } = generatePostgresql(schema, {});
  // An empty output has no statement to send.
  if (file.content.trim() !== "") {
    await session.execute(file.content);
  }
  return { session, diagnostics };
}

function countKeptRelations(
  schema: SchemaDocument,
  diagnostics: readonly GeneratorDiagnostic[],
): number {
  const droppedCount = diagnostics.filter(
    (diagnostic) =>
      diagnostic.code === "key-column-type-not-indexable" &&
      diagnostic.path[0] === "relations",
  ).length;
  return sortRelations(schema).length - droppedCount;
}

async function readCount(
  session: DatabaseSession,
  sql: string,
): Promise<number> {
  const [row] = countShape.parse(await session.query(sql));
  return row?.count ?? Number.NaN;
}

describe.each(listConformanceFixtures())(
  "postgresql ddl for $name",
  ({ schema: fixtureSchema }) => {
    const schema = withDialectCustomTypes(fixtureSchema, DIALECT);

    it("runs the ddl without errors and creates every table", async () => {
      const { session } = await runDdl(schema);

      expect(await session.countTables()).toBe(sortTables(schema).length);
    });

    it("creates one foreign key per relation that the generator kept", async () => {
      const { session, diagnostics } = await runDdl(schema);

      expect(await readCount(session, COUNT_FOREIGN_KEYS_SQL)).toBe(
        countKeptRelations(schema, diagnostics),
      );
    });
  },
);

describe.each(
  listConformanceFixtures().filter((fixture) => fixture.name === "naming-edge"),
)("postgresql comments for $name", ({ schema: fixtureSchema }) => {
  const schema = withDialectCustomTypes(fixtureSchema, DIALECT);

  it("stores comments with every quote character", async () => {
    const { session } = await runDdl(schema);
    const stored = tableCommentShape.parse(
      await session.query(TABLE_COMMENTS_SQL),
    );
    const byName = new Map(stored.map((row) => [row.name, row.comment]));

    expect(
      sortTables(schema).map((table) => [table.name, byName.get(table.name)]),
    ).toStrictEqual(
      sortTables(schema).map((table) => [
        table.name,
        table.comment === "" ? null : table.comment,
      ]),
    );
  });
});
