import { describe, expect, it } from "vitest";

import type { SchemaDocument } from "../../model/schema-document.js";
import { createImportTestOptions } from "../../testing/import-test-options.js";
import { toComparableSchema } from "../../testing/to-comparable-schema.js";
import { unwrapError, unwrapOk } from "../../testing/unwrap-result.js";
import {
  MAX_IMPORTED_ELEMENTS,
  MAX_IMPORT_SOURCE_LENGTH,
} from "../shared/import-limits.js";
import type {
  ImportDiagnostic,
  ImportSuccess,
  Importer,
} from "../shared/import-types.js";
import {
  MYSQLDUMP_EXPECTED,
  MYSQLDUMP_EXPECTED_DIAGNOSTICS,
  MYSQLDUMP_SOURCE,
} from "./fixtures/mysqldump.fixture.js";
import {
  PG_DUMP_EXPECTED,
  PG_DUMP_EXPECTED_DIAGNOSTICS,
  PG_DUMP_SOURCE,
} from "./fixtures/pg-dump.fixture.js";
import {
  SSMS_SCRIPT_EXPECTED,
  SSMS_SCRIPT_EXPECTED_DIAGNOSTICS,
  SSMS_SCRIPT_SOURCE,
} from "./fixtures/ssms-script.fixture.js";
import {
  UNSUPPORTED_STATEMENTS_EXPECTED,
  UNSUPPORTED_STATEMENTS_EXPECTED_DIAGNOSTICS,
  UNSUPPORTED_STATEMENTS_SOURCE,
} from "./fixtures/unsupported-statements.fixture.js";
import {
  importMysql,
  importPostgresql,
  importSqlserver,
} from "./import-sql.js";

// @dbml/core parses a few thousand lines per second; a loaded machine is slower.
const PARSE_TIMEOUT = { timeout: 60_000 };
const LARGE_SOURCE_TIMEOUT = { timeout: 300_000 };

function importSource(importer: Importer, source: string): ImportSuccess {
  return unwrapOk(importer(source, createImportTestOptions()));
}

function diagnosticsOf(
  importer: Importer,
  source: string,
): readonly ImportDiagnostic[] {
  return importSource(importer, source).diagnostics;
}

function diagnostic(
  code: ImportDiagnostic["code"],
  line: number,
  column: number,
  path: ImportDiagnostic["path"] = null,
): ImportDiagnostic {
  return { code, location: { line, column }, path };
}

const TABLE = "CREATE TABLE t (a int);\n";

// One table with one column per element: the table pushes the count over.
const TOO_MANY_ELEMENTS_SOURCE = `CREATE TABLE t (\n${Array.from(
  { length: MAX_IMPORTED_ELEMENTS },
  (_, index) => `  c${String(index)} int`,
).join(",\n")}\n);\n`;

