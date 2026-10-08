import { describe, expect, it, vi } from "vitest";

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

const CONSTRAINT_SOURCE = [
  "CREATE TABLE t (id int, a int, b int);",
  "ALTER TABLE t ADD FOREIGN KEY (a, b) REFERENCES u (x, y);",
  "ALTER TABLE T ADD CONSTRAINT Fk_A FOREIGN KEY (A, B) REFERENCES u (x, y);",
  "ALTER TABLE t ADD CONSTRAINT Ck_Pos CHECK (a > 0);",
  "ALTER TABLE t ADD CONSTRAINT ck_pos CHECK (b > 0);",
  "ALTER TABLE t ADD CHECK (b > 1);",
  "CREATE TABLE u (x int, y int);",
  "ALTER TABLE u ADD FOREIGN KEY (b) REFERENCES t (id);",
  "",
].join("\n");

describe("locateSqlElements foreign keys and checks", () => {
  it.each([
    ["the first alter table that adds the columns", "t", ["A", "b"], 2],
    ["the table when the columns are in another order", "t", ["b", "a"], 1],
    ["the table when only some columns match", "t", ["a"], 1],
    ["the alter table of the referencing table", "u", ["b"], 8],
    ["the table when another table adds the foreign key", "t", ["b"], 1],
  ])("locates a foreign key at %s", (_, tableName, columnNames, line) => {
    expect(
      locate(CONSTRAINT_SOURCE).foreignKey(tableName, columnNames),
    ).toStrictEqual({ line, column: 1 });
  });

  it("has no foreign key location for a table without a create table statement", () => {
    expect(locate(CONSTRAINT_SOURCE).foreignKey("missing", ["a"])).toBeNull();
  });

  it.each([
    ["the first alter table that adds the named check", "t", "CK_POS", 4],
    ["the table for an unnamed check", "t", null, 1],
    ["the table for a name that belongs to a foreign key", "t", "fk_a", 1],
    ["the table when another table adds the check", "u", "ck_pos", 7],
  ])("locates a check at %s", (_, tableName, checkName, line) => {
    expect(locate(CONSTRAINT_SOURCE).check(tableName, checkName)).toStrictEqual(
      { line, column: 1 },
    );
  });
});

describe("locateSqlElements on many alter table constraints", () => {
  const COUNT = 1000;
  const NUMBERS = Array.from({ length: COUNT }, (_, number) => number);

  function locateMany(
    alter: (number: number) => string,
  ): ReturnType<typeof locateSqlElements> {
    return locate(
      `CREATE TABLE t (id int);\n${NUMBERS.map(alter).join("\n")}\n`,
    );
  }

  it("reads the foreign key columns a bounded number of times per lookup", () => {
    const locations = locateMany(
      (number) =>
        `ALTER TABLE t ADD FOREIGN KEY (c${String(number)}) REFERENCES u (id);`,
    );
    let reads = 0;
    const lines = NUMBERS.map(
      (number) =>
        locations.foreignKey(
          "t",
          new Proxy([`c${String(number)}`], {
            get: (target, property, receiver): unknown => {
              reads += 1;
              return Reflect.get(target, property, receiver);
            },
          }),
        )?.line,
    );
    expect(lines).toStrictEqual(NUMBERS.map((number) => number + 2));
    expect(reads).toBeLessThan(COUNT * 10);
  });

  it("folds the check names a bounded number of times per lookup", () => {
    const locations = locateMany(
      (number) =>
        `ALTER TABLE t ADD CONSTRAINT ck${String(number)} CHECK (id > 0);`,
    );
    const toLowerCase = vi.spyOn(String.prototype, "toLowerCase");
    const lines = NUMBERS.map(
      (number) => locations.check("t", `ck${String(number)}`)?.line,
    );
    const calls = toLowerCase.mock.calls.length;
    toLowerCase.mockRestore();
    expect(lines).toStrictEqual(NUMBERS.map((number) => number + 2));
    expect(calls).toBeLessThan(COUNT * 10);
  });
});
