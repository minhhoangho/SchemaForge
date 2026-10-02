import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/__snapshots__/**", "src/**/*.bench.ts"],
      thresholds: { lines: 90 },
    },
  },
});
