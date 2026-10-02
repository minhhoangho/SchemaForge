import { sortRelations, sortTables } from "@schemaforge/core";
import type {
  ColumnId,
  GeneratorDiagnostic,
  SchemaDocument,
} from "@schemaforge/core";
import { generateMysql } from "@schemaforge/core/generators/mysql";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { startDatabaseServer } from "./support/containers.js";
import type { DatabaseServer, DatabaseSession } from "./support/containers.js";
import {
  listConformanceFixtures,
  withDialectCustomTypes,
} from "./support/fixtures.js";

const DIALECT = "mysql";
const COLLATION = "utf8mb4_0900_as_ci";
// Characters (code points), the limits of MySQL strict mode.
const COLUMN_COMMENT_LIMIT = 1024;
const TABLE_COMMENT_LIMIT = 2048;
const ACCENT_TABLE_NAME = "người dùng";

const COUNT_FOREIGN_KEYS_SQL =
  "SELECT COUNT(*) AS count FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_TYPE = 'FOREIGN KEY' AND TABLE_SCHEMA = DATABASE()";
const TABLES_SQL =
  "SELECT TABLE_NAME AS table_name, TABLE_COLLATION AS collation_name, TABLE_COMMENT AS comment FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME";
const COLUMNS_SQL =
  "SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, COLUMN_COMMENT AS comment FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME, ORDINAL_POSITION";

const countShape = z.array(z.object({ count: z.coerce.number() }));
const tableShape = z.array(
  z.object({
    table_name: z.string(),
    collation_name: z.string(),
    comment: z.string(),
  }),
);
const columnShape = z.array(
  z.object({
    table_name: z.string(),
    column_name: z.string(),
    comment: z.string(),
  }),
);

let server: DatabaseServer | undefined;
let databaseCount = 0;
const openSessions: DatabaseSession[] = [];

beforeAll(async () => {
  server = await startDatabaseServer(DIALECT);
});

afterEach(async () => {
  await Promise.all(openSessions.splice(0).map((session) => session.close()));
});

afterAll(async () => {
  await server?.stop();
});

type DdlRun = {
  readonly session: DatabaseSession;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

async function runDdl(schema: SchemaDocument): Promise<DdlRun> {
  if (server === undefined) {
    throw new Error("The MySQL server did not start");
  }
  databaseCount += 1;
  const session = await server.createDatabase(`f_${String(databaseCount)}`);
  openSessions.push(session);
  const { file, diagnostics } = generateMysql(schema, {});
  // The MySQL driver rejects an empty query.
  if (file.content.trim() !== "") {
    await session.execute(file.content);
  }
  return { session, diagnostics };
}

function countKeptRelations(
  schema: SchemaDocument,
  diagnostics: readonly GeneratorDiagnostic[],
): number {
  const droppedCount = diagnostics.filter(
    (diagnostic) =>
      diagnostic.code === "key-column-type-not-indexable" &&
      diagnostic.path[0] === "relations",
  ).length;
  return sortRelations(schema).length - droppedCount;
}

async function readCount(
  session: DatabaseSession,
  sql: string,
): Promise<number> {
  const [row] = countShape.parse(await session.query(sql));
  return row?.count ?? Number.NaN;
}

// The generator cuts at a code point boundary (spec section 4).
function truncateToCodePoints(text: string, limit: number): string {
  return Array.from(text).slice(0, limit).join("");
}

function isOverLimit(text: string, limit: number): boolean {
  return Array.from(text).length > limit;
}

function columnNamesOf(
  schema: SchemaDocument,
  columnIds: readonly ColumnId[],
): readonly string[] {
  return columnIds.flatMap((columnId) => schema.columns[columnId]?.name ?? []);
}

type LongComments = {
  readonly tables: readonly (readonly [string, string])[];
  readonly columns: readonly (readonly [string, string, string])[];
};

function expectedLongComments(schema: SchemaDocument): LongComments {
  const tables = sortTables(schema);
  return {
    tables: tables
      .filter((table) => isOverLimit(table.comment, TABLE_COMMENT_LIMIT))
      .map((table) => [
        table.name,
        truncateToCodePoints(table.comment, TABLE_COMMENT_LIMIT),
      ]),
    columns: tables.flatMap((table) =>
      table.columnIds
        .flatMap((columnId) => schema.columns[columnId] ?? [])
        .filter((column) => isOverLimit(column.comment, COLUMN_COMMENT_LIMIT))
        .map((column) => [
          table.name,
          column.name,
          truncateToCodePoints(column.comment, COLUMN_COMMENT_LIMIT),
        ]),
    ),
  };
}

async function readLongComments(
  session: DatabaseSession,
  expected: LongComments,
): Promise<LongComments> {
  const tables = tableShape.parse(await session.query(TABLES_SQL));
  const columns = columnShape.parse(await session.query(COLUMNS_SQL));
  return {
    tables: expected.tables.map(([tableName]) => [
      tableName,
      tables.find((row) => row.table_name === tableName)?.comment ?? "",
    ]),
    columns: expected.columns.map(([tableName, columnName]) => [
      tableName,
      columnName,
      columns.find(
        (row) => row.table_name === tableName && row.column_name === columnName,
      )?.comment ?? "",
    ]),
  };
}

describe.each(listConformanceFixtures())(
  "mysql ddl for $name",
  ({ schema: fixtureSchema }) => {
    const schema = withDialectCustomTypes(fixtureSchema, DIALECT);

    it("runs the ddl without errors and creates every table", async () => {
      const { session } = await runDdl(schema);

      expect(await session.countTables()).toBe(sortTables(schema).length);
    });

    it("creates one foreign key per relation that the generator kept", async () => {
      const { session, diagnostics } = await runDdl(schema);

      expect(await readCount(session, COUNT_FOREIGN_KEYS_SQL)).toBe(
        countKeptRelations(schema, diagnostics),
      );
    });

    it("uses the accent-sensitive collation", async () => {
      const { session } = await runDdl(schema);
      const tables = tableShape.parse(await session.query(TABLES_SQL));

      expect(tables.map((row) => row.collation_name)).toStrictEqual(
        sortTables(schema).map(() => COLLATION),
      );
    });
  },
);

describe.each(
  listConformanceFixtures().filter(
    (fixture) => fixture.name === "target-limit",
  ),
)("mysql comment limits for $name", ({ schema: fixtureSchema }) => {
  const schema = withDialectCustomTypes(fixtureSchema, DIALECT);

  it("stores truncated comments at the MySQL limits", async () => {
    const { session } = await runDdl(schema);
    const expected = expectedLongComments(schema);

    expect(expected.tables.length + expected.columns.length).toBeGreaterThan(0);
    expect(await readLongComments(session, expected)).toStrictEqual(expected);
  });
});

describe.each(
  listConformanceFixtures().filter((fixture) => fixture.name === "naming-edge"),
)("mysql accent names for $name", ({ schema: fixtureSchema }) => {
  const schema = withDialectCustomTypes(fixtureSchema, DIALECT);

  it("keeps columns that differ only by an accent", async () => {
    const { session } = await runDdl(schema);
    const columns = columnShape.parse(await session.query(COLUMNS_SQL));
    const table = sortTables(schema).find(
      (candidate) => candidate.name === ACCENT_TABLE_NAME,
    );

    expect(
      columns
        .filter((row) => row.table_name === ACCENT_TABLE_NAME)
        .map((row) => row.column_name),
    ).toStrictEqual(columnNamesOf(schema, table?.columnIds ?? []));
  });
});
