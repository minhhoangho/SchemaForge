import { describe, test } from "vitest";

import { generatePostgresql } from "../../generators/postgresql/generate-postgresql.js";
import { createLargeSchema } from "../../testing/large-schema.js";
import { parseSqlWithDbmlCore } from "../shared/dbml-core-adapter.js";
import { MAX_IMPORT_SOURCE_LENGTH } from "../shared/import-limits.js";
import { scanSqlStatements } from "./statement-scanner.js";

// No spec targets: these numbers split the SQL import time between the
// scanner and @dbml/core (moved here from the Task 8 and 9 probes).
const LARGE_SCHEMA_TABLE_COUNT = 200;
// One @dbml/core parse takes seconds, so the default of at least 64 samples
// would take minutes.
const PARSE_RUN_OPTIONS = {
  iterations: 10,
  time: 0,
  warmupIterations: 1,
  warmupTime: 0,
};
// Generous, since the machine running benchmarks is often busy.
const BENCH_TIMEOUT_MS = 600_000;

const ddl = generatePostgresql(
  createLargeSchema({ tableCount: LARGE_SCHEMA_TABLE_COUNT }),
  {},
).file.content;
// Whole copies only, so no statement or string is cut at the end.
const scannerSource = ddl.repeat(
  Math.floor(MAX_IMPORT_SOURCE_LENGTH / ddl.length),
);

// A failed scan or parse stops early and would measure only the error path.
function scanOrThrow(): void {
  if (!scanSqlStatements(scannerSource, "postgresql").isOk) {
    throw new Error("benchmark source is rejected by scanSqlStatements");
  }
}

function parseOrThrow(): void {
  if (!parseSqlWithDbmlCore(ddl, "postgresql").isOk) {
    throw new Error("benchmark source is rejected by parseSqlWithDbmlCore");
  }
}

// Vitest 5 registers benchmarks through the `bench` test fixture, not a module export.
describe("sql parsing on createLargeSchema DDL", () => {
  test(
    `scanner on ${String(scannerSource.length)} characters`,
    async ({ bench }) => {
      await bench(
        "scanSqlStatements on a 2 MiB postgresql source",
        scanOrThrow,
      ).run();
    },
    BENCH_TIMEOUT_MS,
  );

  test(
    `@dbml/core on ${String(LARGE_SCHEMA_TABLE_COUNT)} tables`,
    async ({ bench }) => {
      await bench(
        "parseSqlWithDbmlCore on the postgresql DDL of 200 tables",
        parseOrThrow,
      ).run(PARSE_RUN_OPTIONS);
    },
    BENCH_TIMEOUT_MS,
  );
});
