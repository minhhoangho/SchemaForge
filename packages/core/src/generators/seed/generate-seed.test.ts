import { describe, expect, it } from "vitest";

import { createEmptySchema } from "../../model/create-empty-schema.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { formatDiagnosticsSnapshot } from "../../testing/generator-snapshot.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { buildSeedDataset } from "./build-seed-dataset.js";
import { generateSeed } from "./generate-seed.js";
import type { SeedOptions } from "./generate-seed.js";

const SNAPSHOT_OPTIONS = { rowsPerTable: 3, seed: 1 };

type Fixture = readonly [string, () => SchemaDocument];

const FIXTURES: readonly Fixture[] = [
  ["sample", createSampleSchema],
  ["naming-edge", createNamingEdgeSchema],
  ["target-limit", createTargetLimitSchema],
  ["empty", () => createEmptySchema("Empty")],
];

// Each format with the extension of its snapshot file.
const FORMATS: readonly (readonly [SeedOptions["format"], string])[] = [
  ["postgresql", "sql"],
  ["mysql", "sql"],
  ["sqlserver", "sql"],
  ["json", "json"],
];

const SNAPSHOT_CASES = FIXTURES.flatMap(([fixture, createSchema]) =>
  FORMATS.map(
    ([format, extension]) =>
      [fixture, format, extension, createSchema] as const,
  ),
);

describe("generateSeed", () => {
  it.each([
    ["postgresql", "seed.sql", "sql"],
    ["json", "seed.json", "json"],
  ] as const)("names the file by format (%s)", (format, fileName, language) => {
    const { file } = generateSeed(createSampleSchema(), {
      ...SNAPSHOT_OPTIONS,
      format,
    });

    expect([file.fileName, file.language]).toStrictEqual([fileName, language]);
  });

  it("returns the diagnostics of buildSeedDataset", () => {
    const schema = createTargetLimitSchema();

    expect(
      generateSeed(schema, { ...SNAPSHOT_OPTIONS, format: "mysql" })
        .diagnostics,
    ).toStrictEqual(buildSeedDataset(schema, SNAPSHOT_OPTIONS).diagnostics);
  });

  it("returns the same content for the same seed", () => {
    const options: SeedOptions = {
      format: "postgresql",
      rowsPerTable: 5,
      seed: 7,
    };

    expect(generateSeed(createSampleSchema(), options).file.content).toBe(
      generateSeed(createSampleSchema(), options).file.content,
    );
  });

  // MySQL 8.4 rejects a timestamp literal ending in "Z" (Task 8 probe).
  it("writes MySQL timestamptz values with +00:00 instead of a trailing Z", () => {
    const { content } = generateSeed(createSampleSchema(), {
      ...SNAPSHOT_OPTIONS,
      format: "mysql",
    }).file;

    expect([content.includes("Z'"), content.includes("+00:00'")]).toStrictEqual(
      [false, true],
    );
  });

  it("throws RangeError for an unknown format", () => {
    expect(() =>
      generateSeed(createSampleSchema(), {
        ...SNAPSHOT_OPTIONS,
        // @ts-expect-error -- an untyped caller can still pass an unknown format.
        format: "oracle",
      }),
    ).toThrow(RangeError);
  });

  it.each([0, 1001])(
    "throws RangeError for rows per table outside 1 to 1000 (%s)",
    (rowsPerTable) => {
      expect(() =>
        generateSeed(createSampleSchema(), {
          format: "json",
          rowsPerTable,
          seed: 1,
        }),
      ).toThrow(RangeError);
    },
  );

  it.each(SNAPSHOT_CASES)(
    "matches the snapshot for %s as %s",
    async (fixture, format, extension, createSchema) => {
      const result = generateSeed(createSchema(), {
        ...SNAPSHOT_OPTIONS,
        format,
      });

      await expect(result.file.content).toMatchFileSnapshot(
        `../__snapshots__/seed/${fixture}.${format}.${extension}`,
      );
      await expect(
        formatDiagnosticsSnapshot(result.diagnostics),
      ).toMatchFileSnapshot(
        `../__snapshots__/seed/${fixture}.${format}.diagnostics.txt`,
      );
    },
  );
});
