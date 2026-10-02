import type { SqlDialect } from "@schemaforge/core";
import { generatePrisma } from "@schemaforge/core/generators/prisma";
import { describe, expect, it } from "vitest";

import { listConformanceFixtures } from "./support/fixtures.js";
import { runPrismaValidate } from "./support/prisma-cli.js";

const PROVIDERS: readonly SqlDialect[] = ["postgresql", "mysql", "sqlserver"];

describe.each(listConformanceFixtures())("prisma for $name", ({ schema }) => {
  it.each(PROVIDERS)(
    "passes prisma validate without warnings for %s",
    async (provider) => {
      const { file } = generatePrisma(schema, { provider });
      const result = await runPrismaValidate(file.content);

      // On failure the diff shows the CLI output.
      expect({
        exitCode: result.exitCode,
        hasWarning: /warn/i.test(result.output),
        output: result.output,
      }).toStrictEqual({
        exitCode: 0,
        hasWarning: false,
        output: result.output,
      });
    },
  );
});
