import { describe, expect, it } from "vitest";

import { unwrapOk } from "../../testing/unwrap-result.js";
import type { ColumnChange } from "./sql-draft-overrides.js";
import { readSqlServerAddDefault } from "./sqlserver-add-default.js";
import { scanSqlStatements } from "./statement-scanner.js";

function read(source: string): readonly (ColumnChange | null)[] {
  return unwrapOk(scanSqlStatements(source, "sqlserver")).map(
    readSqlServerAddDefault,
  );
}

function defaultChange(
  columnName: string,
  text: string,
  start = 0,
): ColumnChange {
  return {
    tableName: "t",
    columnName,
    start,
    change: { kind: "default", raw: { kind: "expression", text } },
  };
}

describe("readSqlServerAddDefault", () => {
  it("reads a named default as ssms writes it", () => {
    expect(
      read(
        "\nALTER TABLE [dbo].[t] ADD  CONSTRAINT [DF_t_a]  DEFAULT ((0)) FOR [a]",
      ),
    ).toStrictEqual([defaultChange("a", "((0))", 1)]);
  });

  it.each([
    ["ALTER TABLE t ADD DEFAULT (N'x''y') FOR c", "c", "(N'x''y')"],
    [
      "ALTER TABLE t WITH CHECK ADD DEFAULT (sysdatetime()) FOR d",
      "d",
      "(sysdatetime())",
    ],
    ["ALTER TABLE t ADD DEFAULT 1 + /* one */ 2 FOR e", "e", "1 +           2"],
  ])("reads the expression of %s", (source, columnName, text) => {
    expect(read(source)).toStrictEqual([defaultChange(columnName, text)]);
  });

  it.each([
    "ALTER TABLE t ADD DEFAULT FOR a",
    "ALTER TABLE t ADD DEFAULT 0 FOR",
    "ALTER TABLE t ADD DEFAULT 0 FOR a b",
    "ALTER TABLE t ADD DEFAULT 0",
    "ALTER TABLE t ADD CONSTRAINT DEFAULT 0 FOR a",
    "ALTER TABLE t ADD CONSTRAINT df UNIQUE (a)",
    "ALTER TABLE t DROP CONSTRAINT df",
    "ALTER TABLE ADD DEFAULT 0 FOR a",
    "CREATE TABLE t (a int DEFAULT 0)",
  ])("reads nothing from %s", (source) => {
    expect(read(source)).toStrictEqual([null]);
  });
});
