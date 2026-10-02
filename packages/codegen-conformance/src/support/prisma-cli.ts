import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import { withTempDirectory } from "./temp-directory.js";

export type PrismaValidateResult = {
  readonly exitCode: number;
  readonly output: string;
};

async function resolvePrismaCli(): Promise<string> {
  const manifestPath = createRequire(import.meta.url).resolve(
    "prisma/package.json",
  );
  const manifest: unknown = JSON.parse(await readFile(manifestPath, "utf8"));
  const bin: unknown =
    typeof manifest === "object" && manifest !== null && "bin" in manifest
      ? manifest.bin
      : undefined;
  const cli: unknown =
    typeof bin === "object" && bin !== null && "prisma" in bin
      ? bin.prisma
      : undefined;
  if (typeof cli !== "string") {
    throw new Error(`No prisma bin entry in ${manifestPath}`);
  }
  return join(dirname(manifestPath), cli);
}

function runNode(
  args: readonly string[],
  cwd: string,
): Promise<PrismaValidateResult> {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, args, { cwd }, (error, stdout, stderr) => {
      const output = stdout + stderr;
      if (error === null) {
        resolve({ exitCode: 0, output });
      } else if (typeof error.code === "number") {
        resolve({ exitCode: error.code, output });
      } else {
        // The process did not run at all (for example ENOENT): not a validation result.
        reject(new Error("Cannot run the prisma CLI", { cause: error }));
      }
    });
  });
}

/** Runs `prisma validate` on the schema; a failed validation resolves, never throws. */
export async function runPrismaValidate(
  schemaContent: string,
): Promise<PrismaValidateResult> {
  const cli = await resolvePrismaCli();
  return withTempDirectory(async (directory) => {
    const schemaPath = join(directory, "schema.prisma");
    await writeFile(schemaPath, schemaContent);
    return runNode([cli, "validate", "--schema", schemaPath], directory);
  });
}
