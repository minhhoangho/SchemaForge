// Probes the MySQL 8.4 behavior that the MySQL generator relies on (spec
// section 7 "Probe trước khi viết generator", plan Task 8). Every case runs as
// its own round trip in a fresh database per probe; each probe prints what the
// server answered so the execution log can quote it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type {
  DatabaseServer,
  DatabaseSession,
  SqlOutcome,
} from "../support/containers.js";
import { startDatabaseServer, tryExecute } from "../support/containers.js";

// Allows a first-time image pull on a slow connection.
const SERVER_START_TIMEOUT_MS = 600_000;

const ER_TOO_LONG_KEY = 1071;
const ER_WRONG_AUTO_KEY = 1075;
const ER_TOO_BIG_ROWSIZE = 1118;
const ER_DUP_FIELDNAME = 1060;
const ER_INVALID_DEFAULT = 1067;
const ER_BLOB_CANT_HAVE_DEFAULT = 1101;
const ER_TOO_LONG_TABLE_COMMENT = 1628;
const ER_TOO_LONG_FIELD_COMMENT = 1629;

type Status = "accepted" | "rejected";
type Outcomes = Readonly<Record<string, SqlOutcome>>;

let server: DatabaseServer | undefined;
let databaseCount = 0;

async function inFreshDatabase<T>(
  run: (session: DatabaseSession) => Promise<T>,
): Promise<T> {
  if (server === undefined) {
    throw new Error("The MySQL server did not start");
  }
  databaseCount += 1;
  const session = await server.createDatabase(`probe_${String(databaseCount)}`);
  try {
    return await run(session);
  } finally {
    await session.close();
  }
}

// Runs the cases in order, so a later case may use a table an earlier one created.
async function probe(
  name: string,
  cases: Readonly<Record<string, string>>,
): Promise<Outcomes> {
  const outcomes = await inFreshDatabase(async (session) => {
    const entries: [string, SqlOutcome][] = [];
    for (const [caseName, sql] of Object.entries(cases)) {
      entries.push([caseName, await tryExecute(session, sql)]);
    }
    return Object.fromEntries(entries);
  });
  process.stdout.write(`[probe] mysql ${name}: ${JSON.stringify(outcomes)}\n`);
  return outcomes;
}

function statusOf(outcomes: Outcomes): Readonly<Record<string, Status>> {
  return Object.fromEntries(
    Object.entries(outcomes).map(([caseName, outcome]) => [
      caseName,
      outcome.isAccepted ? "accepted" : "rejected",
    ]),
  );
}

function codesOf(
  outcomes: Outcomes,
  caseName: string,
): readonly (number | string)[] {
  return outcomes[caseName]?.codes ?? [];
}

const varchars = (length: number, count: number) =>
  Array.from(
    { length: count },
    (_, index) => `c${String(index)} VARCHAR(${String(length)})`,
  );

function uniqueTable(name: string, columns: readonly string[]): string {
  const names = columns.map((column) => column.split(" ")[0] ?? "");
  return `CREATE TABLE ${name} (${columns.join(", ")}, UNIQUE (${names.join(", ")}))`;
}

beforeAll(async () => {
  server = await startDatabaseServer("mysql");
}, SERVER_START_TIMEOUT_MS);

afterAll(async () => {
  await server?.stop();
});

