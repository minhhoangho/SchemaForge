import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { serializeSchemaDocument } from "../model/serialize-schema-document.js";
import {
  PROPERTY_RUNS,
  PROPERTY_SEED,
  schemaDocumentArbitrary,
} from "../testing/arbitraries.js";
import { buildSchema, makeColumn, makeTable } from "../testing/factories.js";
import { createImportTestOptions } from "../testing/import-test-options.js";
import { createSampleSchema } from "../testing/sample-schema.js";
import { unwrapOk } from "../testing/unwrap-result.js";
import { DBML_FEATURES_FIXTURE } from "./dbml/fixtures/dbml-features.fixture.js";
import { importDbml } from "./dbml/import-dbml.js";
import { importJson } from "./json/import-json.js";
import { PRISMA_FEATURES_POSTGRESQL } from "./prisma/fixtures/prisma-features.fixture.js";
import { importPrisma } from "./prisma/import-prisma.js";
import { finalizeImportDiagnostics } from "./shared/import-diagnostics.js";
import type {
  ImportDiagnostic,
  ImportResult,
  Importer,
} from "./shared/import-types.js";
import { MYSQLDUMP_SOURCE } from "./sql/fixtures/mysqldump.fixture.js";
import { PG_DUMP_SOURCE } from "./sql/fixtures/pg-dump.fixture.js";
import { SSMS_SCRIPT_SOURCE } from "./sql/fixtures/ssms-script.fixture.js";
import {
  importMysql,
  importPostgresql,
  importSqlserver,
} from "./sql/import-sql.js";

const PROPERTY_PARAMETERS = { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS };
const PROPERTY_TIMEOUT_MS = 60_000;
const MAX_RANDOM_LENGTH = 400;

// Characters that open or close a construct in at least one format, so an
// insertion often lands on a parser branch rather than inside a name.
const SYNTAX_CHARACTERS = Array.from("\"'`[](){}<>;,.:@=#-/*\\\n\r\t \u0000");

type ImporterCase = {
  readonly name: string;
  readonly importer: Importer;
  readonly fixture: string;
  readonly protoTablesSource: string;
  readonly protoKeySources: readonly (readonly [string, string])[];
};

function diagnosticsOf(result: ImportResult): readonly ImportDiagnostic[] {
  return result.isOk ? result.value.diagnostics : result.error.diagnostics;
}

function sortedTableNames(result: ImportResult): readonly string[] {
  return Object.values(unwrapOk(result).document.tables)
    .map((table) => table.name)
    .toSorted();
}

