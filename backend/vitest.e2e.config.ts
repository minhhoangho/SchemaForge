import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// A real PostgreSQL round trip plus argon2 hashing is far slower than a unit test.
const E2E_TIMEOUT_MS = 30_000;

// Developer machines keep the test database URL in backend/.env.test (gitignored).
// CI has no such file and sets the variables in the job instead; `loadEnvFile`
// leaves variables already present in the environment untouched, so both work.
const envFilePath = fileURLToPath(new URL(".env.test", import.meta.url));
if (existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.e2e-spec.ts"],
    globalSetup: ["test/global-setup.ts"],
    // The tests share one database and the rate limiter counts per process.
    fileParallelism: false,
    testTimeout: E2E_TIMEOUT_MS,
    hookTimeout: E2E_TIMEOUT_MS,
  },
});
