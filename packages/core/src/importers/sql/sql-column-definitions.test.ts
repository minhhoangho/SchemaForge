import { describe, expect, it } from "vitest";

import type { SqlDialect } from "../../generators/shared/generator-types.js";
import { unwrapOk } from "../../testing/unwrap-result.js";
import {
  COLUMN_CONSTRAINT_WORDS,
  readSqlTableDefinition,
  type SqlColumnDefinition,
  type SqlTableDefinition,
} from "./sql-column-definitions.js";
import type { SqlTableKey, SqlUniqueConstraint } from "./sql-table-keys.js";
import { scanSqlStatements } from "./statement-scanner.js";

function readTables(
  source: string,
  dialect: SqlDialect = "postgresql",
): readonly (SqlTableDefinition | null)[] {
  return unwrapOk(scanSqlStatements(source, dialect)).map((statement) =>
    readSqlTableDefinition(statement, source),
  );
}

function readColumns(
  source: string,
  dialect: SqlDialect = "postgresql",
): readonly SqlColumnDefinition[] | undefined {
  return readTables(source, dialect)[0]?.columns;
}

function readColumn(
  definition: string,
  dialect: SqlDialect = "postgresql",
): SqlColumnDefinition | undefined {
  return readColumns(`CREATE TABLE t (${definition})`, dialect)?.[0];
}

function readUniques(
  source: string,
  dialect: SqlDialect,
): readonly SqlUniqueConstraint[] | undefined {
  return readTables(source, dialect)[0]?.uniqueConstraints;
}

const LINEAR_TIME_LIMIT_MS = 5000;

const PLAIN_COLUMN = {
  defaultText: null,
  hasOnUpdate: false,
  hasCollation: false,
  isComputed: false,
} as const;

