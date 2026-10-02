import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pulling images and starting SQL Server is slow.
    testTimeout: 120_000,
    hookTimeout: 300_000,
    // Each file starts its own containers; run them one at a time.
    fileParallelism: false,
  },
});
