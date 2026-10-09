import { describe, test } from "vitest";

import { generateDbml } from "../generators/dbml/generate-dbml.js";
import { generateMysql } from "../generators/mysql/generate-mysql.js";
import { generatePostgresql } from "../generators/postgresql/generate-postgresql.js";
import { generatePrisma } from "../generators/prisma/generate-prisma.js";
import { generateSqlServer } from "../generators/sqlserver/generate-sqlserver.js";
import { serializeSchemaDocument } from "../model/serialize-schema-document.js";
import { createImportTestOptions } from "../testing/import-test-options.js";
import { createLargeSchema } from "../testing/large-schema.js";
import { importDbml } from "./dbml/import-dbml.js";
import { importJson } from "./json/import-json.js";
import { importPrisma } from "./prisma/import-prisma.js";
import type { Importer } from "./shared/import-types.js";
import {
  importMysql,
  importPostgresql,
  importSqlserver,
} from "./sql/import-sql.js";

// Spec section 14 targets, read from the median: SQL <= 4 s; Prisma, DBML and
// JSON <= 1 s.
const LARGE_SCHEMA_TABLE_COUNT = 200;
// One SQL import takes seconds, so the default of at least 64 samples would
// take minutes per importer.
const SQL_RUN_OPTIONS = {
  iterations: 10,
  time: 0,
  warmupIterations: 1,
  warmupTime: 0,
};
// Generous, since the machine running benchmarks is often busy.
const BENCH_TIMEOUT_MS = 900_000;

type ImporterCase = {
  readonly name: string;
  readonly importer: Importer;
  readonly source: string;
};

const schema = createLargeSchema({ tableCount: LARGE_SCHEMA_TABLE_COUNT });

const SQL_CASES: readonly ImporterCase[] = [
  {
    name: "importPostgresql",
    importer: importPostgresql,
    source: generatePostgresql(schema, {}).file.content,
  },
  {
    name: "importMysql",
    importer: importMysql,
    source: generateMysql(schema, {}).file.content,
  },
  {
    name: "importSqlserver",
    importer: importSqlserver,
    source: generateSqlServer(schema, {}).file.content,
  },
];

const OTHER_CASES: readonly ImporterCase[] = [
  {
    name: "importPrisma",
    importer: importPrisma,
    source: generatePrisma(schema, { provider: "postgresql" }).file.content,
  },
  {
    name: "importDbml",
    importer: importDbml,
    source: generateDbml(schema, {}).file.content,
  },
  {
    name: "importJson",
    importer: importJson,
    source: serializeSchemaDocument(schema),
  },
];

// A rejected source stops early and would measure only the error path.
function importOrThrow(importerCase: ImporterCase): void {
  const { name, importer, source } = importerCase;
  if (!importer(source, createImportTestOptions()).isOk) {
    throw new Error(`benchmark source is rejected by ${name}`);
  }
}

// Vitest 5 registers benchmarks through the `bench` test fixture, not a module export.
describe(`importers on createLargeSchema({ tableCount: ${String(LARGE_SCHEMA_TABLE_COUNT)} })`, () => {
  test(
    "sql importers",
    async ({ bench }) => {
      await bench.compare(
        ...SQL_CASES.map((importerCase) =>
          bench(importerCase.name, () => {
            importOrThrow(importerCase);
          }),
        ),
        SQL_RUN_OPTIONS,
      );
    },
    BENCH_TIMEOUT_MS,
  );

  test(
    "prisma, dbml and json importers",
    async ({ bench }) => {
      await bench.compare(
        ...OTHER_CASES.map((importerCase) =>
          bench(importerCase.name, () => {
            importOrThrow(importerCase);
          }),
        ),
      );
    },
    BENCH_TIMEOUT_MS,
  );
});
