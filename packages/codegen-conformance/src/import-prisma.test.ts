import type { SchemaDocument } from "@schemaforge/core";
import { generateMysql } from "@schemaforge/core/generators/mysql";
import { generatePostgresql } from "@schemaforge/core/generators/postgresql";
import { importPrisma } from "@schemaforge/core/importers/prisma";
import { PRISMA_IMPORT_FIXTURES, unwrapOk } from "@schemaforge/core/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createImportOptions,
  pullPrismaSchema,
  startDumpServer,
} from "./support/database-dump.js";
import type { DumpDialect, DumpServer } from "./support/database-dump.js";
import { normalizeDatabaseForms } from "./support/database-forms.js";
import {
  listConformanceFixtures,
  withDialectCustomTypes,
} from "./support/fixtures.js";
import { runPrismaValidate } from "./support/prisma-cli.js";

const GENERATE_DDL: Readonly<
  Record<DumpDialect, (schema: SchemaDocument) => string>
> = {
  postgresql: (schema) => generatePostgresql(schema, {}).file.content,
  mysql: (schema) => generateMysql(schema, {}).file.content,
};

const DIALECTS: readonly DumpDialect[] = ["postgresql", "mysql"];

// prisma db pull fails on a database without tables, so the empty fixture has
// nothing to introspect. On naming-edge it prints a schema Prisma itself
// rejects (a model without a name for the table 用户, two models named
// public_order_items), so there is no valid schema to import.
const PULL_FIXTURES = listConformanceFixtures().filter(
  ({ name }) => name !== "empty" && name !== "naming-edge",
);

// Each step removes, from both sides, one thing that Prisma introspection does
// not carry, so the comparison still covers everything else.
function normalizeIntrospectionDifferences(
  schema: SchemaDocument,
  dialect: DumpDialect,
): SchemaDocument {
  const forms = normalizeDatabaseForms(schema, dialect);
  // A unique index on one column is written as @unique(map: "…"), which the
  // importer reads as a unique column (spec section 6).
  const uniqueColumnIds = new Set(
    Object.values(forms.indexes)
      .filter((index) => index.isUnique && index.columnIds.length === 1)
      .flatMap((index) => index.columnIds),
  );
  return {
    ...forms,
    // Introspection does not read database comments, and writes its own
    // warnings (a table without a key, a table with comments) as /// comments.
    tables: Object.fromEntries(
      Object.entries(forms.tables).map(([id, table]) => [
        id,
        { ...table, comment: "" },
      ]),
    ),
    columns: Object.fromEntries(
      Object.entries(forms.columns).map(([id, column]) => [
        id,
        {
          ...column,
          comment: "",
          isUnique: column.isUnique || uniqueColumnIds.has(column.id),
        },
      ]),
    ),
    indexes: Object.fromEntries(
      Object.entries(forms.indexes).filter(
        ([, index]) => !(index.isUnique && index.columnIds.length === 1),
      ),
    ),
  };
}

describe.each(DIALECTS)("prisma db pull on %s", (dialect) => {
  const generateDdl = GENERATE_DDL[dialect];
  let server: DumpServer | undefined;
  let databaseCount = 0;

  beforeAll(async () => {
    server = await startDumpServer(dialect);
  });

  afterAll(async () => {
    await server?.stop();
  });

  async function pullDdl(ddl: string): Promise<string> {
    if (server === undefined) {
      throw new Error(`The ${dialect} server did not start`);
    }
    databaseCount += 1;
    const database = await server.createDatabase(
      `p_${String(databaseCount)}`,
      ddl,
    );
    return pullPrismaSchema(database.url, dialect);
  }

  it.each(PULL_FIXTURES)(
    "regenerates the original ddl from the import of the introspected $name schema",
    async ({ schema: fixtureSchema }) => {
      const schema = withDialectCustomTypes(fixtureSchema, dialect);
      const pulled = await pullDdl(generateDdl(schema));

      const imported = unwrapOk(
        importPrisma(pulled, createImportOptions(schema.name)),
      );

      expect(
        generateDdl(
          normalizeIntrospectionDifferences(imported.document, dialect),
        ),
      ).toBe(generateDdl(normalizeIntrospectionDifferences(schema, dialect)));
    },
  );
});

describe("prisma import fixtures", () => {
  it.each(PRISMA_IMPORT_FIXTURES)(
    "passes prisma validate for $name",
    async ({ source }) => {
      const result = await runPrismaValidate(source);

      // On failure the diff shows the CLI output.
      expect({
        exitCode: result.exitCode,
        output: result.output,
      }).toStrictEqual({ exitCode: 0, output: result.output });
    },
  );
});
