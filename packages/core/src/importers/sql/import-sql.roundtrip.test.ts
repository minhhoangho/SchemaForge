import { describe, expect, it } from "vitest";

import { generateMysql } from "../../generators/mysql/generate-mysql.js";
import { generatePostgresql } from "../../generators/postgresql/generate-postgresql.js";
import { generateSqlServer } from "../../generators/sqlserver/generate-sqlserver.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { createImportTestOptions } from "../../testing/import-test-options.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { unwrapOk } from "../../testing/unwrap-result.js";
import type { ImportDiagnosticCode } from "../shared/import-diagnostic-codes.js";
import type { Importer } from "../shared/import-types.js";
import {
  importMysql,
  importPostgresql,
  importSqlserver,
} from "./import-sql.js";

// SQL Server has no enums: CG-01 writes them as CHECK (… IN (…)), which the
// importer turns back into enums (spec section 5).
// The target-limit fixture is large; @dbml/core is slower on a loaded machine.
const PARSE_TIMEOUT = { timeout: 120_000 };

type RoundTripCase = {
  readonly dialect: string;
  readonly fixture: string;
  readonly schema: SchemaDocument;
  readonly generate: (schema: SchemaDocument) => string;
  readonly importSql: Importer;
  readonly codes: readonly ImportDiagnosticCode[];
};

const generators = {
  postgresql: (schema: SchemaDocument) =>
    generatePostgresql(schema, {}).file.content,
  mysql: (schema: SchemaDocument) => generateMysql(schema, {}).file.content,
  sqlserver: (schema: SchemaDocument) =>
    generateSqlServer(schema, {}).file.content,
};

const CASES: readonly RoundTripCase[] = [
  {
    dialect: "postgresql",
    fixture: "sample",
    schema: createSampleSchema(),
    generate: generators.postgresql,
    importSql: importPostgresql,
    codes: [],
  },
  {
    dialect: "postgresql",
    fixture: "naming-edge",
    schema: createNamingEdgeSchema(),
    generate: generators.postgresql,
    importSql: importPostgresql,
    codes: [],
  },
  {
    dialect: "postgresql",
    fixture: "target-limit",
    schema: createTargetLimitSchema(),
    generate: generators.postgresql,
    importSql: importPostgresql,
    codes: [],
  },
  {
    dialect: "mysql",
    fixture: "sample",
    schema: createSampleSchema(),
    generate: generators.mysql,
    importSql: importMysql,
    codes: [],
  },
  {
    dialect: "mysql",
    fixture: "naming-edge",
    schema: createNamingEdgeSchema(),
    generate: generators.mysql,
    importSql: importMysql,
    codes: [],
  },
  {
    dialect: "mysql",
    fixture: "target-limit",
    schema: createTargetLimitSchema(),
    generate: generators.mysql,
    importSql: importMysql,
    codes: [],
  },
  {
    dialect: "sqlserver",
    fixture: "sample",
    schema: createSampleSchema(),
    generate: generators.sqlserver,
    importSql: importSqlserver,
    codes: ["check-converted-to-enum"],
  },
  {
    dialect: "sqlserver",
    fixture: "naming-edge",
    schema: createNamingEdgeSchema(),
    generate: generators.sqlserver,
    importSql: importSqlserver,
    codes: ["check-converted-to-enum"],
  },
  {
    dialect: "sqlserver",
    fixture: "target-limit",
    schema: createTargetLimitSchema(),
    generate: generators.sqlserver,
    importSql: importSqlserver,
    codes: ["check-converted-to-enum"],
  },
];

describe("sql importers round trip", PARSE_TIMEOUT, () => {
  it.each(CASES)(
    "regenerates the same $dialect ddl from the import of the $fixture fixture",
    ({ schema, generate, importSql, codes }) => {
      const ddl = generate(schema);

      const imported = unwrapOk(importSql(ddl, createImportTestOptions()));

      expect({
        ddl: generate(imported.document),
        codes: [...new Set(imported.diagnostics.map(({ code }) => code))],
      }).toStrictEqual({ ddl, codes });
    },
  );
});
