import { sortRelations, sortTables } from "@schemaforge/core";
import type {
  GeneratorDiagnostic,
  Relation,
  SchemaDocument,
} from "@schemaforge/core";
import { generateSqlServer } from "@schemaforge/core/generators/sqlserver";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { startDatabaseServer, tryExecute } from "./support/containers.js";
import type { DatabaseServer, DatabaseSession } from "./support/containers.js";
import {
  listConformanceFixtures,
  withDialectCustomTypes,
} from "./support/fixtures.js";

const DIALECT = "sqlserver";
// UTF-16 code units: MS_Description is at most 7500 bytes of nvarchar.
const DESCRIPTION_LIMIT = 3750;
const NO_ACTION = "NO_ACTION";

const COUNT_FOREIGN_KEYS_SQL = "SELECT COUNT(*) AS count FROM sys.foreign_keys";
const FOREIGN_KEY_COLUMNS_SQL =
  "SELECT fk.name AS constraint_name, OBJECT_NAME(fk.parent_object_id) AS table_name, COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name, fk.delete_referential_action_desc AS on_delete, fk.update_referential_action_desc AS on_update FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id ORDER BY fk.name, fkc.constraint_column_id";
const DESCRIPTIONS_SQL =
  "SELECT OBJECT_NAME(ep.major_id) AS table_name, COL_NAME(ep.major_id, ep.minor_id) AS column_name, CAST(ep.value AS nvarchar(max)) AS description FROM sys.extended_properties ep WHERE ep.class = 1 AND ep.name = N'MS_Description'";
// target-limit: `alt_code` has a unique index, is nullable and no foreign key
// references it, so the generator writes a filtered unique index.
const FILTERED_UNIQUE_TABLE = "nullable_unique";
const INSERT_TWO_NULLS_SQL =
  "INSERT INTO [nullable_unique] ([id], [code], [alt_code]) VALUES (1, N'a', NULL), (2, N'b', NULL)";

const countShape = z.array(z.object({ count: z.coerce.number() }));
const foreignKeyColumnShape = z.array(
  z.object({
    constraint_name: z.string(),
    table_name: z.string(),
    column_name: z.string(),
    on_delete: z.string(),
    on_update: z.string(),
  }),
);
const descriptionShape = z.array(
  z.object({
    table_name: z.string(),
    column_name: z.string().nullable(),
    description: z.string(),
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
    throw new Error("The SQL Server server did not start");
  }
  databaseCount += 1;
  const session = await server.createDatabase(`f_${String(databaseCount)}`);
  openSessions.push(session);
  const { file, diagnostics } = generateSqlServer(schema, {});
  // An empty output has no statement to send.
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

// Constraint names are the generator's own, so a foreign key is matched to its
// relation by the referencing table and columns.
function foreignKeyKey(
  tableName: string,
  columnNames: readonly string[],
): string {
  return [tableName, ...[...columnNames].sort()].join("\n");
}

function relationKey(schema: SchemaDocument, relation: Relation): string {
  return foreignKeyKey(
    schema.tables[relation.fromTableId]?.name ?? "",
    relation.columnPairs.map(
      (pair) => schema.columns[pair.fromColumnId]?.name ?? "",
    ),
  );
}

async function readForeignKeyActions(
  session: DatabaseSession,
): Promise<ReadonlyMap<string, readonly [string, string]>> {
  const rows = foreignKeyColumnShape.parse(
    await session.query(FOREIGN_KEY_COLUMNS_SQL),
  );
  const names = [...new Set(rows.map((row) => row.constraint_name))];
  return new Map(
    names.map((name) => {
      const columns = rows.filter((row) => row.constraint_name === name);
      const [first] = columns;
      return [
        foreignKeyKey(
          first?.table_name ?? "",
          columns.map((row) => row.column_name),
        ),
        [first?.on_delete ?? "", first?.on_update ?? ""],
      ];
    }),
  );
}

function listCycleRelations(
  schema: SchemaDocument,
  diagnostics: readonly GeneratorDiagnostic[],
): readonly Relation[] {
  const relationIds = new Set(
    diagnostics
      .filter((diagnostic) => diagnostic.code === "referential-action-cycle")
      .map((diagnostic) => diagnostic.path[1]),
  );
  return sortRelations(schema).filter((relation) =>
    relationIds.has(relation.id),
  );
}

// Cut at a code point boundary (spec section 4): a surrogate pair that would
// straddle the limit is dropped whole.
function truncateToCodeUnits(text: string, limit: number): string {
  const cut = text.slice(0, limit);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}

type Description = readonly [string, string | null, string];

function expectedLongDescriptions(
  schema: SchemaDocument,
): readonly Description[] {
  return sortTables(schema)
    .flatMap((table) => [
      ...(table.comment.length > DESCRIPTION_LIMIT
        ? [[table.name, null, table.comment] as const]
        : []),
      ...table.columnIds
        .flatMap((columnId) => schema.columns[columnId] ?? [])
        .filter((column) => column.comment.length > DESCRIPTION_LIMIT)
        .map((column) => [table.name, column.name, column.comment] as const),
    ])
    .map(([tableName, columnName, comment]): Description => [
      tableName,
      columnName,
      truncateToCodeUnits(comment, DESCRIPTION_LIMIT),
    ]);
}

async function readDescriptions(
  session: DatabaseSession,
  expected: readonly Description[],
): Promise<readonly Description[]> {
  const rows = descriptionShape.parse(await session.query(DESCRIPTIONS_SQL));
  return expected.map(([tableName, columnName]) => [
    tableName,
    columnName,
    rows.find(
      (row) => row.table_name === tableName && row.column_name === columnName,
    )?.description ?? "",
  ]);
}

describe.each(listConformanceFixtures())(
  "sql server ddl for $name",
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

    it("writes cascade conflicts as no action", async () => {
      const { session, diagnostics } = await runDdl(schema);
      const actions = await readForeignKeyActions(session);
      const cycleKeys = listCycleRelations(schema, diagnostics).map(
        (relation) => relationKey(schema, relation),
      );

      expect(cycleKeys.map((key) => [key, actions.get(key)])).toStrictEqual(
        cycleKeys.map((key) => [key, [NO_ACTION, NO_ACTION]]),
      );
    });
  },
);

describe.each(
  listConformanceFixtures().filter(
    (fixture) => fixture.name === "target-limit",
  ),
)("sql server limits for $name", ({ schema: fixtureSchema }) => {
  const schema = withDialectCustomTypes(fixtureSchema, DIALECT);

  it("stores truncated descriptions at 3750 characters", async () => {
    const { session } = await runDdl(schema);
    const expected = expectedLongDescriptions(schema);

    expect(expected.length).toBeGreaterThan(0);
    expect(await readDescriptions(session, expected)).toStrictEqual(expected);
  });

  it("accepts more than one null in a filtered unique index", async () => {
    const { session } = await runDdl(schema);

    expect(await tryExecute(session, INSERT_TWO_NULLS_SQL)).toStrictEqual({
      isAccepted: true,
      codes: [],
      message: "",
    });
    expect(await session.countRows(FILTERED_UNIQUE_TABLE)).toBe(2);
  });
});
