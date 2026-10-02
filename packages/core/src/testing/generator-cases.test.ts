import { describe, expect, it } from "vitest";

import { listGeneratorCases } from "./generator-cases.js";
import { createSampleSchema } from "./sample-schema.js";

const EXPECTED_FILE_NAMES = [
  ["postgresql", "schema.sql"],
  ["mysql", "schema.sql"],
  ["sqlserver", "schema.sql"],
  ["prisma postgresql", "schema.prisma"],
  ["prisma mysql", "schema.prisma"],
  ["prisma sqlserver", "schema.prisma"],
  ["drizzle postgresql", "schema.ts"],
  ["drizzle mysql", "schema.ts"],
  ["typescript", "types.ts"],
  ["zod", "schemas.ts"],
  ["mock-api", "handlers.ts"],
  ["openapi", "openapi.json"],
  ["seed postgresql", "seed.sql"],
  ["seed mysql", "seed.sql"],
  ["seed sqlserver", "seed.sql"],
  ["seed json", "seed.json"],
  ["dbml", "schema.dbml"],
  ["markdown", "schema.md"],
] as const;

describe("listGeneratorCases", () => {
  it("lists one case per generator variant", () => {
    expect(listGeneratorCases().map(({ name }) => name)).toStrictEqual(
      EXPECTED_FILE_NAMES.map(([name]) => name),
    );
  });

  it.each(EXPECTED_FILE_NAMES)(
    "runs the %s case through the generator that writes %s",
    (name, fileName) => {
      const generatorCase = listGeneratorCases().find(
        (candidate) => candidate.name === name,
      );

      expect(generatorCase?.run(createSampleSchema()).file.fileName).toBe(
        fileName,
      );
    },
  );
});
