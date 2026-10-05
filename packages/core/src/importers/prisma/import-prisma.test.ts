import { describe, expect, it } from "vitest";

import { createImportTestOptions } from "../../testing/import-test-options.js";
import { toComparableSchema } from "../../testing/to-comparable-schema.js";
import { unwrapError, unwrapOk } from "../../testing/unwrap-result.js";
import {
  MAX_IMPORTED_ELEMENTS,
  MAX_IMPORT_SOURCE_LENGTH,
} from "../shared/import-limits.js";
import type { ImportDiagnostic } from "../shared/import-types.js";
import {
  DB_PULL_MYSQL,
  DB_PULL_MYSQL_EXPECTED,
  DB_PULL_POSTGRESQL,
  DB_PULL_POSTGRESQL_EXPECTED,
} from "./fixtures/db-pull.fixture.js";
import {
  PRISMA_FEATURES_MONGODB,
  PRISMA_FEATURES_MULTI_SCHEMA,
  PRISMA_FEATURES_MYSQL,
  PRISMA_FEATURES_POSTGRESQL,
  PRISMA_FEATURES_SQLSERVER,
} from "./fixtures/prisma-features.fixture.js";
import { importPrisma } from "./import-prisma.js";

function diagnosticsOf(source: string): readonly ImportDiagnostic[] {
  return unwrapOk(importPrisma(source, createImportTestOptions())).diagnostics;
}

function diagnostic(
  code: ImportDiagnostic["code"],
  line: number,
  column: number,
  path: ImportDiagnostic["path"],
): ImportDiagnostic {
  return { code, location: { line, column }, path };
}

const DATASOURCE = 'datasource db {\n  provider = "postgresql"\n}\n';

// One table with one column per field: the table pushes the count over.
const TOO_MANY_ELEMENTS_SOURCE = `model T {\n${Array.from(
  { length: MAX_IMPORTED_ELEMENTS },
  (_, index) => `  f${String(index)} Int\n`,
).join("")}}\n`;

