import { describe, expect, it } from "vitest";

import { runPrismaValidate } from "./prisma-cli.js";

describe("runPrismaValidate", () => {
  it("validates a minimal postgresql schema with exit code 0", async () => {
    const result = await runPrismaValidate(
      [
        "datasource db {",
        '  provider = "postgresql"',
        "}",
        "",
        "model User {",
        "  id Int @id",
        "}",
        "",
      ].join("\n"),
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("is valid");
  });

  it("returns a non-zero exit code and the error for an invalid schema", async () => {
    const result = await runPrismaValidate(
      [
        "datasource db {",
        '  provider = "postgresql"',
        "}",
        "",
        "model User {",
        "  id Unknown @id",
        "}",
        "",
      ].join("\n"),
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.output).toContain("Unknown");
  });
});
