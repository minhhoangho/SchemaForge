import { describe, expect, it } from "vitest";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { unwrapOk } from "../../testing/unwrap-result.js";
import { readSqlTableDefinition } from "./sql-column-definitions.js";
import { hideCustomTypes, hideWithCheckClauses } from "./sql-parser-source.js";
import { scanSqlStatements } from "./statement-scanner.js";

function hide(source: string, dialect: SqlDialect): string {
  return hideCustomTypes({
    source,
    dialect,
    definitions: unwrapOk(scanSqlStatements(source, dialect)).flatMap(
      (statement) => readSqlTableDefinition(statement, source) ?? [],
    ),
  });
}

describe("hideCustomTypes", () => {
  it.each<[SqlDialect, string, string]>([
    [
      "mysql",
      "CREATE TABLE t (a tsvector NOT NULL, b INT);",
      "CREATE TABLE t (a INT      NOT NULL, b INT);",
    ],
    [
      "mysql",
      "CREATE TABLE t (`g` geometry(Point, 4326));",
      "CREATE TABLE t (`g` INT                  );",
    ],
    [
      "sqlserver",
      "CREATE TABLE t ([g] geometry(Point,\n  4326) NULL);",
      "CREATE TABLE t ([g] INT            \n        NULL);",
    ],
  ])(
    "replaces a custom type with a same-length type the %s parser reads",
    (dialect, source, expected) => {
      expect(hide(source, dialect)).toStrictEqual(expected);
    },
  );

  it.each<[SqlDialect, string]>([
    ["postgresql", "CREATE TABLE t (a tsvector NOT NULL);"],
    ["mysql", "CREATE TABLE t (a VARCHAR(10), b ENUM('x', 'y'), c ab);"],
    ["sqlserver", "CREATE TABLE t (a int IDENTITY(1,1), b AS (a + 1));"],
  ])("leaves the %s source unchanged", (dialect, source) => {
    expect(hide(source, dialect)).toStrictEqual(source);
  });
});

function hideChecks(source: string, dialect: SqlDialect): string {
  return hideWithCheckClauses({
    source,
    dialect,
    statements: unwrapOk(scanSqlStatements(source, dialect)),
  });
}

describe("hideWithCheckClauses", () => {
  it.each([
    [
      "ALTER TABLE [dbo].[t]  WITH CHECK ADD  CONSTRAINT [c] CHECK  (([a]>=(0)))",
      "ALTER TABLE [dbo].[t]             ADD  CONSTRAINT [c] CHECK  (([a]>=(0)))",
    ],
    [
      "CREATE TABLE t (a int)\nGO\nALTER TABLE t WITH NOCHECK ADD CHECK (a > 0)\n",
      "CREATE TABLE t (a int)\nGO\nALTER TABLE t              ADD CHECK (a > 0)\n",
    ],
  ])(
    "replaces the with check clause of a sql server alter table with spaces",
    (source, expected) => {
      expect(hideChecks(source, "sqlserver")).toStrictEqual(expected);
    },
  );

  it.each<[SqlDialect, string]>([
    ["sqlserver", "ALTER TABLE [t] ADD CONSTRAINT [c] CHECK ([a] > 0)"],
    ["sqlserver", "ALTER TABLE [t] WITH CHECK CHECK CONSTRAINT [c]"],
    ["sqlserver", "CREATE TABLE [with] ([check] int)"],
    ["postgresql", "ALTER TABLE t WITH CHECK ADD CHECK (a > 0)"],
  ])("leaves the %s source unchanged: %s", (dialect, source) => {
    expect(hideChecks(source, dialect)).toStrictEqual(source);
  });
});
