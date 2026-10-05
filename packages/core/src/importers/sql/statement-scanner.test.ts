import { describe, expect, it } from "vitest";

import { unwrapError, unwrapOk } from "../../testing/unwrap-result.js";
import {
  MAX_DELIMITER_LENGTH,
  MAX_SCANNED_TOKENS,
  maskStatements,
  scanSqlStatements,
  tokenizeSql,
  type SqlStatement,
} from "./statement-scanner.js";

function statementTexts(
  source: string,
  statements: readonly SqlStatement[],
): readonly string[] {
  return statements.map((statement) =>
    source.slice(statement.start, statement.end),
  );
}

function tokenTexts(statement: SqlStatement | undefined): readonly string[] {
  return statement === undefined
    ? []
    : statement.tokens.map((token) => token.text);
}

describe("tokenizeSql", () => {
  it("reads words, numbers and symbols with their offsets and depths", () => {
    expect(unwrapOk(tokenizeSql("f(a, 1.5e3)", "postgresql"))).toStrictEqual([
      { kind: "word", text: "f", value: "f", start: 0, depth: 0 },
      { kind: "symbol", text: "(", value: "(", start: 1, depth: 0 },
      { kind: "word", text: "a", value: "a", start: 2, depth: 1 },
      { kind: "symbol", text: ",", value: ",", start: 3, depth: 1 },
      { kind: "number", text: "1.5e3", value: "1.5e3", start: 5, depth: 1 },
      { kind: "symbol", text: ")", value: ")", start: 10, depth: 0 },
    ]);
  });

  it.each([
    ["postgresql", `'it''s'`, "it's"],
    ["postgresql", String.raw`'a\b'`, String.raw`a\b`],
    ["postgresql", String.raw`E'a\'b\n\x41\101é'`, "a'b\nAAé"],
    ["postgresql", "$$body ' text$$", "body ' text"],
    ["postgresql", "$fn$ $$ inner $fn$", " $$ inner "],
    ["mysql", String.raw`'it\'s\\ \%'`, String.raw`it's\ \%`],
    ["mysql", `"double"`, "double"],
    ["sqlserver", "N'Việt ''x'''", "Việt 'x'"],
  ] as const)("reads the %s string %s", (dialect, text, value) => {
    expect(unwrapOk(tokenizeSql(text, dialect))).toStrictEqual([
      { kind: "string", text, value, start: 0, depth: 0 },
    ]);
  });

  it.each([
    ["postgresql", `"a""b"`, `a"b`],
    ["mysql", "`a``b`", "a`b"],
    ["sqlserver", "[a]]b]", "a]b"],
    ["sqlserver", `"a b"`, "a b"],
  ] as const)("reads the %s quoted identifier %s", (dialect, text, value) => {
    expect(unwrapOk(tokenizeSql(text, dialect))).toStrictEqual([
      { kind: "quotedIdentifier", text, value, start: 0, depth: 0 },
    ]);
  });

  it("reads sql server variables and a hexadecimal number as single tokens", () => {
    const tokens = unwrapOk(tokenizeSql("@level1type = 0x1F", "sqlserver"));

    expect(tokens.map((token) => [token.kind, token.text])).toStrictEqual([
      ["word", "@level1type"],
      ["symbol", "="],
      ["number", "0x1F"],
    ]);
  });

  it("reads a postgresql cast as two colon symbols", () => {
    const tokens = unwrapOk(tokenizeSql("'a'::text", "postgresql"));

    expect(tokens.map((token) => token.text)).toStrictEqual([
      "'a'",
      ":",
      ":",
      "text",
    ]);
  });

  it("keeps the depth at zero after an unbalanced closing parenthesis", () => {
    const tokens = unwrapOk(tokenizeSql(") a", "postgresql"));

    expect(tokens.map((token) => token.depth)).toStrictEqual([0, 0]);
  });

  it("skips comments without producing tokens", () => {
    const tokens = unwrapOk(
      tokenizeSql("a -- one\n/* two */ b # three\nc", "mysql"),
    );

    expect(tokens.map((token) => token.text)).toStrictEqual(["a", "b", "c"]);
  });

  it("reads the content of a mysql executable comment as tokens", () => {
    const tokens = unwrapOk(
      tokenizeSql("/*!50003 CREATE*/ /*!50003 TRIGGER t */", "mysql"),
    );

    expect(tokens.map((token) => token.text)).toStrictEqual([
      "CREATE",
      "TRIGGER",
      "t",
    ]);
  });

  it("reads a dollar sign that opens no dollar quote as a symbol", () => {
    const tokens = unwrapOk(tokenizeSql("$1", "postgresql"));

    expect(tokens.map((token) => [token.kind, token.text])).toStrictEqual([
      ["symbol", "$"],
      ["number", "1"],
    ]);
  });

  it.each([
    ["postgresql", "a 'open", 2],
    ["postgresql", String.raw`E'ends with \'`, 0],
    ["postgresql", "a /* /* nested */", 2],
    ["postgresql", "$tag$ body $other$", 0],
    ["postgresql", `"open`, 0],
    ["mysql", "`open", 0],
    ["sqlserver", "[open", 0],
  ] as const)(
    "reports the offset of an unterminated %s construct in %s",
    (dialect, text, offset) => {
      expect(unwrapError(tokenizeSql(text, dialect))).toStrictEqual({
        offset,
      });
    },
  );
});

