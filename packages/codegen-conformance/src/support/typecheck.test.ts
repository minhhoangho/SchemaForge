import { describe, expect, it } from "vitest";

import { typecheckFiles } from "./typecheck.js";

describe("typecheckFiles", () => {
  it("returns no diagnostics for a strict module that imports zod", async () => {
    const diagnostics = await typecheckFiles([
      {
        fileName: "schema.ts",
        content: [
          'import { z } from "zod";',
          "export const user = z.object({ name: z.string() });",
          "export type User = z.infer<typeof user>;",
          "",
        ].join("\n"),
      },
    ]);

    expect(diagnostics).toStrictEqual([]);
  });

  it("reports a type error", async () => {
    const diagnostics = await typecheckFiles([
      {
        fileName: "broken.ts",
        content: 'export const count: number = "one";\n',
      },
    ]);

    expect(diagnostics).toStrictEqual([expect.stringContaining("TS2322")]);
  });

  it("reports an unresolved import", async () => {
    const diagnostics = await typecheckFiles([
      {
        fileName: "missing.ts",
        content: 'export { value } from "./does-not-exist.js";\n',
      },
    ]);

    expect(diagnostics).toStrictEqual([expect.stringContaining("TS2307")]);
  });
});
