import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { sortTables } from "@schemaforge/core";
import type { SchemaDocument, Table } from "@schemaforge/core";
import { generateSeed } from "@schemaforge/core/generators/seed";
import { generateZod } from "@schemaforge/core/generators/zod";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { listConformanceFixtures } from "./support/fixtures.js";
import { withTempDirectory } from "./support/temp-directory.js";
import { typecheckFiles } from "./support/typecheck.js";

// Rows stay `unknown`: rebuilding them as records would turn a `__proto__`
// column into a prototype.
const seedJsonShape = z.array(
  z.object({ table: z.string(), rows: z.array(z.unknown()) }),
);

type InvalidRow = {
  readonly table: string;
  readonly rowIndex: number;
  readonly issues: readonly z.core.$ZodIssue[];
};

function toNameKey(names: readonly string[]): string {
  return JSON.stringify([...names].sort());
}

async function loadObjectSchemas(
  fileName: string,
  content: string,
): Promise<readonly z.ZodObject[]> {
  return withTempDirectory(async (directory) => {
    const path = join(directory, fileName);
    await writeFile(path, content);
    const loaded: unknown = await import(pathToFileURL(path).href);
    return (
      typeof loaded === "object" && loaded !== null ? Object.values(loaded) : []
    ).filter((value) => value instanceof z.ZodObject);
  });
}

// CG-08 leaves a NOT NULL custom-type column with a default out of seed rows
// (the database fills it), while the Zod schema describes a full stored row
// (spec decision R27, CG-05 and §7). Only those keys become optional.
function findSeedOmittedColumnNames(
  schema: SchemaDocument,
  table: Table,
): readonly string[] {
  return table.columnIds.flatMap((id) => {
    const column = schema.columns[id];
    return column?.type.kind === "custom" &&
      !column.isNullable &&
      column.defaultValue !== null
      ? [column.name]
      : [];
  });
}

// Schema variable names are internal to core, so a table's candidates are the
// object schemas whose keys are its column names.
function findCandidates(
  schema: SchemaDocument,
  objectSchemas: readonly z.ZodObject[],
  tableName: string,
): readonly z.ZodObject[] {
  return sortTables(schema)
    .filter((table) => table.name === tableName)
    .flatMap((table) => {
      const columnKey = toNameKey(
        table.columnIds.map((id) => schema.columns[id]?.name ?? ""),
      );
      // Object.fromEntries keeps a `__proto__` column a real key.
      // `Record` keeps the mask keys `string` (an index signature adds
      // `number`), as `partial` on a loose shape requires.
      const omittedMask: Record<string, true> = Object.fromEntries(
        findSeedOmittedColumnNames(schema, table).map((name) => [name, true]),
      );
      return objectSchemas
        .filter(
          (objectSchema) =>
            toNameKey(Object.keys(objectSchema.shape)) === columnKey,
        )
        .map((objectSchema) => objectSchema.partial(omittedMask));
    });
}

function hasColumns(schema: SchemaDocument, tableName: string): boolean {
  return sortTables(schema).some(
    (table) => table.name === tableName && table.columnIds.length > 0,
  );
}

async function findInvalidRows(
  schema: SchemaDocument,
): Promise<readonly InvalidRow[]> {
  const { file } = generateZod(schema, {});
  const objectSchemas = await loadObjectSchemas(file.fileName, file.content);
  const seed = seedJsonShape.parse(
    JSON.parse(
      generateSeed(schema, { format: "json", rowsPerTable: 5, seed: 1 }).file
        .content,
    ),
  );
  return seed
    .filter((entry) => hasColumns(schema, entry.table))
    .flatMap((entry) => {
      const candidates = findCandidates(schema, objectSchemas, entry.table);
      return entry.rows.flatMap((row, rowIndex) => {
        const results = candidates.map((candidate) => candidate.safeParse(row));
        return results.some((result) => result.success)
          ? []
          : [
              {
                table: entry.table,
                rowIndex,
                issues: results.flatMap((result) => result.error?.issues ?? []),
              },
            ];
      });
    });
}

describe.each(listConformanceFixtures())("zod for $name", ({ schema }) => {
  it("typechecks the generated schemas", async () => {
    const { file } = generateZod(schema, {});

    expect(
      await typecheckFiles([
        { fileName: file.fileName, content: file.content },
      ]),
    ).toStrictEqual([]);
  });

  it("parses every seed json row with the schema of its table", async () => {
    expect(await findInvalidRows(schema)).toStrictEqual([]);
  });
});
