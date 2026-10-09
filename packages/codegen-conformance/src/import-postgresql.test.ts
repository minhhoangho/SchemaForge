import { generatePostgresql } from "@schemaforge/core/generators/postgresql";
import { importPostgresql } from "@schemaforge/core/importers/sql";
import { unwrapOk } from "@schemaforge/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createImportOptions,
  startDumpServer,
} from "./support/database-dump.js";
import type { DumpServer } from "./support/database-dump.js";
import { normalizeDatabaseForms } from "./support/database-forms.js";
import {
  listConformanceFixtures,
  withDialectCustomTypes,
} from "./support/fixtures.js";

const DIALECT = "postgresql";

let server: DumpServer | undefined;
let databaseCount = 0;

beforeAll(async () => {
  server = await startDumpServer(DIALECT);
});

afterAll(async () => {
  await server?.stop();
});

async function dumpDdl(ddl: string): Promise<string> {
  if (server === undefined) {
    throw new Error("The PostgreSQL server did not start");
  }
  databaseCount += 1;
  const database = await server.createDatabase(
    `f_${String(databaseCount)}`,
    ddl,
  );
  return database.dump();
}

describe.each(listConformanceFixtures())(
  "postgresql dump import for $name",
  ({ schema: fixtureSchema }) => {
    const schema = withDialectCustomTypes(fixtureSchema, DIALECT);

    it("regenerates the original ddl from the import of the pg_dump output", async () => {
      const ddl = generatePostgresql(schema, {}).file.content;
      const dump = await dumpDdl(ddl);

      const imported = unwrapOk(
        importPostgresql(dump, createImportOptions(schema.name)),
      );

      // Only values the database keeps in its own canonical form may differ.
      expect(
        generatePostgresql(
          normalizeDatabaseForms(imported.document, DIALECT),
          {},
        ).file.content,
      ).toBe(
        generatePostgresql(normalizeDatabaseForms(schema, DIALECT), {}).file
          .content,
      );
    });
  },
);
