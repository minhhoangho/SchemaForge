import { z } from "zod";

const NODE_ENVIRONMENTS = ["development", "test", "production"] as const;
const DEFAULT_PORT = 3001;

const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVIRONMENTS).default("development"),
  PORT: z.coerce.number().int().positive().default(DEFAULT_PORT),
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
