import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { CURRENT_SCHEMA_VERSION } from "@schemaforge/core";

import { configureApp } from "./app-setup.js";
import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.js";

const APP_NAME = "SchemaForge";

async function bootstrap(): Promise<void> {
  // configureApp registers the JSON parser as the only body parser.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  configureApp(app, {
    CORS_ORIGINS: configService.get("CORS_ORIGINS", { infer: true }),
    TRUST_PROXY_HOPS: configService.get("TRUST_PROXY_HOPS", { infer: true }),
  });
  const port = configService.get("PORT", { infer: true });
  await app.listen(port);
  new Logger("Bootstrap").log(
    `${APP_NAME} backend listening on port ${String(port)} (schema version ${String(CURRENT_SCHEMA_VERSION)})`,
  );
}

await bootstrap();
