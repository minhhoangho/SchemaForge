import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Inside the package (not os.tmpdir()) so generated .ts files resolve zod,
// drizzle-orm and msw from this package's node_modules.
export const CONFORMANCE_TEMP_ROOT = fileURLToPath(
  new URL("../../.tmp/", import.meta.url),
);

export async function withTempDirectory<T>(
  run: (directory: string) => Promise<T>,
): Promise<T> {
  await mkdir(CONFORMANCE_TEMP_ROOT, { recursive: true });
  const directory = await mkdtemp(join(CONFORMANCE_TEMP_ROOT, "run-"));
  try {
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
