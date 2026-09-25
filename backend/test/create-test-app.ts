import type { ModuleMetadata } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";

import { configureApp } from "../src/app-setup.js";
import { AppModule } from "../src/app.module.js";
import type { Env } from "../src/config/env.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { resetDatabase } from "./reset-database.js";

export type TestApp = {
  readonly app: NestExpressApplication;
  readonly prisma: PrismaService;
  readonly close: () => Promise<void>;
};

export type CreateTestAppOptions = {
  readonly imports?: NonNullable<ModuleMetadata["imports"]>;
};

/**
 * Builds the real application: the same modules, guards, pipes and filter as
 * production, plus `configureApp`, and the real `PasswordHasher`. Nothing is
 * replaced by a double. Each test builds its own app, so the in-memory rate
 * limit counters never leak between tests.
 */
export async function createTestApp(
  options?: CreateTestAppOptions,
): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...(options?.imports ?? [])],
  }).compile();
  // configureApp registers the JSON parser as the only body parser, like main.ts.
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  configureApp(app, {
    CORS_ORIGINS: configService.get("CORS_ORIGINS", { infer: true }),
    TRUST_PROXY_HOPS: configService.get("TRUST_PROXY_HOPS", { infer: true }),
  });
  await app.init();
  const prisma = app.get(PrismaService);
  await resetDatabase(prisma);
  return {
    app,
    prisma,
    close: async (): Promise<void> => {
      await app.close();
    },
  };
}