describe("readSqlTableDefinition", () => {
  it("reads the table name, positions and columns", () => {
    expect(
      readTables(
        `\nCREATE TABLE "Orders" (\n  id integer NOT NULL,\n  "Total" numeric(10, 2)\n);`,
      ),
    ).toStrictEqual([
      {
        tableName: "Orders",
        isQualified: false,
        start: 1,
        columns: [
          {
            ...PLAIN_COLUMN,
            name: "id",
            start: 27,
            rawType: "integer",
            typeStart: 30,
          },
          {
            ...PLAIN_COLUMN,
            name: "Total",
            start: 50,
            rawType: "numeric(10, 2)",
            typeStart: 58,
          },
        ],
        uniqueConstraints: [],
        keys: [],
      },
    ]);
  });

  it.each([
    ["timestamp with time zone", "timestamp with time zone"],
    ["time(3) with time zone DEFAULT now()", "time(3) with time zone"],
    ["double precision NOT NULL", "double precision"],
    ["bit varying(4)", "bit varying(4)"],
    [
      'character varying(255) COLLATE pg_catalog."default"',
      "character varying(255)",
    ],
    ["interval day to second", "interval day to second"],
    ["timestamp\n    without time zone", "timestamp\n    without time zone"],
    ["integer[]", "integer[]"],
  ])(
    "reads the exact type text of multi-word postgresql types: %s",
    (definition, rawType) => {
      expect(readColumn(`c ${definition}`)?.rawType).toBe(rawType);
    },
  );

  it.each([
    ["int unsigned NOT NULL", "int unsigned"],
    ["INT(10) UNSIGNED ZEROFILL", "INT(10) UNSIGNED ZEROFILL"],
    ["enum('a','b') DEFAULT 'a'", "enum('a','b')"],
  ])(
    "keeps mysql unsigned and zerofill in the type text: %s",
    (definition, rawType) => {
      expect(readColumn(`c ${definition}`, "mysql")?.rawType).toBe(rawType);
    },
  );

  it("keeps a sql server identity clause in the type text", () => {
    expect(
      readColumn("[id] [int] IDENTITY(1,1) NOT NULL", "sqlserver")?.rawType,
    ).toBe("[int] IDENTITY(1,1)");
  });

  it.each(
    [...COLUMN_CONSTRAINT_WORDS]
      .filter((word) => word !== "CHARACTER")
      .map((word) => [word] as const),
  )("stops the type at the first column constraint word: %s", (word) => {
    expect(readColumn(`c varchar(10) ${word} x`)?.rawType).toBe("varchar(10)");
  });

  it("stops the type at character set but not at character varying", () => {
    expect(
      readColumns(
        "CREATE TABLE t (a varchar(10) CHARACTER SET utf8mb4, b character varying)",
        "mysql",
      )?.map((column) => column.rawType),
    ).toStrictEqual(["varchar(10)", "character varying"]);
  });

  it.each([
    ["postgresql", `CREATE TABLE t ("unique" int, "check" text)`],
    ["mysql", "CREATE TABLE t (`key` int, `check` text)"],
    ["sqlserver", "CREATE TABLE t ([primary] int, [unique] text)"],
  ] as const)(
    "reads a quoted column named like a keyword as a column in %s",
    (dialect, source) => {
      expect(
        readColumns(source, dialect)?.map((column) => column.rawType),
      ).toStrictEqual(["int", "text"]);
    },
  );

  it("detects on update outside a references clause", () => {
    expect(
      readColumn(
        "updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
        "mysql",
      ),
    ).toMatchObject({ rawType: "timestamp", hasOnUpdate: true });
  });

  it.each([
    "a int REFERENCES u (id) ON UPDATE CASCADE",
    "a int REFERENCES u (id) ON DELETE SET NULL ON UPDATE SET NULL",
    "a int REFERENCES u (id) ON UPDATE NO ACTION",
    "a int REFERENCES u (id) ON UPDATE RESTRICT",
  ])("ignores on update of an inline foreign key: %s", (definition) => {
    expect(readColumn(definition)?.hasOnUpdate).toBe(false);
  });

  it.each([
    ["postgresql", `c text COLLATE "C"`],
    ["mysql", "c varchar(10) CHARACTER SET utf8mb4"],
    ["mysql", "c varchar(10) CHARSET utf8mb4"],
    ["sqlserver", "[c] nvarchar(10) COLLATE Latin1_General_CI_AS NULL"],
  ] as const)(
    "detects collate and character set in %s: %s",
    (dialect, definition) => {
      expect(readColumn(definition, dialect)?.hasCollation).toBe(true);
    },
  );

  it.each([
    ["postgresql", "c int GENERATED ALWAYS AS (a + b) STORED", "int"],
    ["mysql", "c int GENERATED ALWAYS AS (a + b) VIRTUAL", "int"],
    ["mysql", "c int AS (a + b) STORED", "int"],
    ["sqlserver", "[c] AS ([a] + [b]) PERSISTED", ""],
    ["sqlserver", "[c] AS [a] * 2", ""],
  ] as const)(
    "detects computed columns in the three dialects: %s %s",
    (dialect, definition, rawType) => {
      expect(readColumn(definition, dialect)).toMatchObject({
        rawType,
        isComputed: true,
      });
    },
  );

  it.each([
    "id int GENERATED ALWAYS AS IDENTITY",
    "id bigint GENERATED BY DEFAULT AS IDENTITY (START WITH 10)",
  ])("does not treat an identity as a computed column: %s", (definition) => {
    expect(readColumn(definition)?.isComputed).toBe(false);
  });

  it.each([
    ["n numeric DEFAULT 12345678901234567890.123", "12345678901234567890.123"],
    ["b bigint NOT NULL DEFAULT 9223372036854775807", "9223372036854775807"],
    ["s text DEFAULT 'a' NOT NULL", "'a'"],
    ["z text DEFAULT NULL", "NULL"],
    ["i int DEFAULT ((0)) NOT NULL", "((0))"],
    ["u timestamp DEFAULT now() ON UPDATE now()", "now()"],
    ["c int NOT NULL", null],
    ["id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL", null],
  ])("reads the default text of %s", (definition, defaultText) => {
    expect(readColumn(definition)?.defaultText).toBe(defaultText);
  });

  it("gives an empty type for a sql server computed column", () => {
    expect(
      readColumn("[total] AS ([price] * [quantity])", "sqlserver")?.rawType,
    ).toBe("");
  });

  it.each<readonly [SqlDialect, string, SqlUniqueConstraint]>([
    [
      "postgresql",
      "UNIQUE (a)",
      {
        name: null,
        columnNames: ["a"],
        isMysqlKey: false,
        hasDroppedElementOption: false,
      },
    ],
    [
      "postgresql",
      `CONSTRAINT "u" UNIQUE (a, b)`,
      {
        name: "u",
        columnNames: ["a", "b"],
        isMysqlKey: false,
        hasDroppedElementOption: false,
      },
    ],
    [
      "mysql",
      "UNIQUE KEY `u` (`a`)",
      {
        name: "u",
        columnNames: ["a"],
        isMysqlKey: true,
        hasDroppedElementOption: false,
      },
    ],
    [
      "mysql",
      "UNIQUE INDEX (a(10))",
      {
        name: null,
        columnNames: ["a"],
        isMysqlKey: true,
        hasDroppedElementOption: true,
      },
    ],
    [
      "sqlserver",
      "CONSTRAINT [u] UNIQUE NONCLUSTERED ([a] ASC) WITH (PAD_INDEX = OFF) ON [PRIMARY]",
      {
        name: "u",
        columnNames: ["a"],
        isMysqlKey: false,
        hasDroppedElementOption: false,
      },
    ],
    [
      "postgresql",
      "UNIQUE (a DESC)",
      {
        name: null,
        columnNames: ["a"],
        isMysqlKey: false,
        hasDroppedElementOption: true,
      },
    ],
  ])(
    "reads table-level unique constraints with their names and columns in %s: %s",
    (dialect, definition, constraint) => {
      expect(
        readUniques(`CREATE TABLE t (a int, b int, ${definition})`, dialect),
      ).toStrictEqual([constraint]);
    },
  );

  it.each<readonly [string, SqlTableKey]>([
    [
      "KEY `k` (`a`)",
      {
        name: "k",
        columnNames: ["a"],
        kind: "plain",
        hasDroppedElementOption: false,
      },
    ],
    [
      "INDEX (a(10), b DESC) USING BTREE",
      {
        name: null,
        columnNames: ["a", "b"],
        kind: "plain",
        hasDroppedElementOption: true,
      },
    ],
    [
      "FULLTEXT KEY `f` (`a`)",
      {
        name: "f",
        columnNames: ["a"],
        kind: "fulltext",
        hasDroppedElementOption: false,
      },
    ],
    [
      "FULLTEXT (a)",
      {
        name: null,
        columnNames: ["a"],
        kind: "fulltext",
        hasDroppedElementOption: false,
      },
    ],
    [
      "SPATIAL INDEX s (a)",
      {
        name: "s",
        columnNames: ["a"],
        kind: "spatial",
        hasDroppedElementOption: false,
      },
    ],
  ])("reads the mysql key %s", (definition, key) => {
    expect(
      readTables(`CREATE TABLE t (a int, b int, ${definition})`, "mysql")[0]
        ?.keys,
    ).toStrictEqual([key]);
  });

  it.each([
    "KEY k ((lower(a)))",
    "KEY k a",
    "KEY",
    "UNIQUE KEY k (a)",
    "PRIMARY KEY (a)",
    "FOREIGN KEY (a) REFERENCES u (id)",
  ])("reads no mysql key from %s", (definition) => {
    expect(
      readTables(`CREATE TABLE t (a int, ${definition})`, "mysql")[0]?.keys,
    ).toStrictEqual([]);
  });

  it.each([
    "PRIMARY KEY (a)",
    "CONSTRAINT pk PRIMARY KEY (a)",
    "FOREIGN KEY (a) REFERENCES u (id)",
    "CHECK (a > 0)",
    "KEY k (a)",
    "INDEX i (a)",
    "FULLTEXT KEY f (a)",
    "SPATIAL KEY s (a)",
    "EXCLUDE USING gist (a WITH &&)",
    "LIKE other",
    "UNIQUE (lower(a))",
    "UNIQUE a",
    "CONSTRAINT u",
  ])("reads neither a column nor a unique constraint from %s", (definition) => {
    expect(
      readTables(`CREATE TABLE t (a int, ${definition})`, "mysql"),
    ).toMatchObject([{ columns: [{ name: "a" }], uniqueConstraints: [] }]);
  });

  it("skips empty elements", () => {
    expect(
      readColumns("CREATE TABLE t (a int,, b int,)")?.map(
        (column) => column.name,
      ),
    ).toStrictEqual(["a", "b"]);
  });

  it("reads a column without a type", () => {
    expect(readColumn("c NOT NULL")?.rawType).toBe("");
  });

  it.each([
    ["postgresql", "CREATE TABLE IF NOT EXISTS public.orders (id int)"],
    ["sqlserver", "CREATE TABLE [dbo].[orders]([id] int)"],
    ["mysql", "CREATE TABLE `shop`.`orders` (`id` int)"],
  ] as const)(
    "strips the schema of the table name in %s",
    (dialect, source) => {
      expect(readTables(source, dialect)[0]?.tableName).toBe("orders");
    },
  );

  it.each([
    ["CREATE TABLE IF NOT EXISTS public.orders (id int)", true],
    ["CREATE TABLE IF NOT EXISTS orders (id int)", false],
    ['CREATE TABLE "s"."orders" (id int)', true],
    ["CREATE TABLE orders (id int)", false],
  ] as const)("tells whether %s names a schema", (source, isQualified) => {
    expect(readTables(source)[0]?.isQualified).toBe(isQualified);
  });

  it.each([
    "CREATE INDEX i ON t (a)",
    "CREATE TEMPORARY TABLE t (a int)",
    "CREATE TABLE t AS SELECT 1",
    "CREATE TABLE t",
    "CREATE TABLE (a int)",
    "CREATE TABLE t (a int",
    "ALTER TABLE t ADD COLUMN a int",
  ])("returns null for a statement other than create table: %s", (source) => {
    expect(readTables(source)).toStrictEqual([null]);
  });

  it(
    "reads a 2 MiB create table with 20 000 columns in linear time",
    // A quadratic walk over the columns or tokens takes far longer than this.
    { timeout: LINEAR_TIME_LIMIT_MS },
    () => {
      const columnCount = 20_000;
      const definitions = Array.from(
        { length: columnCount },
        (_, index) =>
          `  "column_${String(index).padStart(5, "0")}_${"x".repeat(50)}" character varying(255) NOT NULL DEFAULT 'value'`,
      );
      const source = `CREATE TABLE t (\n${definitions.join(",\n")}\n);`;
      expect(source.length).toBeGreaterThan(2 * 1024 * 1024);
      expect(
        readTables(source).map((table) => table?.columns.length),
      ).toStrictEqual([columnCount]);
    },
  );
});