// The fixture split into words and punctuation, recombined in any order: far
// more of these reach deep parser states than uniformly random strings do.
function fixtureTokens(fixture: string): readonly string[] {
  return fixture
    .split(/(\s+|[()[\]{},;:."'`@=<>])/u)
    .filter((token) => token !== "");
}

function randomStringArbitrary(fixture: string): fc.Arbitrary<string> {
  return fc.oneof(
    fc.string({ unit: "binary", maxLength: MAX_RANDOM_LENGTH }),
    fc.string({ unit: fc.constantFrom(...SYNTAX_CHARACTERS) }),
    fc.string({
      unit: fc.constantFrom(...fixtureTokens(fixture)),
      maxLength: MAX_RANDOM_LENGTH,
    }),
  );
}

function cutFixtureArbitrary(fixture: string): fc.Arbitrary<string> {
  return fc
    .nat({ max: fixture.length })
    .map((position) => fixture.slice(0, position));
}

function insertedCharacterArbitrary(fixture: string): fc.Arbitrary<string> {
  return fc
    .tuple(
      fc.nat({ max: fixture.length }),
      fc.oneof(
        fc.constantFrom(...SYNTAX_CHARACTERS),
        fc.string({ unit: "binary", minLength: 1, maxLength: 1 }),
      ),
    )
    .map(
      ([position, character]) =>
        fixture.slice(0, position) + character + fixture.slice(position),
    );
}

function anySourceArbitrary(fixture: string): fc.Arbitrary<string> {
  return fc.oneof(
    randomStringArbitrary(fixture),
    cutFixtureArbitrary(fixture),
    insertedCharacterArbitrary(fixture),
  );
}

const PRISMA_DATASOURCE = 'datasource db {\n  provider = "postgresql"\n}\n';

// "__proto__" names a table, a column and a referenced table in every SQL
// dialect; "constructor" names the table holding the foreign key.
const SQL_PROTO_SOURCES = {
  postgresql:
    'CREATE TABLE "__proto__" (id integer PRIMARY KEY, "__proto__" integer);\nCREATE TABLE "constructor" (id integer PRIMARY KEY, "__proto__" integer REFERENCES "__proto__" (id));\nCREATE INDEX "__proto__" ON "constructor" ("__proto__");\n',
  mysql:
    "CREATE TABLE `__proto__` (id int PRIMARY KEY, `__proto__` int);\nCREATE TABLE `constructor` (id int PRIMARY KEY, `__proto__` int, FOREIGN KEY (`__proto__`) REFERENCES `__proto__` (id));\nCREATE INDEX `__proto__` ON `constructor` (`__proto__`);\n",
  sqlserver:
    "CREATE TABLE [__proto__] (id int PRIMARY KEY, [__proto__] int);\nCREATE TABLE [constructor] (id int PRIMARY KEY, [__proto__] int REFERENCES [__proto__] (id));\nCREATE INDEX [__proto__] ON [constructor] ([__proto__]);\n",
};

const PRISMA_PROTO_SOURCE = `${PRISMA_DATASOURCE}enum constructor {\n  __proto__\n}\nmodel A {\n  id    Int @id\n  items B[]\n  @@map("__proto__")\n}\nmodel B {\n  id    Int         @id\n  aId   Int         @map("__proto__")\n  kind  constructor\n  a     A           @relation(fields: [aId], references: [id])\n  @@map("constructor")\n}\n`;

const DBML_PROTO_SOURCE =
  'Enum "__proto__" {\n  "__proto__"\n}\nTable "__proto__" {\n  id int [pk]\n}\nTable "constructor" {\n  id int [pk]\n  "__proto__" int [ref: > "__proto__".id]\n  kind "__proto__"\n}\n';

const JSON_PROTO_TABLES_SOURCE = serializeSchemaDocument(
  buildSchema({
    tables: [
      makeTable({ id: "tbl_a", name: "__proto__" }),
      makeTable({ id: "tbl_b", name: "constructor" }),
    ],
    columns: [makeColumn({ id: "col_a", tableId: "tbl_a", name: "__proto__" })],
  }),
);

const EMPTY_JSON_SOURCE = serializeSchemaDocument(buildSchema({}));

const IMPORTER_CASES: readonly ImporterCase[] = [
  {
    name: "importPostgresql",
    importer: importPostgresql,
    fixture: PG_DUMP_SOURCE,
    protoTablesSource: SQL_PROTO_SOURCES.postgresql,
    protoKeySources: [["names", SQL_PROTO_SOURCES.postgresql]],
  },
  {
    name: "importMysql",
    importer: importMysql,
    fixture: MYSQLDUMP_SOURCE,
    protoTablesSource: SQL_PROTO_SOURCES.mysql,
    protoKeySources: [["names", SQL_PROTO_SOURCES.mysql]],
  },
  {
    name: "importSqlserver",
    importer: importSqlserver,
    fixture: SSMS_SCRIPT_SOURCE,
    protoTablesSource: SQL_PROTO_SOURCES.sqlserver,
    protoKeySources: [["names", SQL_PROTO_SOURCES.sqlserver]],
  },
  {
    name: "importPrisma",
    importer: importPrisma,
    fixture: PRISMA_FEATURES_POSTGRESQL,
    protoTablesSource: PRISMA_PROTO_SOURCE,
    protoKeySources: [["names", PRISMA_PROTO_SOURCE]],
  },
  {
    name: "importDbml",
    importer: importDbml,
    fixture: DBML_FEATURES_FIXTURE,
    protoTablesSource: DBML_PROTO_SOURCE,
    protoKeySources: [["names", DBML_PROTO_SOURCE]],
  },
  {
    name: "importJson",
    importer: importJson,
    fixture: serializeSchemaDocument(createSampleSchema()),
    protoTablesSource: JSON_PROTO_TABLES_SOURCE,
    protoKeySources: [
      ["names", JSON_PROTO_TABLES_SOURCE],
      [
        "a map key",
        JSON_PROTO_TABLES_SOURCE.replace('"tbl_b": {', '"__proto__": {'),
      ],
      [
        "a root key",
        EMPTY_JSON_SOURCE.replace("{", '{"__proto__": {"polluted": true},'),
      ],
    ],
  },
];

describe.each(IMPORTER_CASES)(
  "$name properties",
  ({ importer, fixture, protoTablesSource, protoKeySources }) => {
    it(
      "never throws for a random string",
      { timeout: PROPERTY_TIMEOUT_MS },
      () => {
        fc.assert(
          fc.property(randomStringArbitrary(fixture), (source) => {
            expect(() =>
              importer(source, createImportTestOptions()),
            ).not.toThrow();
          }),
          PROPERTY_PARAMETERS,
        );
      },
    );

    it(
      "never throws for a fixture cut at a random position",
      { timeout: PROPERTY_TIMEOUT_MS },
      () => {
        fc.assert(
          fc.property(cutFixtureArbitrary(fixture), (source) => {
            expect(() =>
              importer(source, createImportTestOptions()),
            ).not.toThrow();
          }),
          PROPERTY_PARAMETERS,
        );
      },
    );

    it(
      "never throws for a fixture with a random character inserted",
      { timeout: PROPERTY_TIMEOUT_MS },
      () => {
        fc.assert(
          fc.property(insertedCharacterArbitrary(fixture), (source) => {
            expect(() =>
              importer(source, createImportTestOptions()),
            ).not.toThrow();
          }),
          PROPERTY_PARAMETERS,
        );
      },
    );

    it(
      "returns the same result twice for the same source and id generator",
      { timeout: PROPERTY_TIMEOUT_MS },
      () => {
        fc.assert(
          fc.property(anySourceArbitrary(fixture), (source) => {
            expect(importer(source, createImportTestOptions())).toStrictEqual(
              importer(source, createImportTestOptions()),
            );
          }),
          PROPERTY_PARAMETERS,
        );
      },
    );

    it(
      "returns sorted diagnostics without repeats",
      { timeout: PROPERTY_TIMEOUT_MS },
      () => {
        fc.assert(
          fc.property(anySourceArbitrary(fixture), (source) => {
            const diagnostics = diagnosticsOf(
              importer(source, createImportTestOptions()),
            );

            expect(diagnostics).toStrictEqual(
              finalizeImportDiagnostics(diagnostics),
            );
          }),
          PROPERTY_PARAMETERS,
        );
      },
    );

    it("imports a table named __proto__ and one named constructor", () => {
      expect(
        sortedTableNames(
          importer(protoTablesSource, createImportTestOptions()),
        ),
      ).toStrictEqual(["__proto__", "constructor"]);
    });

    it.each(protoKeySources)(
      "leaves Object.prototype unchanged for sources with __proto__ keys: %s",
      (_kind, source) => {
        const prototypeNames = Object.getOwnPropertyNames(Object.prototype);

        importer(source, createImportTestOptions());

        expect(Object.getOwnPropertyNames(Object.prototype)).toStrictEqual(
          prototypeNames,
        );
      },
    );
  },
);

describe("importJson round trip", () => {
  it(
    "round-trips any valid document through json byte for byte",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(schemaDocumentArbitrary(), (schema) => {
          const source = serializeSchemaDocument(schema);

          const { document } = unwrapOk(
            importJson(source, createImportTestOptions()),
          );

          expect(serializeSchemaDocument(document)).toBe(source);
          expect(document).toStrictEqual(schema);
        }),
        PROPERTY_PARAMETERS,
      );
    },
  );
});
