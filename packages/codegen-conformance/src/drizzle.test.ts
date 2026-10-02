import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { sortRelations, sortTables } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import { generateDrizzle } from "@schemaforge/core/generators/drizzle";
import { is } from "drizzle-orm";
import {
  MySqlTable,
  getTableConfig as getMySqlTableConfig,
} from "drizzle-orm/mysql-core";
import {
  PgTable,
  getTableConfig as getPgTableConfig,
} from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { listConformanceFixtures } from "./support/fixtures.js";
import { withTempDirectory } from "./support/temp-directory.js";
import { typecheckFiles } from "./support/typecheck.js";

type DrizzleDialect = "postgresql" | "mysql";

type TableSummary = {
  readonly tableCount: number;
  readonly foreignKeyCount: number;
};

// Foreign key counts of the exported tables; any other export gives none.
const FOREIGN_KEY_COUNTERS: Readonly<
  Record<DrizzleDialect, (value: unknown) => readonly number[]>
> = {
  postgresql: (value) =>
    is(value, PgTable) ? [getPgTableConfig(value).foreignKeys.length] : [],
  mysql: (value) =>
    is(value, MySqlTable)
      ? [getMySqlTableConfig(value).foreignKeys.length]
      : [],
};

const DIALECTS: readonly DrizzleDialect[] = ["postgresql", "mysql"];

// Vitest transforms the TypeScript on import; `getTableConfig` runs the
// config callbacks, including those that reference a table declared later.
function summarizeTables(
  content: string,
  dialect: DrizzleDialect,
): Promise<TableSummary> {
  return withTempDirectory(async (directory) => {
    const path = join(directory, "schema.ts");
    await writeFile(path, content);
    const loaded: unknown = await import(pathToFileURL(path).href);
    const counts = (
      typeof loaded === "object" && loaded !== null ? Object.values(loaded) : []
    ).flatMap(FOREIGN_KEY_COUNTERS[dialect]);
    return {
      tableCount: counts.length,
      foreignKeyCount: counts.reduce((total, count) => total + count, 0),
    };
  });
}

// A relation whose key columns cannot be indexed has no foreign key.
function expectedSummary(
  schema: SchemaDocument,
  dialect: DrizzleDialect,
): TableSummary {
  const droppedRelationCount = generateDrizzle(schema, {
    dialect,
  }).diagnostics.filter(
    (diagnostic) =>
      diagnostic.code === "key-column-type-not-indexable" &&
      diagnostic.path[0] === "relations",
  ).length;
  return {
    tableCount: sortTables(schema).length,
    foreignKeyCount: sortRelations(schema).length - droppedRelationCount,
  };
}

describe.each(listConformanceFixtures())("drizzle for $name", ({ schema }) => {
  it.each(DIALECTS)("typechecks with drizzle-orm for %s", async (dialect) => {
    const { file } = generateDrizzle(schema, { dialect });

    expect(
      await typecheckFiles([{ fileName: "schema.ts", content: file.content }]),
    ).toStrictEqual([]);
  });

  it.each(DIALECTS)(
    "builds table configs for every table for %s",
    async (dialect) => {
      const { file } = generateDrizzle(schema, { dialect });

      expect(await summarizeTables(file.content, dialect)).toStrictEqual(
        expectedSummary(schema, dialect),
      );
    },
  );
});