describe("MySQL 8.4 probes", () => {
  // Identifiers compare case-insensitively but accent-sensitively (orchestrator
  // decision 2026-10-02, replacing the accent-insensitive premise of R12).
  it("1. accepts two columns whose names differ only by an accent, not by case", async () => {
    const outcomes = await probe("1", {
      accent: "CREATE TABLE t_a (ma INT, `má` INT)",
      caseOnly: "CREATE TABLE t_c (ma INT, MA INT)",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      accent: "accepted",
      caseOnly: "rejected",
    });
    expect(codesOf(outcomes, "caseOnly")).toContain(ER_DUP_FIELDNAME);
  });

  it("2. accepts two indexes whose names differ only by an accent", async () => {
    const outcomes = await probe("2", {
      indexes:
        "CREATE TABLE t (a INT, b INT, INDEX ix_ma (a), INDEX `ix_má` (b))",
    });

    expect(statusOf(outcomes)).toStrictEqual({ indexes: "accepted" });
  });

  it("3. accepts two unique constraints whose names differ only by an accent", async () => {
    const outcomes = await probe("3", {
      constraints:
        "CREATE TABLE t (a INT, b INT, CONSTRAINT t_ma_key UNIQUE (a), CONSTRAINT `t_má_key` UNIQUE (b))",
    });

    expect(statusOf(outcomes)).toStrictEqual({ constraints: "accepted" });
  });

  it("4. does not fold đ, ø, ł or ħ in column names or enum values", async () => {
    const outcomes = await probe("4", {
      dStroke: "CREATE TABLE t_d (`đa` INT, da INT)",
      oSlash: "CREATE TABLE t_o (`øl` INT, ol INT)",
      lStroke: "CREATE TABLE t_l (`łza` INT, lza INT)",
      hStroke: "CREATE TABLE t_h (`ħal` INT, hal INT)",
      enumValues: "CREATE TABLE t_e (v ENUM('đa', 'da'))",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      dStroke: "accepted",
      oSlash: "accepted",
      lStroke: "accepted",
      hStroke: "accepted",
      enumValues: "accepted",
    });
  });

  it("5. accepts enum values that differ only by an accent under utf8mb4_0900_as_ci", async () => {
    const outcomes = await probe("5", {
      enumValues:
        "CREATE TABLE t (v ENUM('ma', 'má')) COLLATE=utf8mb4_0900_as_ci",
    });

    expect(statusOf(outcomes)).toStrictEqual({ enumValues: "accepted" });
  });

  // Recording probe: 8.4.11 accepts SET DEFAULT, but the MySQL manual says
  // InnoDB does not support it, so the generator keeps downgrading it
  // (orchestrator decision 2026-10-02).
  it("6. records ON DELETE SET DEFAULT", async () => {
    const outcomes = await probe("6 (recorded)", {
      parent: "CREATE TABLE parent (id INT PRIMARY KEY)",
      setDefault:
        "CREATE TABLE child (parent_id INT, FOREIGN KEY (parent_id) REFERENCES parent (id) ON DELETE SET DEFAULT)",
    });

    expect(Object.keys(outcomes)).toStrictEqual(["parent", "setDefault"]);
  });

  it("7. accepts DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)", async () => {
    const outcomes = await probe("7", {
      datetime:
        "CREATE TABLE t (created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6))",
    });

    expect(statusOf(outcomes)).toStrictEqual({ datetime: "accepted" });
  });

  it("8. accepts parenthesized LONGTEXT and JSON defaults but not a bare LONGTEXT default", async () => {
    const outcomes = await probe("8", {
      longtextExpression: "CREATE TABLE t_text (v LONGTEXT DEFAULT ('a''b'))",
      jsonExpression: `CREATE TABLE t_json (v JSON DEFAULT ('{"a":1}'))`,
      longtextLiteral: "CREATE TABLE t_bare (v LONGTEXT DEFAULT 'x')",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      longtextExpression: "accepted",
      jsonExpression: "accepted",
      longtextLiteral: "rejected",
    });
    expect(codesOf(outcomes, "longtextLiteral")).toContain(
      ER_BLOB_CANT_HAVE_DEFAULT,
    );
  });

  it("9. accepts CHAR(36) DEFAULT (UUID())", async () => {
    const outcomes = await probe("9", {
      uuid: "CREATE TABLE t (id CHAR(36) DEFAULT (UUID()))",
    });

    expect(statusOf(outcomes)).toStrictEqual({ uuid: "accepted" });
  });

  // Z is rejected, so the MySQL timestamptz literal writes +00:00 instead.
  it("10. accepts TIMESTAMP(6) defaults with a +hh:mm offset but not with Z", async () => {
    const outcomes = await probe("10", {
      offset:
        "CREATE TABLE t_offset (v TIMESTAMP(6) DEFAULT '2026-01-02 03:04:05.123456+07:00')",
      zulu: "CREATE TABLE t_zulu (v TIMESTAMP(6) DEFAULT '2026-01-02T03:04:05.123456Z')",
      utcWithT:
        "CREATE TABLE t_utc_t (v TIMESTAMP(6) DEFAULT '2026-01-02T03:04:05.123456+00:00')",
      utcWithSpace:
        "CREATE TABLE t_utc_s (v TIMESTAMP(6) DEFAULT '2026-01-02 03:04:05.123456+00:00')",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      offset: "accepted",
      zulu: "rejected",
      utcWithT: "accepted",
      utcWithSpace: "accepted",
    });
    expect(codesOf(outcomes, "zulu")).toContain(ER_INVALID_DEFAULT);
  });

  it("11. limits unique keys to 3072 bytes with 4 bytes per character", async () => {
    const outcomes = await probe("11", {
      fourVarchar192: uniqueTable("t_a", varchars(192, 4)),
      fiveVarchar700: uniqueTable("t_b", varchars(700, 5)),
      oneVarchar768: uniqueTable("t_c", varchars(768, 1)),
      oneVarchar769: uniqueTable("t_d", varchars(769, 1)),
      fourVarchar192AndInteger: uniqueTable("t_e", [
        ...varchars(192, 4),
        "n INT",
      ]),
      threeVarchar255: uniqueTable("t_f", varchars(255, 3)),
      fourVarchar255: uniqueTable("t_g", varchars(255, 4)),
    });

    expect(statusOf(outcomes)).toStrictEqual({
      fourVarchar192: "accepted",
      fiveVarchar700: "rejected",
      oneVarchar768: "accepted",
      oneVarchar769: "rejected",
      fourVarchar192AndInteger: "rejected",
      threeVarchar255: "accepted",
      fourVarchar255: "rejected",
    });
    expect(codesOf(outcomes, "fiveVarchar700")).toContain(ER_TOO_LONG_KEY);
  });

  it("12. limits column comments to 1024 and table comments to 2048 characters", async () => {
    // A two-byte character shows that the limits count characters, not bytes.
    const comment = (length: number) => "é".repeat(length);
    const outcomes = await probe("12", {
      column1024: `CREATE TABLE t_a (v INT COMMENT '${comment(1024)}')`,
      column1025: `CREATE TABLE t_b (v INT COMMENT '${comment(1025)}')`,
      table2048: `CREATE TABLE t_c (v INT) COMMENT '${comment(2048)}'`,
      table2049: `CREATE TABLE t_d (v INT) COMMENT '${comment(2049)}'`,
    });

    expect(statusOf(outcomes)).toStrictEqual({
      column1024: "accepted",
      column1025: "rejected",
      table2048: "accepted",
      table2049: "rejected",
    });
    expect(codesOf(outcomes, "column1025")).toContain(
      ER_TOO_LONG_FIELD_COMMENT,
    );
    expect(codesOf(outcomes, "table2049")).toContain(ER_TOO_LONG_TABLE_COMMENT);
  });

  it("13. stores the literal 'a\\\\b' as a\\b", async () => {
    const rows = await inFreshDatabase(async (session) => {
      await session.execute(
        "CREATE TABLE t (v VARCHAR(10)); INSERT INTO t (v) VALUES ('a\\\\b')",
      );
      return session.query("SELECT v FROM t");
    });

    expect(rows).toStrictEqual([{ v: "a\\b" }]);
  });

  it("14. accepts six fractional second digits and records nine", async () => {
    const nineDigits = await probe("14 (nine digits, recorded)", {
      datetime:
        "CREATE TABLE t_a (v DATETIME(6) DEFAULT '2026-01-02 03:04:05.123456789')",
      time: "CREATE TABLE t_b (v TIME(6) DEFAULT '12:34:56.123456789')",
      timestamp:
        "CREATE TABLE t_c (v TIMESTAMP(6) DEFAULT '2026-01-02 03:04:05.123456789')",
    });
    const sixDigits = await probe("14 (six digits)", {
      datetime:
        "CREATE TABLE t_d (v DATETIME(6) DEFAULT '2026-01-02 03:04:05.123456')",
      time: "CREATE TABLE t_e (v TIME(6) DEFAULT '12:34:56.123456')",
      timestamp:
        "CREATE TABLE t_f (v TIMESTAMP(6) DEFAULT '2026-01-02 03:04:05.123456')",
    });

    expect(Object.keys(nineDigits)).toStrictEqual([
      "datetime",
      "time",
      "timestamp",
    ]);
    expect(statusOf(sixDigits)).toStrictEqual({
      datetime: "accepted",
      time: "accepted",
      timestamp: "accepted",
    });
  });

  it("15. requires an AUTO_INCREMENT column to lead some index", async () => {
    const outcomes = await probe("15", {
      secondInPrimaryKey:
        "CREATE TABLE t_a (a INT, id INT AUTO_INCREMENT, PRIMARY KEY (a, id))",
      withOwnIndex:
        "CREATE TABLE t_b (a INT, id INT AUTO_INCREMENT, PRIMARY KEY (a, id), INDEX t_b_id_idx (id))",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      secondInPrimaryKey: "rejected",
      withOwnIndex: "accepted",
    });
    expect(codesOf(outcomes, "secondInPrimaryKey")).toContain(
      ER_WRONG_AUTO_KEY,
    );
  });

  it("16. rejects a row over 65 535 bytes and accepts the same column as LONGTEXT", async () => {
    const outcomes = await probe("16", {
      varchar: "CREATE TABLE t_a (id INT, v VARCHAR(16383))",
      longtext: "CREATE TABLE t_b (id INT, v LONGTEXT)",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      varchar: "rejected",
      longtext: "accepted",
    });
    expect(codesOf(outcomes, "varchar")).toContain(ER_TOO_BIG_ROWSIZE);
  });

  // Rejected like Z, so the MySQL timestamptz literal writes +00:00 instead.
  it("17. rejects a TIMESTAMP(6) default with the offset -00:00", async () => {
    const outcomes = await probe("17", {
      negativeZeroOffset:
        "CREATE TABLE t (v TIMESTAMP(6) DEFAULT '2026-01-02 03:04:05.123456-00:00')",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      negativeZeroOffset: "rejected",
    });
    expect(codesOf(outcomes, "negativeZeroOffset")).toContain(
      ER_INVALID_DEFAULT,
    );
  });

  // Recording probe: the follow-up task depends on the result, not the test.
  it("18. records whether ß and ð fold in column names", async () => {
    const outcomes = await probe("18 (recorded)", {
      sharpS: "CREATE TABLE t_s (`ßa` INT, sa INT)",
      eth: "CREATE TABLE t_d (`ða` INT, da INT)",
    });

    expect(Object.keys(outcomes)).toStrictEqual(["sharpS", "eth"]);
  });
});