describe("scanSqlStatements", () => {
  it("splits statements on semicolons at depth zero", () => {
    const source = "CREATE TABLE a (x int);\nCREATE TABLE b (y int);";

    const statements = unwrapOk(scanSqlStatements(source, "postgresql"));

    expect(statementTexts(source, statements)).toStrictEqual([
      "CREATE TABLE a (x int);",
      "CREATE TABLE b (y int);",
    ]);
  });

  it("keeps a semicolon inside parentheses in the statement", () => {
    const source = "SELECT f(a; b); SELECT 1";

    const statements = unwrapOk(scanSqlStatements(source, "postgresql"));

    expect(statementTexts(source, statements)).toStrictEqual([
      "SELECT f(a; b);",
      "SELECT 1",
    ]);
  });

  it.each([
    ["postgresql", `SELECT 'a;b', "c;d" /* ; */ -- ;\n; SELECT 2`],
    ["mysql", "SELECT 'a;b', `c;d` # ;\n; SELECT 2"],
    ["sqlserver", "SELECT N'a;b', [c;d] /* ; */; SELECT 2"],
  ] as const)(
    "ignores semicolons inside strings, comments and quoted identifiers in %s",
    (dialect, source) => {
      const statements = unwrapOk(scanSqlStatements(source, dialect));

      expect(statements).toHaveLength(2);
    },
  );

  it("drops empty statements", () => {
    const source = ";;\n/* only a comment */;\nSELECT 1;";

    const statements = unwrapOk(scanSqlStatements(source, "postgresql"));

    expect(statementTexts(source, statements)).toStrictEqual(["SELECT 1;"]);
  });

  it("starts a statement at its first token and ends it at the last token without a terminator", () => {
    const source = "-- lead\n  SELECT 1  ";

    const statements = unwrapOk(scanSqlStatements(source, "postgresql"));

    expect(statements.map(({ start, end }) => [start, end])).toStrictEqual([
      [10, 18],
    ]);
  });

  it("reads nested block comments in postgresql", () => {
    const source = "/* a /* b; */ c; */ SELECT 1;";

    const statements = unwrapOk(scanSqlStatements(source, "postgresql"));

    expect(statementTexts(source, statements)).toStrictEqual(["SELECT 1;"]);
  });

  it("closes a block comment at the first end marker outside postgresql", () => {
    const source = "/* a /* b */ SELECT 1;";

    const statements = unwrapOk(scanSqlStatements(source, "mysql"));

    expect(statementTexts(source, statements)).toStrictEqual(["SELECT 1;"]);
  });

  it("reads dollar-quoted bodies", () => {
    const source =
      "CREATE FUNCTION f() RETURNS int AS $body$ SELECT 1; $body$ LANGUAGE sql;\nSELECT 2;";

    const statements = unwrapOk(scanSqlStatements(source, "postgresql"));

    expect(statements.map((statement) => statement.tokens[8])).toStrictEqual([
      {
        kind: "string",
        text: "$body$ SELECT 1; $body$",
        value: " SELECT 1; ",
        start: 35,
        depth: 0,
      },
      undefined,
    ]);
  });

  it("reads escaped quotes in mysql strings", () => {
    const source = String.raw`INSERT INTO t VALUES ('a\';b'); SELECT 2;`;

    const statements = unwrapOk(scanSqlStatements(source, "mysql"));

    expect(statements[0]?.tokens[5]?.value).toBe("a';b");
  });

  it("reads bracketed identifiers in sql server", () => {
    const source = "CREATE TABLE [dbo].[my table;] ([id] int);";

    const statements = unwrapOk(scanSqlStatements(source, "sqlserver"));

    expect(
      statements[0]?.tokens
        .filter((token) => token.kind === "quotedIdentifier")
        .map((token) => [token.value, token.depth]),
    ).toStrictEqual([
      ["dbo", 0],
      ["my table;", 0],
      ["id", 1],
    ]);
  });

  it("splits on a GO line in sql server", () => {
    const source =
      "CREATE TABLE a (x int)\n  go  \r\nCREATE TABLE b (y int)\nGO";

    const statements = unwrapOk(scanSqlStatements(source, "sqlserver"));

    expect(statementTexts(source, statements)).toStrictEqual([
      "CREATE TABLE a (x int)\n  go",
      "CREATE TABLE b (y int)\nGO",
    ]);
  });

  it("drops a GO line that follows a terminated statement", () => {
    const source = "SELECT 1;\nGO\n";

    const statements = unwrapOk(scanSqlStatements(source, "sqlserver"));

    expect(statementTexts(source, statements)).toStrictEqual(["SELECT 1;"]);
  });

  it.each([
    ["postgresql", "SELECT a\nGO\nb;"],
    ["sqlserver", "SELECT a\nGO x\nb;"],
    ["sqlserver", "SELECT a\ngoal\nb;"],
  ] as const)(
    "does not split on a line that is not a GO line in %s: %j",
    (dialect, source) => {
      const statements = unwrapOk(scanSqlStatements(source, dialect));

      expect(statements).toHaveLength(1);
    },
  );

  it("switches the terminator after a DELIMITER line in mysql", () => {
    const source = [
      "DELIMITER ;;",
      "CREATE TRIGGER t BEFORE INSERT ON x FOR EACH ROW BEGIN SET @a = 1; END ;;",
      "  delimiter ;",
      "SELECT 1;",
    ].join("\n");

    const statements = unwrapOk(scanSqlStatements(source, "mysql"));

    expect(statementTexts(source, statements)).toStrictEqual([
      "CREATE TRIGGER t BEFORE INSERT ON x FOR EACH ROW BEGIN SET @a = 1; END ;;",
      "SELECT 1;",
    ]);
  });

  it.each([
    ["postgresql", "DELIMITER //\nSELECT 1;"],
    ["mysql", "SELECT 1,\nDELIMITER //\n;"],
    ["mysql", "DELIMITER\nSELECT 1;"],
    ["mysql", `DELIMITER ${"+".repeat(MAX_DELIMITER_LENGTH + 1)}\nSELECT 1;`],
  ] as const)(
    "reads a line that is not a DELIMITER command as statement text in %s: %j",
    (dialect, source) => {
      const statements = unwrapOk(scanSqlStatements(source, dialect));

      expect(tokenTexts(statements[0])).toContain("DELIMITER");
    },
  );

  // Without the length cap, each "+" token compared the whole delimiter.
  it("reads a DELIMITER line with a 40 000-character delimiter and the symbols after it as statement text", () => {
    const source = `DELIMITER ${"+".repeat(39_999)}x\n${"+".repeat(100_000)}`;

    const statements = unwrapOk(scanSqlStatements(source, "mysql"));

    expect(statements[0]?.tokens).toHaveLength(140_001);
  });

  it("switches the terminator after a DELIMITER line with a delimiter of the maximum length", () => {
    const delimiter = "+".repeat(MAX_DELIMITER_LENGTH);
    const source = `DELIMITER ${delimiter}\nSELECT 1${delimiter}`;

    const statements = unwrapOk(scanSqlStatements(source, "mysql"));

    expect(statementTexts(source, statements)).toStrictEqual([
      `SELECT 1${delimiter}`,
    ]);
  });

  it("reads a mysqldump trigger wrapped in executable comments", () => {
    const source = [
      "DELIMITER ;;",
      "/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `t` BEFORE INSERT ON `x` FOR EACH ROW SET @a = 1 */;;",
      "DELIMITER ;",
    ].join("\n");

    const statements = unwrapOk(scanSqlStatements(source, "mysql"));

    expect(tokenTexts(statements[0]).slice(0, 7)).toStrictEqual([
      "CREATE",
      "DEFINER",
      "=",
      "`root`",
      "@",
      "`localhost`",
      "TRIGGER",
    ]);
  });

  it("reads the data lines of a postgresql COPY FROM stdin as part of that statement", () => {
    const source = [
      "COPY public.t (a, b) FROM stdin;",
      "1\tit's",
      "2\tx;y",
      "\\.",
      "SELECT 1;",
    ].join("\n");

    const statements = unwrapOk(scanSqlStatements(source, "postgresql"));

    expect(statementTexts(source, statements)).toStrictEqual([
      "COPY public.t (a, b) FROM stdin;\n1\tit's\n2\tx;y\n\\.",
      "SELECT 1;",
    ]);
  });

  it("reads the data of a postgresql COPY FROM stdin without an end marker up to the end of the source", () => {
    const source = "COPY t FROM STDIN;\n1\tit's\r\n";

    const statements = unwrapOk(scanSqlStatements(source, "postgresql"));

    expect(statements.map(({ end }) => end)).toStrictEqual([source.length]);
  });

  it("does not read data lines after a COPY from a file", () => {
    const source = "COPY t FROM '/tmp/t.csv';\nSELECT 1;";

    const statements = unwrapOk(scanSqlStatements(source, "postgresql"));

    expect(statements).toHaveLength(2);
  });

  it("reports the offset of an unterminated string", () => {
    const source = "SELECT 1;\nSELECT 'open;";

    expect(unwrapError(scanSqlStatements(source, "postgresql"))).toStrictEqual({
      code: "syntax-error",
      offset: 17,
    });
  });

  it("returns source-too-large when the source has more tokens than the scanner reads", () => {
    const source = "(".repeat(MAX_SCANNED_TOKENS + 1);

    expect(unwrapError(scanSqlStatements(source, "mysql"))).toStrictEqual({
      code: "source-too-large",
    });
  });

  it("reads a source with exactly the maximum number of tokens", () => {
    const source = "(".repeat(MAX_SCANNED_TOKENS);

    const statements = unwrapOk(scanSqlStatements(source, "mysql"));

    expect(statements[0]?.tokens).toHaveLength(MAX_SCANNED_TOKENS);
  });

  it("scans a 2 MiB source and returns every statement", () => {
    const statement =
      'CREATE TABLE "t" ("id" bigint NOT NULL, "note" text DEFAULT \'a;b\'); -- c\n';
    const count = Math.ceil((2 * 1024 * 1024) / statement.length);

    const statements = unwrapOk(
      scanSqlStatements(statement.repeat(count), "postgresql"),
    );

    expect(statements).toHaveLength(count);
  });
});

describe("maskStatements", () => {
  it("masks dropped statements without moving line or column positions", () => {
    const source =
      "CREATE VIEW v AS\r\nSELECT 'é';\nCREATE TABLE t (\n  id int\n);";
    const statements = unwrapOk(scanSqlStatements(source, "postgresql"));

    const masked = maskStatements(source, statements, (statement) =>
      tokenTexts(statement).includes("TABLE"),
    );

    expect(masked).toBe(
      "                \r\n           \nCREATE TABLE t (\n  id int\n);",
    );
  });

  it("masks text outside every statement, including DELIMITER lines and comments", () => {
    const source = "-- dump\nDELIMITER ;;\nSELECT 1 ;;\nDELIMITER ;\n";
    const statements = unwrapOk(scanSqlStatements(source, "mysql"));

    const masked = maskStatements(source, statements, () => true);

    expect(masked).toBe("       \n            \nSELECT 1 ;;\n           \n");
  });

  it("keeps the GO line of a kept sql server statement", () => {
    const source = "CREATE TABLE a (x int)\nGO\n";
    const statements = unwrapOk(scanSqlStatements(source, "sqlserver"));

    const masked = maskStatements(source, statements, () => true);

    expect(masked).toBe(source);
  });
});
