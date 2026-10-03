import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Generators call across many modules on purpose; the getter overhead
    // this warns about is part of every variant alike (Task 28 log).
    benchmark: { suppressExportGetterWarnings: true },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/__snapshots__/**", "src/**/*.bench.ts"],
      thresholds: { lines: 90 },
    },
  },
});
