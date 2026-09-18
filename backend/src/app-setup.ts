import type { NestExpressApplication } from "@nestjs/platform-express";
import { MAX_REQUEST_BODY_BYTES } from "@schemaforge/api-contract";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import type { Env } from "./config/env.js";

export type AppSetupConfig = Pick<Env, "CORS_ORIGINS" | "TRUST_PROXY_HOPS">;

const CORS_MAX_AGE_SECONDS = 600;

// The API only returns JSON, so the CSP blocks everything (spec section 8).
const HELMET_OPTIONS = {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-site" },
} as const satisfies Parameters<typeof helmet>[0];

/**
 * Shared by `main.ts` and the e2e tests, in the order of spec section 8. The
 * app must be created with `bodyParser: false` so JSON is the only parser.
 */
export function configureApp(
  app: NestExpressApplication,
  config: AppSetupConfig,
): void {
  app.set("trust proxy", config.TRUST_PROXY_HOPS);
  app.use(helmet(HELMET_OPTIONS));
  app.enableCors({
    origin: [...config.CORS_ORIGINS],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type"],
    exposedHeaders: ["Retry-After"],
    maxAge: CORS_MAX_AGE_SECONDS,
  });
  app.use(cookieParser());
  app.useBodyParser("json", { limit: MAX_REQUEST_BODY_BYTES });
  app.enableShutdownHooks();
}
