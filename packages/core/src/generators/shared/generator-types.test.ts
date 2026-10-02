import { describe, expect, expectTypeOf, it } from "vitest";

import type { GeneratorOptions, SqlDialect } from "./generator-types.js";
import { GENERATOR_TARGETS, SQL_DIALECTS } from "./generator-types.js";

describe("generator types", () => {
  it("lists the twelve generator targets in spec order", () => {
    expect(GENERATOR_TARGETS).toStrictEqual([
      "postgresql",
      "mysql",
      "sqlserver",
      "prisma",
      "drizzle",
      "typescript",
      "zod",
      "mock-api",
      "openapi",
      "seed",
      "dbml",
      "markdown",
    ]);
  });

  it("lists the three sql dialects", () => {
    expect(SQL_DIALECTS).toStrictEqual(["postgresql", "mysql", "sqlserver"]);
  });

  it("requires a provider option for prisma", () => {
    expectTypeOf<GeneratorOptions["prisma"]>().toEqualTypeOf<{
      readonly provider: SqlDialect;
    }>();
  });
});
