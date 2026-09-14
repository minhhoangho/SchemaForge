import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/**/*.service.ts",
        "src/**/*.guard.ts",
        "src/**/*.interceptor.ts",
        "src/**/*.pipe.ts",
        "src/**/*.filter.ts",
        "src/**/*.repository.ts",
        "src/config/**/*.ts",
      ],
      thresholds: { lines: 80 },
    },
  },
});