describe("importPrisma", () => {
  it("reports a syntax error with line and column", () => {
    const source = `${DATASOURCE}model User {\n  id Int @id\n  name String = 5\n}\n`;

    expect(
      unwrapError(importPrisma(source, createImportTestOptions())),
    ).toStrictEqual({
      diagnostics: [
        { code: "syntax-error", location: { line: 6, column: 15 }, path: null },
      ],
    });
  });

  it.each([
    ["PostgreSQL", DB_PULL_POSTGRESQL, DB_PULL_POSTGRESQL_EXPECTED, []],
    ["MySQL", DB_PULL_MYSQL, DB_PULL_MYSQL_EXPECTED, []],
  ])("imports the %s db pull fixture", (_, source, expected, diagnostics) => {
    const imported = unwrapOk(importPrisma(source, createImportTestOptions()));

    expect({
      document: toComparableSchema(imported.document),
      diagnostics: imported.diagnostics,
    }).toStrictEqual({
      document: toComparableSchema(expected),
      diagnostics,
    });
  });

  it("imports the PostgreSQL feature fixture with the expected diagnostics", () => {
    expect(diagnosticsOf(PRISMA_FEATURES_POSTGRESQL)).toStrictEqual([
      diagnostic("comment-dropped", 12, 1, ["enums", "enum_1"]),
      diagnostic("comment-dropped", 14, 3, ["enums", "enum_1"]),
      diagnostic("default-approximated", 27, 23, [
        "columns",
        "col_10",
        "defaultValue",
      ]),
      diagnostic("default-not-supported", 28, 23, [
        "columns",
        "col_11",
        "defaultValue",
      ]),
      diagnostic("default-not-supported", 29, 23, [
        "columns",
        "col_12",
        "defaultValue",
      ]),
      diagnostic("default-not-supported", 30, 23, [
        "columns",
        "col_13",
        "defaultValue",
      ]),
      diagnostic("type-parameter-dropped", 32, 40, [
        "columns",
        "col_15",
        "type",
      ]),
      diagnostic("updated-at-not-supported", 33, 23, ["columns", "col_16"]),
      diagnostic("scalar-list-as-custom", 38, 3, ["columns", "col_21", "type"]),
      diagnostic("type-not-supported", 41, 3, ["columns", "col_24", "type"]),
      diagnostic("index-option-dropped", 48, 3, ["indexes", "idx_36"]),
      diagnostic("index-option-dropped", 49, 3, ["indexes", "idx_37"]),
      diagnostic("implicit-many-to-many-not-supported", 67, 3, null),
      diagnostic("index-option-dropped", 71, 3, ["indexes", "idx_40"]),
      diagnostic("view-not-supported", 86, 1, null),
    ]);
  });

  it.each<[string, string, readonly ImportDiagnostic[]]>([
    [
      "MySQL",
      PRISMA_FEATURES_MYSQL,
      [
        // MySQL TEXT and INT UNSIGNED read as in the SQL type table.
        diagnostic("type-approximated", 7, 16, ["columns", "col_3", "type"]),
        diagnostic("type-approximated", 9, 16, ["columns", "col_5", "type"]),
        diagnostic("index-type-dropped", 11, 3, ["indexes", "idx_6"]),
        diagnostic("index-option-dropped", 12, 3, ["indexes", "idx_7"]),
      ],
    ],
    [
      "SQL Server",
      PRISMA_FEATURES_SQLSERVER,
      [
        diagnostic("index-option-dropped", 6, 19, [
          "tables",
          "tbl_1",
          "primaryKeyColumnIds",
        ]),
        diagnostic("index-option-dropped", 7, 19, [
          "columns",
          "col_3",
          "isUnique",
        ]),
        diagnostic("index-option-dropped", 12, 3, ["indexes", "idx_7"]),
      ],
    ],
    [
      "multi-schema",
      PRISMA_FEATURES_MULTI_SCHEMA,
      [
        diagnostic("namespace-dropped", 10, 3, ["enums", "enum_1"]),
        diagnostic("namespace-dropped", 17, 3, ["tables", "tbl_2"]),
      ],
    ],
    [
      "MongoDB",
      PRISMA_FEATURES_MONGODB,
      [
        diagnostic("provider-not-supported", 2, 3, null),
        diagnostic("composite-type-not-supported", 5, 1, null),
        diagnostic("default-not-supported", 11, 24, [
          "columns",
          "col_2",
          "defaultValue",
        ]),
        diagnostic("composite-type-not-supported", 13, 3, null),
      ],
    ],
  ])(
    "imports the %s feature fixture with the expected diagnostics",
    (_, source, expected) => {
      expect(diagnosticsOf(source)).toStrictEqual(expected);
    },
  );

  it("reports provider-not-supported without a location when the datasource is missing", () => {
    expect(diagnosticsOf("model User {\n  id Int @id\n}\n")).toStrictEqual([
      { code: "provider-not-supported", location: null, path: null },
    ]);
  });

  it("reports back-relation-missing on the relation", () => {
    const source = `${DATASOURCE}model Post {\n  id       Int  @id\n  authorId Int\n  author   User @relation(fields: [authorId], references: [id])\n}\nmodel User {\n  id Int @id\n}\n`;

    expect(diagnosticsOf(source)).toStrictEqual([
      diagnostic("back-relation-missing", 7, 3, ["relations", "rel_6"]),
    ]);
  });

  it("reports reference-not-found for a relation to an unknown field", () => {
    const source = `${DATASOURCE}model Post {\n  id       Int  @id\n  authorId Int\n  author   User @relation(fields: [authorId], references: [missing])\n}\nmodel User {\n  id    Int    @id\n  posts Post[]\n}\n`;

    expect(diagnosticsOf(source)).toStrictEqual([
      diagnostic("reference-not-found", 7, 3, null),
    ]);
  });

  it.each([["__proto__"], ["constructor"]])(
    "imports a table and enum named %s",
    (name) => {
      const source = `${DATASOURCE}enum E {\n  a\n  @@map("${name}")\n}\nmodel T {\n  id E @id\n  @@map("${name}")\n}\n`;

      const { document } = unwrapOk(
        importPrisma(source, createImportTestOptions()),
      );

      expect({
        tables: Object.values(document.tables).map((table) => table.name),
        enums: Object.values(document.enums).map((element) => element.name),
      }).toStrictEqual({ tables: [name], enums: [name] });
    },
  );

  it("imports a source at exactly the length limit", () => {
    const source = DATASOURCE.padEnd(MAX_IMPORT_SOURCE_LENGTH, " ");

    expect(importPrisma(source, createImportTestOptions()).isOk).toBe(true);
  });

  it("reports source-too-large one code unit over the limit", () => {
    const source = DATASOURCE.padEnd(MAX_IMPORT_SOURCE_LENGTH + 1, " ");

    expect(
      unwrapError(importPrisma(source, createImportTestOptions())),
    ).toStrictEqual({
      diagnostics: [{ code: "source-too-large", location: null, path: null }],
    });
  });

  it("reports too-many-elements", () => {
    expect(
      unwrapError(
        importPrisma(
          `${DATASOURCE}${TOO_MANY_ELEMENTS_SOURCE}`,
          createImportTestOptions(),
        ),
      ),
    ).toStrictEqual({
      diagnostics: [{ code: "too-many-elements", location: null, path: null }],
    });
  });
});
