import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { CURRENT_SCHEMA_VERSION } from "@schemaforge/core";

import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.js";

const APP_NAME = "SchemaForge";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const port = configService.get("PORT", { infer: true });
  await app.listen(port);
  new Logger("Bootstrap").log(
    `${APP_NAME} backend listening on port ${String(port)} (schema version ${String(CURRENT_SCHEMA_VERSION)})`,
  );
}

await bootstrap();
