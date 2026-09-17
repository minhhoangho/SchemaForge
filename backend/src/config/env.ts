import { z } from "zod";

const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;
const DEFAULT_PORT = 3001;
const DEFAULT_TRUST_PROXY_HOPS = 0;
const JWT_ACCESS_SECRET_MIN_LENGTH = 32;
const AUTH_COOKIE_SECURE_VALUES = ["true", "false"] as const;
const DATABASE_URL_PROTOCOLS = new Set(["postgres:", "postgresql:"]);
const ORIGIN_PROTOCOLS = new Set(["http:", "https:"]);

// Shared with backend/.env.example, so a production deploy that forgot to
// replace the placeholder secret is caught instead of silently accepted.
export const JWT_ACCESS_SECRET_EXAMPLE =
  "replace-with-output-of-openssl-rand-base64-48";

function hasValidDatabaseProtocol(value: string): boolean {
  try {
    return DATABASE_URL_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** Returns the normalized origin, or null when the value is not a bare origin. */
function parseOrigin(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (!ORIGIN_PROTOCOLS.has(url.protocol)) {
    return null;
  }
  return url.origin === trimmed ? url.origin : null;
}

const corsOriginsSchema = z
  .string()
  .transform((value) => value.split(","))
  .transform((rawValues, ctx): readonly string[] => {
    const origins: string[] = [];
    for (const rawValue of rawValues) {
      const origin = parseOrigin(rawValue);
      if (origin === null) {
        ctx.addIssue({
          code: "custom",
          message: `CORS_ORIGINS contains an invalid origin: "${rawValue.trim()}"`,
        });
        return z.NEVER;
      }
      origins.push(origin);
    }
    return origins;
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(NODE_ENVIRONMENTS).default("development"),
    PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
    DATABASE_URL: z.string().refine(hasValidDatabaseProtocol, {
      message:
        "DATABASE_URL must be a URL with the postgres or postgresql protocol",
    }),
    JWT_ACCESS_SECRET: z
      .string()
      .min(
        JWT_ACCESS_SECRET_MIN_LENGTH,
        `JWT_ACCESS_SECRET must be at least ${String(JWT_ACCESS_SECRET_MIN_LENGTH)} characters`,
      ),
    CORS_ORIGINS: corsOriginsSchema,
    AUTH_COOKIE_SECURE: z
      .enum(AUTH_COOKIE_SECURE_VALUES)
      .default("true")
      .transform((value) => value === "true"),
    TRUST_PROXY_HOPS: z.coerce
      .number()
      .int()
      .min(0)
      .default(DEFAULT_TRUST_PROXY_HOPS),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") {
      return;
    }
    if (!env.AUTH_COOKIE_SECURE) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_COOKIE_SECURE"],
        message: "AUTH_COOKIE_SECURE must be true in production",
      });
    }
    if (env.CORS_ORIGINS.some((origin) => origin.startsWith("http://"))) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGINS"],
        message: "CORS_ORIGINS must use https in production",
      });
    }
    if (env.JWT_ACCESS_SECRET === JWT_ACCESS_SECRET_EXAMPLE) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_ACCESS_SECRET"],
        message:
          "JWT_ACCESS_SECRET must not be the example value in production",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${z.prettifyError(result.error)}`,
      { cause: result.error },
    );
  }
  return result.data;
}
