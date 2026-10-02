// Probes the SQL Server 2022 behavior that the SQL Server generator relies on
// (spec section 7 "Probe trước khi viết generator", plan Task 8). Every case
// runs as its own batch in a fresh database per probe; each probe prints what
// the server answered so the execution log can quote it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type {
  DatabaseServer,
  DatabaseSession,
  SqlOutcome,
} from "../support/containers.js";
import { startDatabaseServer, tryExecute } from "../support/containers.js";

// The image is large and may run emulated: allow the pull and a slow start.
const SERVER_START_TIMEOUT_MS = 900_000;

const MSG_MAY_CAUSE_CYCLES = 1785;
const MSG_NO_MATCHING_KEY = 1776;
const MSG_INDEX_KEY_TOO_LONG = 1944;
const MSG_UNIQUE_KEY_VIOLATION = 2627;

type Status = "accepted" | "rejected";
type Outcomes = Readonly<Record<string, SqlOutcome>>;

let server: DatabaseServer | undefined;
let databaseCount = 0;

async function inFreshDatabase<T>(
  run: (session: DatabaseSession) => Promise<T>,
): Promise<T> {
  if (server === undefined) {
    throw new Error("The SQL Server did not start");
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
  process.stdout.write(
    `[probe] sqlserver ${name}: ${JSON.stringify(outcomes)}\n`,
  );
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

function describeTable(table: string, value: string): string {
  return [
    "EXEC sys.sp_addextendedproperty @name = N'MS_Description',",
    `@value = N'${value}', @level0type = N'SCHEMA', @level0name = N'dbo',`,
    `@level1type = N'TABLE', @level1name = N'${table}'`,
  ].join(" ");
}

beforeAll(async () => {
  server = await startDatabaseServer("sqlserver");
}, SERVER_START_TIMEOUT_MS);

afterAll(async () => {
  await server?.stop();
});

describe("SQL Server 2022 probes", () => {
  it("1. accepts DECLARE after CREATE TABLE and a variable @level0name in one batch", async () => {
    const outcomes = await probe("1", {
      batch: [
        "CREATE TABLE [t] ([id] int NOT NULL);",
        "DECLARE @schema_name sysname = SCHEMA_NAME();",
        "EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'Users',",
        "@level0type = N'SCHEMA', @level0name = @schema_name,",
        "@level1type = N'TABLE', @level1name = N't';",
      ].join("\n"),
    });

    expect(statusOf(outcomes)).toStrictEqual({ batch: "accepted" });
  });

  it("2. limits MS_Description to 3750 nvarchar characters", async () => {
    const outcomes = await probe("2", {
      tables: "CREATE TABLE t_a (id int); CREATE TABLE t_b (id int);",
      description3750: describeTable("t_a", "x".repeat(3750)),
      description3751: describeTable("t_b", "x".repeat(3751)),
    });

    expect(statusOf(outcomes)).toStrictEqual({
      tables: "accepted",
      description3750: "accepted",
      description3751: "rejected",
    });
  });

  // A default is only converted when a row uses it, so each case inserts one.
  // Eight digits are only recorded: 2022 accepts them, and the generator
  // truncates to seven anyway (orchestrator decision 2026-10-02).
  it("3. accepts seven fractional second digits in time and datetime2 defaults and records eight", async () => {
    const withDefault = (table: string, type: string, literal: string) =>
      `CREATE TABLE ${table} (id int, v ${type} DEFAULT '${literal}'); INSERT INTO ${table} (id) VALUES (1);`;
    const sevenDigits = await probe("3 (seven digits)", {
      time7: withDefault("t_a", "time", "12:34:56.1234567"),
      datetime7: withDefault("t_b", "datetime2", "2026-01-02T03:04:05.1234567"),
    });
    const eightDigits = await probe("3 (eight digits, recorded)", {
      time8: withDefault("t_c", "time", "12:34:56.12345678"),
      datetime8: withDefault(
        "t_d",
        "datetime2",
        "2026-01-02T03:04:05.12345678",
      ),
    });

    expect(statusOf(sevenDigits)).toStrictEqual({
      time7: "accepted",
      datetime7: "accepted",
    });
    expect(Object.keys(eightDigits)).toStrictEqual(["time8", "datetime8"]);
  });

  it("4. needs a plain UNIQUE constraint as a foreign key target, which allows one NULL", async () => {
    const outcomes = await probe("4", {
      filteredParent:
        "CREATE TABLE p_a (code int NULL); CREATE UNIQUE INDEX ux_p_a_code ON p_a (code) WHERE code IS NOT NULL;",
      toFilteredIndex:
        "CREATE TABLE c_a (code int NULL, CONSTRAINT fk_c_a FOREIGN KEY (code) REFERENCES p_a (code))",
      uniqueParent:
        "CREATE TABLE p_b (code int NULL, CONSTRAINT uq_p_b UNIQUE (code))",
      toUniqueConstraint:
        "CREATE TABLE c_b (code int NULL, CONSTRAINT fk_c_b FOREIGN KEY (code) REFERENCES p_b (code))",
      firstNull: "INSERT INTO p_b (code) VALUES (NULL)",
      secondNull: "INSERT INTO p_b (code) VALUES (NULL)",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      filteredParent: "accepted",
      toFilteredIndex: "rejected",
      uniqueParent: "accepted",
      toUniqueConstraint: "accepted",
      firstNull: "accepted",
      secondNull: "rejected",
    });
    expect(codesOf(outcomes, "toFilteredIndex")).toContain(MSG_NO_MATCHING_KEY);
    expect(codesOf(outcomes, "secondNull")).toContain(MSG_UNIQUE_KEY_VIOLATION);
  });

  it("5. rejects cascade cycles, multiple cascade paths and cascading self references", async () => {
    const cycle = (suffix: string, action: string) => ({
      tables: `CREATE TABLE a${suffix} (id int PRIMARY KEY, b_id int NULL); CREATE TABLE b${suffix} (id int PRIMARY KEY, a_id int NULL REFERENCES a${suffix} (id) ON DELETE ${action});`,
      closing: `ALTER TABLE a${suffix} ADD CONSTRAINT fk_a${suffix}_b FOREIGN KEY (b_id) REFERENCES b${suffix} (id) ON DELETE ${action}`,
    });
    const paths = (suffix: string, action: string) => ({
      tables: `CREATE TABLE r${suffix} (id int PRIMARY KEY); CREATE TABLE m${suffix} (id int PRIMARY KEY, r_id int NULL REFERENCES r${suffix} (id) ON DELETE ${action});`,
      second: `CREATE TABLE n${suffix} (id int PRIMARY KEY, r_id int NULL REFERENCES r${suffix} (id) ON DELETE ${action}, m_id int NULL REFERENCES m${suffix} (id) ON DELETE ${action})`,
    });
    const self = (suffix: string, action: string) =>
      `CREATE TABLE s${suffix} (id int PRIMARY KEY, parent_id int NULL REFERENCES s${suffix} (id) ON DELETE ${action})`;
    const cascadeCycle = cycle("_c", "CASCADE");
    const cascadePaths = paths("_c", "CASCADE");
    const noActionCycle = cycle("_n", "NO ACTION");
    const noActionPaths = paths("_n", "NO ACTION");
    const outcomes = await probe("5", {
      cascadeCycleTables: cascadeCycle.tables,
      cascadeCycle: cascadeCycle.closing,
      cascadePathsTables: cascadePaths.tables,
      cascadePaths: cascadePaths.second,
      cascadeSelf: self("_c", "CASCADE"),
      noActionCycleTables: noActionCycle.tables,
      noActionCycle: noActionCycle.closing,
      noActionPathsTables: noActionPaths.tables,
      noActionPaths: noActionPaths.second,
      noActionSelf: self("_n", "NO ACTION"),
    });

    expect(statusOf(outcomes)).toStrictEqual({
      cascadeCycleTables: "accepted",
      cascadeCycle: "rejected",
      cascadePathsTables: "accepted",
      cascadePaths: "rejected",
      cascadeSelf: "rejected",
      noActionCycleTables: "accepted",
      noActionCycle: "accepted",
      noActionPathsTables: "accepted",
      noActionPaths: "accepted",
      noActionSelf: "accepted",
    });
    expect([
      codesOf(outcomes, "cascadeCycle"),
      codesOf(outcomes, "cascadePaths"),
      codesOf(outcomes, "cascadeSelf"),
    ]).toStrictEqual([
      expect.arrayContaining([MSG_MAY_CAUSE_CYCLES]),
      expect.arrayContaining([MSG_MAY_CAUSE_CYCLES]),
      expect.arrayContaining([MSG_MAY_CAUSE_CYCLES]),
    ]);
  });

  it("6. rejects ON DELETE RESTRICT as a syntax error", async () => {
    const outcomes = await probe("6", {
      parent: "CREATE TABLE p (id int PRIMARY KEY)",
      restrict:
        "CREATE TABLE c (p_id int NULL REFERENCES p (id) ON DELETE RESTRICT)",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      parent: "accepted",
      restrict: "rejected",
    });
    expect(outcomes.restrict?.message).toContain("Incorrect syntax");
  });

  it("7. accepts an nvarchar(450) primary key and an index on nvarchar(1000)", async () => {
    const outcomes = await probe("7", {
      primaryKey: "CREATE TABLE t_a (id nvarchar(450) NOT NULL PRIMARY KEY)",
      index:
        "CREATE TABLE t_b (v nvarchar(1000) NULL); CREATE INDEX ix_t_b_v ON t_b (v);",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      primaryKey: "accepted",
      index: "accepted",
    });
  });

  it("8. rejects fixed-length keys over 900 and 1700 bytes but accepts nvarchar", async () => {
    const outcomes = await probe("8", {
      ncharPrimaryKey: "CREATE TABLE t_a (id nchar(451) NOT NULL PRIMARY KEY)",
      ncharUnique:
        "CREATE TABLE t_b (v nchar(851) NULL, CONSTRAINT uq_t_b UNIQUE (v))",
      nvarcharPrimaryKey:
        "CREATE TABLE t_c (id nvarchar(451) NOT NULL PRIMARY KEY)",
      nvarcharUnique:
        "CREATE TABLE t_d (v nvarchar(851) NULL, CONSTRAINT uq_t_d UNIQUE (v))",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      ncharPrimaryKey: "rejected",
      ncharUnique: "rejected",
      nvarcharPrimaryKey: "accepted",
      nvarcharUnique: "accepted",
    });
    expect([
      codesOf(outcomes, "ncharPrimaryKey"),
      codesOf(outcomes, "ncharUnique"),
    ]).toStrictEqual([
      expect.arrayContaining([MSG_INDEX_KEY_TOO_LONG]),
      expect.arrayContaining([MSG_INDEX_KEY_TOO_LONG]),
    ]);
  });

  it("9. needs the foreign key column type to match the nvarchar key it references", async () => {
    const outcomes = await probe("9", {
      parent: "CREATE TABLE p (id nvarchar(500) NOT NULL PRIMARY KEY)",
      nchar:
        "CREATE TABLE c_a (p_id nchar(500) NULL, CONSTRAINT fk_c_a FOREIGN KEY (p_id) REFERENCES p (id))",
      nvarchar:
        "CREATE TABLE c_b (p_id nvarchar(500) NULL, CONSTRAINT fk_c_b FOREIGN KEY (p_id) REFERENCES p (id))",
    });

    expect(statusOf(outcomes)).toStrictEqual({
      parent: "accepted",
      nchar: "rejected",
      nvarchar: "accepted",
    });
  });
});
