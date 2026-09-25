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
        "src/**/*.strategy.ts",
        "src/**/*.mapper.ts",
        "src/**/*.policy.ts",
        "src/config/**/*.ts",
        // Pure helpers without a Nest kind suffix (nestjs.md), listed one by one.
        "src/app-setup.ts",
        "src/common/prisma-errors.ts",
        "src/common/current-user.decorator.ts",
        "src/common/normalize-email.ts",
        "src/modules/rate-limit/rate-limit.store.ts",
        "src/modules/auth/auth-cookies.ts",
        "src/modules/auth/token-generator.ts",
        "src/modules/schemas/schema-list-cursor.ts",
      ],
      exclude: ["src/generated/**"],
      thresholds: { lines: 80 },
    },
  },
});
