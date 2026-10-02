import { generateTypeScript } from "@schemaforge/core/generators/typescript";
import { describe, expect, it } from "vitest";

import { listConformanceFixtures } from "./support/fixtures.js";
import { typecheckFiles } from "./support/typecheck.js";

describe.each(listConformanceFixtures())(
  "typescript for $name",
  ({ schema }) => {
    it("typechecks the generated types", async () => {
      const { file } = generateTypeScript(schema, {});

      expect(
        await typecheckFiles([{ fileName: "types.ts", content: file.content }]),
      ).toStrictEqual([]);
    });
  },
);
