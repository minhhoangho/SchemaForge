import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    // Editor journeys render the full workspace (React Flow, axe) and take
    // several seconds when the machine is loaded; 5 s flaked in full runs.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/testing/setup-tests.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**/*.ts",
        "src/**/use-*.ts",
        "src/features/**/state/**/*.ts",
        "src/features/**/lib/**/*.ts",
        "src/features/**/hooks/**/*.ts",
        "src/proxy.ts",
      ],
      exclude: [
        "src/lib/i18n/locales/**",
        "src/testing/**",
        "src/components/ui/**",
        "scripts/**",
        "**/*.d.ts",
        "**/*.test.{ts,tsx}",
      ],
      thresholds: { lines: 80 },
    },
  },
});
