import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { PRODUCT_NAME } from "@schemaforge/core";

import { AppModule } from "./app.module.js";
import type { Env } from "./config/env.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const port = configService.get("PORT", { infer: true });
  await app.listen(port);
  new Logger("Bootstrap").log(
    `${PRODUCT_NAME} backend listening on port ${String(port)}`,
  );
}

await bootstrap();