describe("sql importers", PARSE_TIMEOUT, () => {
  describe("statements", () => {
    it.each(
      UNSUPPORTED_STATEMENTS_EXPECTED_DIAGNOSTICS.map((expected) => [
        expected.code,
        expected.location?.line,
        expected,
      ]),
    )(
      "reports each unsupported statement kind at its position: %s on line %d",
      (_code, _line, expected) => {
        expect(
          diagnosticsOf(importPostgresql, UNSUPPORTED_STATEMENTS_SOURCE),
        ).toContainEqual(expected);
      },
    );

    it("imports the unsupported statements fixture", () => {
      const imported = importSource(
        importPostgresql,
        UNSUPPORTED_STATEMENTS_SOURCE,
      );

      expect({
        document: toComparableSchema(imported.document),
        diagnostics: imported.diagnostics,
      }).toStrictEqual({
        document: toComparableSchema(UNSUPPORTED_STATEMENTS_EXPECTED),
        diagnostics: UNSUPPORTED_STATEMENTS_EXPECTED_DIAGNOSTICS,
      });
    });

    it.each([
      ["postgresql", importPostgresql, "ALTER TABLE t ADD COLUMN b int;"],
      ["postgresql", importPostgresql, "ALTER TABLE t ADD b int;"],
      ["mysql", importMysql, "ALTER TABLE `t` ADD COLUMN `b` int;"],
      ["mysql", importMysql, "ALTER TABLE `t` ADD UNIQUE (`a`);"],
      [
        "mysql",
        importMysql,
        "ALTER TABLE `t` ADD CONSTRAINT `u` UNIQUE (`a`);",
      ],
      [
        "sqlserver",
        importSqlserver,
        "ALTER TABLE [t] ADD CONSTRAINT [DF_t_a] DEFAULT ((0)) FOR [a]",
      ],
    ])(
      "reports add column on postgresql and mysql and add unique on mysql as statement-not-supported in %s: %s",
      (_dialect, importer, statement) => {
        expect(diagnosticsOf(importer, `${TABLE}${statement}\n`)).toStrictEqual(
          [diagnostic("statement-not-supported", 2, 1)],
        );
      },
    );

    it("reports data statements once at the first one", () => {
      const source = `${TABLE}INSERT INTO t VALUES (1);\nUPDATE t SET a = 2;\nDELETE FROM t;\n`;

      expect(diagnosticsOf(importPostgresql, source)).toStrictEqual([
        diagnostic("data-statements-ignored", 2, 1),
      ]);
    });

    it.each([
      [
        "postgresql",
        importPostgresql,
        "SET client_encoding = 'UTF8';\nDROP TABLE IF EXISTS t;\nBEGIN;\nCREATE TABLE t (a int);\nCOMMIT;\n",
      ],
      [
        "mysql",
        importMysql,
        "/*!40101 SET NAMES utf8mb4 */;\nDROP TABLE IF EXISTS `t`;\nSET FOREIGN_KEY_CHECKS = 0;\nCREATE TABLE `t` (`a` int);\n",
      ],
      [
        "sqlserver",
        importSqlserver,
        "USE [shop]\nGO\nSET ANSI_NULLS ON\nGO\nDROP TABLE IF EXISTS [t]\nGO\nCREATE TABLE [t] ([a] int)\nGO\n",
      ],
    ])(
      "skips drop and session statements silently in %s",
      (_dialect, importer, source) => {
        const imported = importSource(importer, source);

        expect({
          tables: Object.values(imported.document.tables).map(
            ({ name }) => name,
          ),
          diagnostics: imported.diagnostics,
        }).toStrictEqual({ tables: ["t"], diagnostics: [] });
      },
    );

    it("keeps parser positions after masking statements", () => {
      const source =
        "CREATE VIEW v AS\n  SELECT 1;\nCREATE TABLE t (\n  a int,\n  b int NOT NOT NULL\n);\n";

      expect(
        unwrapError(importPostgresql(source, createImportTestOptions())),
      ).toStrictEqual({
        diagnostics: [
          {
            code: "syntax-error",
            location: { line: 5, column: 13 },
            path: null,
          },
        ],
      });
    });
  });

  describe("scanner reads", () => {
    it("reads an identity added through alter table in a pg_dump fixture", () => {
      const { document } = importSource(importPostgresql, PG_DUMP_SOURCE);

      expect(
        Object.values(document.columns)
          .filter(({ isAutoIncrement }) => isAutoIncrement)
          .map(({ tableId, name }) => [document.tables[tableId]?.name, name]),
      ).toStrictEqual([
        ["customers", "id"],
        ["order_items", "id"],
        ["orders", "id"],
      ]);
    });

    it("splits sql server identity from the type and reports identity-options-dropped for other seeds", () => {
      const source =
        "CREATE TABLE [t] (\n  [a] [int] IDENTITY(1,1) NOT NULL,\n  [b] bigint IDENTITY(100, 5) NOT NULL\n)\n";

      const imported = importSource(importSqlserver, source);

      expect({
        columns: Object.values(imported.document.columns).map(
          ({ type, isAutoIncrement }) => ({ type, isAutoIncrement }),
        ),
        diagnostics: imported.diagnostics,
      }).toStrictEqual({
        columns: [
          { type: { kind: "integer" }, isAutoIncrement: true },
          { type: { kind: "bigint" }, isAutoIncrement: true },
        ],
        diagnostics: [
          diagnostic("identity-options-dropped", 3, 3, [
            "columns",
            "col_3",
            "isAutoIncrement",
          ]),
        ],
      });
    });

    it.each([
      [
        "postgresql",
        importPostgresql,
        "ALTER TABLE t ALTER COLUMN a SET DEFAULT;",
      ],
      [
        "postgresql",
        importPostgresql,
        "ALTER TABLE t ALTER COLUMN missing SET DEFAULT 1;",
      ],
      [
        "sqlserver",
        importSqlserver,
        "EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'x', @level0type=N'SCHEMA', @level0name=N'dbo', @level1type=N'TABLE', @level1name=N't', @level2type=N'INDEX', @level2name=N'i'",
      ],
      [
        "sqlserver",
        importSqlserver,
        "EXEC sys.sp_addextendedproperty @name=N'MS_Description', @value=N'x', @level0type=N'SCHEMA', @level0name=N'dbo', @level1type=N'TABLE', @level1name=N'missing'",
      ],
    ])(
      "reports a statement the %s scanner cannot apply as statement-not-supported: %s",
      (_dialect, importer, statement) => {
        expect(diagnosticsOf(importer, `${TABLE}${statement}\n`)).toStrictEqual(
          [diagnostic("statement-not-supported", 2, 1)],
        );
      },
    );

    it("reads sql server descriptions as comments", () => {
      const { document } = importSource(importSqlserver, SSMS_SCRIPT_SOURCE);

      expect({
        table: document.tables.tbl_1?.comment,
        column: document.columns.col_4?.comment,
      }).toStrictEqual({
        table: "Store customers",
        column: "Login e-mail, it's unique",
      });
    });
  });

  describe("fixtures", () => {
    it.each<
      [string, Importer, string, SchemaDocument, readonly ImportDiagnostic[]]
    >([
      [
        "pg_dump",
        importPostgresql,
        PG_DUMP_SOURCE,
        PG_DUMP_EXPECTED,
        PG_DUMP_EXPECTED_DIAGNOSTICS,
      ],
      [
        "mysqldump",
        importMysql,
        MYSQLDUMP_SOURCE,
        MYSQLDUMP_EXPECTED,
        MYSQLDUMP_EXPECTED_DIAGNOSTICS,
      ],
      [
        "ssms",
        importSqlserver,
        SSMS_SCRIPT_SOURCE,
        SSMS_SCRIPT_EXPECTED,
        SSMS_SCRIPT_EXPECTED_DIAGNOSTICS,
      ],
    ])(
      "imports the %s fixture",
      (_name, importer, source, expected, diagnostics) => {
        const imported = importSource(importer, source);

        expect({
          document: toComparableSchema(imported.document),
          diagnostics: imported.diagnostics,
        }).toStrictEqual({
          document: toComparableSchema(expected),
          diagnostics,
        });
      },
    );
  });

  describe("failures", () => {
    it.each([
      [
        "a parser error",
        importMysql,
        "CREATE TABLE `t` (\n  `a` int,\n  `b` int NOT NOT NULL\n);\n",
        3,
        15,
      ],
      [
        "an unterminated string",
        importPostgresql,
        `${TABLE}SELECT 'x;\n`,
        2,
        8,
      ],
    ])(
      "reports a syntax error with line and column for %s",
      (_case, importer, source, line, column) => {
        expect(
          unwrapError(importer(source, createImportTestOptions())),
        ).toStrictEqual({
          diagnostics: [
            { code: "syntax-error", location: { line, column }, path: null },
          ],
        });
      },
    );

    it("reports source-too-large one code unit over the limit", () => {
      expect(
        unwrapError(
          importPostgresql(
            " ".repeat(MAX_IMPORT_SOURCE_LENGTH + 1),
            createImportTestOptions(),
          ),
        ),
      ).toStrictEqual({
        diagnostics: [{ code: "source-too-large", location: null, path: null }],
      });
    });

    it(
      "imports a source of exactly the length limit",
      LARGE_SOURCE_TIMEOUT,
      () => {
        const source = TABLE.padEnd(MAX_IMPORT_SOURCE_LENGTH, " ");

        expect(diagnosticsOf(importPostgresql, source)).toStrictEqual([]);
      },
    );

    it(
      "reports too-many-elements past the element limit",
      LARGE_SOURCE_TIMEOUT,
      () => {
        expect(
          unwrapError(
            importPostgresql(
              TOO_MANY_ELEMENTS_SOURCE,
              createImportTestOptions(),
            ),
          ),
        ).toStrictEqual({
          diagnostics: [
            { code: "too-many-elements", location: null, path: null },
          ],
        });
      },
    );
  });

  describe("diagnostic codes", () => {
    it.each<[string, Importer, string, readonly ImportDiagnostic[]]>([
      [
        "reference-not-found",
        importPostgresql,
        `${TABLE}CREATE INDEX t_b_idx ON t (b);\n`,
        [diagnostic("reference-not-found", 2, 1)],
      ],
      [
        "namespace-dropped",
        importPostgresql,
        "CREATE TABLE sales.t (a int);\n",
        [diagnostic("namespace-dropped", 1, 1, ["tables", "tbl_1"])],
      ],
      [
        "index-expression-not-supported",
        importPostgresql,
        `${TABLE}CREATE INDEX t_lower_idx ON t (lower(a::text));\n`,
        [diagnostic("index-expression-not-supported", 2, 1)],
      ],
      [
        "index-type-dropped",
        importPostgresql,
        `${TABLE}CREATE INDEX t_a_idx ON t USING hash (a);\n`,
        [diagnostic("index-type-dropped", 2, 1, ["indexes", "idx_3"])],
      ],
      [
        "check-converted-to-enum",
        importSqlserver,
        "CREATE TABLE [t] (\n  [s] nvarchar(10) CHECK ([s] IN (N'a', N'b'))\n)\n",
        [
          diagnostic("check-converted-to-enum", 2, 3, [
            "columns",
            "col_3",
            "type",
          ]),
        ],
      ],
      [
        "check-constraint-not-supported",
        importPostgresql,
        "CREATE TABLE t (\n  a int CHECK (a > 0)\n);\n",
        [diagnostic("check-constraint-not-supported", 2, 3)],
      ],
      [
        "computed-column-not-supported",
        importPostgresql,
        "CREATE TABLE t (\n  a int,\n  b int GENERATED ALWAYS AS (a + 1) STORED\n);\n",
        [
          diagnostic("computed-column-not-supported", 3, 3, [
            "columns",
            "col_3",
          ]),
        ],
      ],
      [
        "type-approximated",
        importMysql,
        "CREATE TABLE `t` (\n  `a` mediumint\n);\n",
        [diagnostic("type-approximated", 2, 3, ["columns", "col_2", "type"])],
      ],
      [
        "type-parameter-dropped",
        importPostgresql,
        'CREATE TABLE t (\n  a text COLLATE "C"\n);\n',
        [
          diagnostic("type-parameter-dropped", 2, 3, [
            "columns",
            "col_2",
            "type",
          ]),
        ],
      ],
      [
        "identity-options-dropped",
        importSqlserver,
        "CREATE TABLE [t] (\n  [a] int IDENTITY(0, 1)\n)\n",
        [
          diagnostic("identity-options-dropped", 2, 3, [
            "columns",
            "col_2",
            "isAutoIncrement",
          ]),
        ],
      ],
      [
        "type-not-supported",
        importMysql,
        "CREATE TABLE `t` (\n  `a` set('x','y')\n);\n",
        [diagnostic("type-not-supported", 2, 3, ["columns", "col_2", "type"])],
      ],
      [
        "default-approximated",
        importSqlserver,
        "CREATE TABLE [t] (\n  [a] uniqueidentifier DEFAULT newsequentialid()\n)\n",
        [
          diagnostic("default-approximated", 2, 3, [
            "columns",
            "col_2",
            "defaultValue",
          ]),
        ],
      ],
      [
        "sequence-default-as-auto-increment",
        importPostgresql,
        "CREATE TABLE t (\n  id bigint DEFAULT nextval('t_id_seq'::regclass)\n);\n",
        [
          diagnostic("sequence-default-as-auto-increment", 2, 3, [
            "columns",
            "col_2",
            "isAutoIncrement",
          ]),
        ],
      ],
      [
        "default-not-supported",
        importPostgresql,
        "CREATE TABLE t (\n  a int DEFAULT (1 + 2)\n);\n",
        [
          diagnostic("default-not-supported", 2, 3, [
            "columns",
            "col_2",
            "defaultValue",
          ]),
        ],
      ],
      [
        "on-update-not-supported",
        importMysql,
        "CREATE TABLE `t` (\n  `a` datetime(6) ON UPDATE CURRENT_TIMESTAMP(6)\n);\n",
        [diagnostic("on-update-not-supported", 2, 3, ["columns", "col_2"])],
      ],
      [
        "index-option-dropped",
        importPostgresql,
        `${TABLE}CREATE INDEX t_a_idx ON t (a DESC);\n`,
        [diagnostic("index-option-dropped", 2, 1, ["indexes", "idx_3"])],
      ],
    ])(
      "reports %s with its location and path",
      (_code, importer, source, expected) => {
        expect(diagnosticsOf(importer, source)).toStrictEqual(expected);
      },
    );

    it.each([
      ["postgresql", importPostgresql, "CREATE INDEX i ON missing (a);"],
      ["mysql", importMysql, "CREATE INDEX `i` ON `missing` (`a`);"],
      [
        "sqlserver",
        importSqlserver,
        "CREATE INDEX [i] ON [dbo].[missing] ([a])",
      ],
    ])(
      "reports reference-not-found for an index on a table the %s source does not create",
      (_dialect, importer, statement) => {
        expect(diagnosticsOf(importer, `${TABLE}${statement}\n`)).toStrictEqual(
          [diagnostic("reference-not-found", 2, 1)],
        );
      },
    );
  });
});
