import { existsSync } from "node:fs";

import { defineConfig } from "prisma/config";

const envFilePath = new URL(".env", import.meta.url);
// No backend/.env file (for example CI running `prisma generate` without a
// database) is expected: values below fall back to undefined and Prisma
// still generates. Any other failure to load the file should surface.
if (existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
