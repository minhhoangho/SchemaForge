import { sortRelations, sortTables } from "@schemaforge/core";
import type { SchemaDocument, SqlDialect } from "@schemaforge/core";
import { generateMysql } from "@schemaforge/core/generators/mysql";
import { generatePostgresql } from "@schemaforge/core/generators/postgresql";
import {
  buildSeedDataset,
  generateSeed,
} from "@schemaforge/core/generators/seed";
import { generateSqlServer } from "@schemaforge/core/generators/sqlserver";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { startDatabaseServer, tryExecute } from "./support/containers.js";
import type {
  DatabaseServer,
  DatabaseSession,
  SqlOutcome,
} from "./support/containers.js";
import {
  listConformanceFixtures,
  withDialectCustomTypes,
} from "./support/fixtures.js";

const SEED_OPTIONS = { rowsPerTable: 5, seed: 1 } as const;
const ACCEPTED: SqlOutcome = { isAccepted: true, codes: [], message: "" };

const GENERATE_DDL: Readonly<
  Record<SqlDialect, (schema: SchemaDocument) => string>
> = {
  postgresql: (schema) => generatePostgresql(schema, {}).file.content,
  mysql: (schema) => generateMysql(schema, {}).file.content,
  sqlserver: (schema) => generateSqlServer(schema, {}).file.content,
};

// Counts the NULLs of every foreign key column; the names are quoted by the
// server (`format('%I')`), so the query stays fixed.
const FOREIGN_KEY_NULL_COUNTS_SQL = `SELECT cl.relname AS table_name, a.attname AS column_name,
  (xpath('/row/count/text()', query_to_xml(format('SELECT COUNT(*) AS count FROM %I.%I WHERE %I IS NULL', n.nspname, cl.relname, a.attname), false, true, '')))[1]::text AS null_count
FROM pg_constraint c
JOIN pg_class cl ON cl.oid = c.conrelid
JOIN pg_namespace n ON n.oid = cl.relnamespace
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
WHERE c.contype = 'f'`;

const nullCountShape = z.array(
  z.object({
    table_name: z.string(),
    column_name: z.string(),
    null_count: z.coerce.number(),
  }),
);

const openSessions: DatabaseSession[] = [];
let databaseCount = 0;

afterEach(async () => {
  await Promise.all(openSessions.splice(0).map((session) => session.close()));
});

// Starts the dialect's server for the enclosing describe only, so the three
// servers run one after another.
function useDatabaseServer(dialect: SqlDialect): () => DatabaseServer {
  let server: DatabaseServer | undefined;
  beforeAll(async () => {
    server = await startDatabaseServer(dialect);
  });
  afterAll(async () => {
    await server?.stop();
  });
  return () => {
    if (server === undefined) {
      throw new Error(`The ${dialect} server did not start`);
    }
    return server;
  };
}

// The MySQL driver rejects an empty query, so an empty output is not sent.
async function executeOutput(
  session: DatabaseSession,
  content: string,
): Promise<SqlOutcome> {
  return content.trim() === "" ? ACCEPTED : tryExecute(session, content);
}

type SeedRun = {
  readonly session: DatabaseSession;
  readonly ddl: SqlOutcome;
  readonly seed: SqlOutcome;
};

async function runDdlAndSeed(
  server: DatabaseServer,
  schema: SchemaDocument,
): Promise<SeedRun> {
  databaseCount += 1;
  const session = await server.createDatabase(`f_${String(databaseCount)}`);
  openSessions.push(session);
  const ddl = await executeOutput(
    session,
    GENERATE_DDL[server.dialect](schema),
  );
  const seed = await executeOutput(
    session,
    generateSeed(schema, { format: server.dialect, ...SEED_OPTIONS }).file
      .content,
  );
  return { session, ddl, seed };
}

function expectedRowCounts(
  schema: SchemaDocument,
): readonly (readonly [string, number])[] {
  const { dataset } = buildSeedDataset(schema, SEED_OPTIONS);
  return sortTables(schema).map((table) => [
    table.name,
    dataset.tables.find((entry) => entry.tableId === table.id)?.rows.length ??
      0,
  ]);
}

async function readRowCounts(
  session: DatabaseSession,
  schema: SchemaDocument,
): Promise<readonly (readonly [string, number])[]> {
  // One connection runs one query at a time (pg deprecates overlapping calls).
  const counts: (readonly [string, number])[] = [];
  for (const table of sortTables(schema)) {
    counts.push([table.name, await session.countRows(table.name)]);
  }
  return counts;
}

// A relation is deferred when its table loads before the table it references:
// the seed inserts NULL first and fills the column by UPDATE at the end.
function listDeferredColumns(
  schema: SchemaDocument,
): readonly (readonly [string, string])[] {
  const { dataset } = buildSeedDataset(schema, SEED_OPTIONS);
  const loadOrder = dataset.tables.map((entry) => entry.tableId);
  return sortRelations(schema)
    .filter((relation) => {
      const fromIndex = loadOrder.indexOf(relation.fromTableId);
      const toIndex = loadOrder.indexOf(relation.toTableId);
      return fromIndex !== -1 && toIndex !== -1 && fromIndex < toIndex;
    })
    .flatMap((relation) =>
      relation.columnPairs.map((pair): readonly [string, string] => [
        schema.tables[relation.fromTableId]?.name ?? "",
        schema.columns[pair.fromColumnId]?.name ?? "",
      ]),
    );
}

function defineSeedTests(
  dialect: SqlDialect,
  getServer: () => DatabaseServer,
): void {
  describe.each(listConformanceFixtures())(
    "seed for $name",
    ({ schema: fixtureSchema }) => {
      const schema = withDialectCustomTypes(fixtureSchema, dialect);

      it("runs the seed after the ddl without errors", async () => {
        const { ddl, seed } = await runDdlAndSeed(getServer(), schema);

        expect({ ddl, seed }).toStrictEqual({ ddl: ACCEPTED, seed: ACCEPTED });
      });

      it("inserts the row count of the dataset into every table", async () => {
        const { session } = await runDdlAndSeed(getServer(), schema);

        expect(await readRowCounts(session, schema)).toStrictEqual(
          expectedRowCounts(schema),
        );
      });
    },
  );
}

describe("seed sql on postgresql", () => {
  const getServer = useDatabaseServer("postgresql");
  defineSeedTests("postgresql", getServer);

  describe.each(
    listConformanceFixtures().filter(
      (fixture) => fixture.name === "target-limit",
    ),
  )("deferred relations for $name", ({ schema: fixtureSchema }) => {
    const schema = withDialectCustomTypes(fixtureSchema, "postgresql");

    it("fills deferred relations by update", async () => {
      const { session } = await runDdlAndSeed(getServer(), schema);
      const nullCounts = nullCountShape.parse(
        await session.query(FOREIGN_KEY_NULL_COUNTS_SQL),
      );
      const deferred = listDeferredColumns(schema);

      expect(deferred.length).toBeGreaterThan(0);
      expect(
        deferred.map(([tableName, columnName]) => [
          tableName,
          columnName,
          nullCounts.find(
            (row) =>
              row.table_name === tableName && row.column_name === columnName,
          )?.null_count,
        ]),
      ).toStrictEqual(
        deferred.map(([tableName, columnName]) => [tableName, columnName, 0]),
      );
    });
  });
});

describe("seed sql on mysql", () => {
  defineSeedTests("mysql", useDatabaseServer("mysql"));
});

describe("seed sql on sql server", () => {
  defineSeedTests("sqlserver", useDatabaseServer("sqlserver"));
});
