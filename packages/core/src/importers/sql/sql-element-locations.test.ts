import { describe, expect, it } from "vitest";

import { unwrapOk } from "../../testing/unwrap-result.js";
import { createLineStarts } from "../shared/source-location.js";
import { readSqlTableDefinition } from "./sql-column-definitions.js";
import { locateSqlElements } from "./sql-element-locations.js";
import { scanSqlStatements } from "./statement-scanner.js";

function locate(source: string): ReturnType<typeof locateSqlElements> {
  const statements = unwrapOk(scanSqlStatements(source, "sqlserver"));
  return locateSqlElements({
    statements,
    tableDefinitions: statements.flatMap(
      (statement) => readSqlTableDefinition(statement, source) ?? [],
    ),
    lineStarts: createLineStarts(source),
  });
}

const SOURCE =
  "CREATE TABLE [dbo].[t] (\n  [id] int NOT NULL,\n  [Name] nvarchar(10)\n);\nALTER TABLE [t] ADD [extra] int;\n";

describe("locateSqlElements", () => {
  it("locates a column name inside its create table statement", () => {
    expect(locate(SOURCE).column("t", "name")).toStrictEqual({
      line: 3,
      column: 3,
    });
  });

  it("falls back to the statement of an alter table column", () => {
    expect(locate(SOURCE).column("t", "extra")).toStrictEqual({
      line: 5,
      column: 1,
    });
  });

  it("falls back to the table for a column it cannot find", () => {
    expect(locate(SOURCE).column("t", "missing")).toStrictEqual({
      line: 1,
      column: 1,
    });
  });

  it("locates a table at its create table statement", () => {
    expect(locate(SOURCE).table("T")).toStrictEqual({ line: 1, column: 1 });
  });

  it("has no location for a table without a create table statement", () => {
    expect(locate(SOURCE).column("missing", "id")).toBeNull();
  });

  it("returns the scanner definition of a column", () => {
    expect(locate(SOURCE).columnDefinition("t", "Name")?.rawType).toBe(
      "nvarchar(10)",
    );
  });
});
