import type { Generate, GeneratorTarget } from "@schemaforge/core";

// One literal import() per target lets the bundler split a chunk per target.
const loaders: {
  readonly [K in GeneratorTarget]: () => Promise<Generate<K>>;
} = {
  postgresql: async () =>
    (await import("@schemaforge/core/generators/postgresql"))
      .generatePostgresql,
  mysql: async () =>
    (await import("@schemaforge/core/generators/mysql")).generateMysql,
  sqlserver: async () =>
    (await import("@schemaforge/core/generators/sqlserver")).generateSqlServer,
  prisma: async () =>
    (await import("@schemaforge/core/generators/prisma")).generatePrisma,
  drizzle: async () =>
    (await import("@schemaforge/core/generators/drizzle")).generateDrizzle,
  typescript: async () =>
    (await import("@schemaforge/core/generators/typescript"))
      .generateTypeScript,
  zod: async () =>
    (await import("@schemaforge/core/generators/zod")).generateZod,
  "mock-api": async () =>
    (await import("@schemaforge/core/generators/mock-api")).generateMockApi,
  openapi: async () =>
    (await import("@schemaforge/core/generators/openapi")).generateOpenApi,
  seed: async () =>
    (await import("@schemaforge/core/generators/seed")).generateSeed,
  dbml: async () =>
    (await import("@schemaforge/core/generators/dbml")).generateDbml,
  markdown: async () =>
    (await import("@schemaforge/core/generators/markdown")).generateMarkdown,
};

export function loadGenerator<T extends GeneratorTarget>(
  target: T,
): Promise<Generate<T>> {
  return loaders[target]();
}
