import { describe, expect, it } from "vitest";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { unwrapOk } from "../../testing/unwrap-result.js";
import {
  readSqlIndexDefinition,
  type SqlIndexDefinition,
} from "./sql-index-definitions.js";
import { scanSqlStatements } from "./statement-scanner.js";

function read(
  source: string,
  dialect: SqlDialect = "postgresql",
): readonly (SqlIndexDefinition | null)[] {
  return unwrapOk(scanSqlStatements(source, dialect)).map(
    readSqlIndexDefinition,
  );
}

function readFirst(
  source: string,
  dialect: SqlDialect = "postgresql",
): Partial<SqlIndexDefinition> | null {
  return read(source, dialect)[0] ?? null;
}

const PLAIN: Omit<SqlIndexDefinition, "indexName" | "tableName" | "start"> = {
  isUnique: false,
  columnNames: ["a"],
  hasDroppedElementOption: false,
  hasInclude: false,
  hasWhere: false,
  whereNotNullColumnNames: null,
};

describe("readSqlIndexDefinition", () => {
  it("reads the name, table, uniqueness and columns of an index", () => {
    expect(
      read(
        `\nCREATE UNIQUE INDEX "Orders_Code" ON public."Orders" (code, "Region");`,
      ),
    ).toStrictEqual([
      {
        ...PLAIN,
        indexName: "Orders_Code",
        tableName: "Orders",
        start: 1,
        isUnique: true,
        columnNames: ["code", "Region"],
      },
    ]);
  });

  it("reads an unnamed postgresql index", () => {
    expect(read("CREATE INDEX ON t (a)")).toStrictEqual([
      { ...PLAIN, indexName: null, tableName: "t", start: 0 },
    ]);
  });

  it("marks expression elements as null", () => {
    expect(
      readFirst("CREATE INDEX i ON t (lower(a), b, (c + 1), d::text, e + f)")
        ?.columnNames,
    ).toStrictEqual([null, "b", null, null, null]);
  });

  it.each<readonly [SqlDialect, string, string | null]>([
    ["postgresql", "CREATE INDEX i ON t (a DESC)", "a"],
    ["postgresql", "CREATE INDEX i ON t (a NULLS LAST)", "a"],
    ["postgresql", "CREATE INDEX i ON t (a ASC NULLS FIRST)", "a"],
    ["postgresql", "CREATE INDEX i ON t (a text_pattern_ops)", "a"],
    ["postgresql", "CREATE INDEX i ON t (a pg_catalog.text_ops DESC)", "a"],
    ["postgresql", `CREATE INDEX i ON t (a COLLATE "C")`, "a"],
    ["postgresql", `CREATE INDEX i ON t (a COLLATE pg_catalog."default")`, "a"],
    ["mysql", "CREATE INDEX i ON t (c(10))", "c"],
    ["mysql", "CREATE INDEX i ON `t` (`c`(10) DESC)", "c"],
    ["sqlserver", "CREATE INDEX [i] ON [t] ([a] DESC)", "a"],
  ])(
    "flags dropped element options in %s: %s",
    (dialect, source, columnName) => {
      expect(readFirst(source, dialect)).toMatchObject({
        columnNames: [columnName],
        hasDroppedElementOption: true,
      });
    },
  );

  it("does not flag asc", () => {
    expect(
      readFirst("CREATE INDEX [i] ON [t] ([a] ASC, [b] ASC)", "sqlserver"),
    ).toMatchObject({
      columnNames: ["a", "b"],
      hasDroppedElementOption: false,
    });
  });

  it.each([
    "CREATE INDEX i ON t (a COLLATE)",
    "CREATE INDEX i ON t (a NULLS)",
    "CREATE INDEX i ON t (a NULLS DESC)",
    "CREATE INDEX i ON t (a ops_one ops_two)",
    "CREATE INDEX i ON t (a (b))",
    "CREATE INDEX i ON t (a DESC (10))",
    'CREATE INDEX i ON t (a COLLATE "C" COLLATE "D")',
    "CREATE INDEX i ON t (CASE WHEN a THEN b END)",
  ])(
    "reads an element it does not recognize as an expression: %s",
    (source) => {
      expect(readFirst(source)?.columnNames).toStrictEqual([null]);
    },
  );

  it("detects a sql server include clause", () => {
    expect(
      readFirst(
        "CREATE NONCLUSTERED INDEX [i] ON [dbo].[t] ([a] ASC) INCLUDE ([b], [c]) WITH (PAD_INDEX = OFF) ON [PRIMARY]",
        "sqlserver",
      ),
    ).toStrictEqual({
      ...PLAIN,
      indexName: "i",
      tableName: "t",
      start: 0,
      hasInclude: true,
    });
  });

  it("ignores with options and a filegroup", () => {
    expect(
      readFirst(
        "CREATE UNIQUE NONCLUSTERED INDEX [i] ON [dbo].[t]\n(\n\t[a] ASC\n)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, ONLINE = OFF) ON [PRIMARY]",
        "sqlserver",
      ),
    ).toStrictEqual({
      ...PLAIN,
      indexName: "i",
      tableName: "t",
      start: 0,
      isUnique: true,
    });
  });

  it("detects a where clause", () => {
    expect(
      readFirst("CREATE UNIQUE INDEX i ON t (a) WHERE (deleted_at IS NULL)"),
    ).toMatchObject({ hasWhere: true, whereNotNullColumnNames: null });
  });

  it.each<readonly [string, readonly string[]]>([
    [
      "CREATE UNIQUE INDEX [t_code_key] ON [t] ([code]) WHERE [code] IS NOT NULL",
      ["code"],
    ],
    [
      "CREATE UNIQUE INDEX [t_b_a_key] ON [t] ([b], [a]) WHERE [b] IS NOT NULL AND a is not null WITH (ONLINE = OFF) ON [PRIMARY]",
      ["b", "a"],
    ],
  ])("reads the columns of a not-null filter: %s", (source, columnNames) => {
    expect(readFirst(source, "sqlserver")).toMatchObject({
      hasWhere: true,
      whereNotNullColumnNames: columnNames,
    });
  });

  it.each([
    "CREATE UNIQUE INDEX [i] ON [t] ([a]) WHERE [a] IS NULL",
    "CREATE UNIQUE INDEX [i] ON [t] ([a]) WHERE [a] IS NOT NULL OR [b] IS NOT NULL",
    "CREATE UNIQUE INDEX [i] ON [t] ([a]) WHERE ([a] IS NOT NULL)",
    "CREATE UNIQUE INDEX [i] ON [t] ([a]) WHERE [a] IS NOT NULL AND",
    "CREATE UNIQUE INDEX [i] ON [t] ([a]) WHERE [a] > 0",
    "CREATE UNIQUE INDEX [i] ON [t] ([a]) WHERE",
  ])("returns null filter columns for another where clause: %s", (source) => {
    expect(readFirst(source, "sqlserver")).toMatchObject({
      hasWhere: true,
      whereNotNullColumnNames: null,
    });
  });

  it.each<readonly [SqlDialect, string]>([
    ["sqlserver", "CREATE CLUSTERED INDEX [i] ON [t] ([a])"],
    ["postgresql", "CREATE INDEX CONCURRENTLY i ON t (a)"],
    ["postgresql", "CREATE INDEX IF NOT EXISTS i ON t (a)"],
    ["postgresql", "CREATE INDEX i ON ONLY t (a)"],
    ["postgresql", "CREATE INDEX i ON t USING btree (a)"],
    [
      "postgresql",
      "CREATE INDEX CONCURRENTLY IF NOT EXISTS i ON ONLY public.t USING btree (a)",
    ],
  ])(
    "skips clustered, concurrently, if not exists, only and using in %s: %s",
    (dialect, source) => {
      expect(readFirst(source, dialect)).toStrictEqual({
        ...PLAIN,
        indexName: "i",
        tableName: "t",
        start: 0,
      });
    },
  );

  it.each([
    "CREATE TABLE t (a int)",
    "CREATE FULLTEXT INDEX i ON t (a)",
    "CREATE INDEX i t (a)",
    "CREATE INDEX i ON t",
    "CREATE INDEX i ON (a)",
    "CREATE INDEX i ON t (a",
    "CREATE INDEX",
    "ALTER TABLE t ADD INDEX i (a)",
  ])("returns null for a statement other than create index: %s", (source) => {
    expect(read(source)).toStrictEqual([null]);
  });
});
