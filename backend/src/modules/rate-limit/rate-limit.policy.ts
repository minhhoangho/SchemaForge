import { createHash } from "node:crypto";

import { normalizeEmail } from "../../common/normalize-email.js";

export type RateLimitKeyKind = "ip" | "ip-and-email" | "user";

export type RateLimitRule = {
  /** Also the limiter's key prefix, so it must be unique across policies. */
  readonly name: string;
  readonly keyKind: RateLimitKeyKind;
  readonly points: number;
  readonly durationSeconds: number;
};

const ONE_MINUTE_IN_SECONDS = 60;
const FIFTEEN_MINUTES_IN_SECONDS = 900;
const ONE_HOUR_IN_SECONDS = 3600;

/** Spec section 3 "Chính sách"; code constants on purpose, not env. */
export const RATE_LIMIT_POLICIES = {
  login: [
    {
      name: "login-ip-email",
      keyKind: "ip-and-email",
      points: 10,
      durationSeconds: FIFTEEN_MINUTES_IN_SECONDS,
    },
    {
      name: "login-ip",
      keyKind: "ip",
      points: 30,
      durationSeconds: FIFTEEN_MINUTES_IN_SECONDS,
    },
  ],
  register: [
    {
      name: "register-ip",
      keyKind: "ip",
      points: 5,
      durationSeconds: ONE_HOUR_IN_SECONDS,
    },
  ],
  refresh: [
    {
      name: "refresh-ip",
      keyKind: "ip",
      points: 60,
      durationSeconds: FIFTEEN_MINUTES_IN_SECONDS,
    },
  ],
  // AI spec AI-R49: the ip rules stop one person multiplying the per-user
  // limit with several accounts from one machine.
  ai: [
    {
      name: "ai-user-minute",
      keyKind: "user",
      points: 10,
      durationSeconds: ONE_MINUTE_IN_SECONDS,
    },
    {
      name: "ai-user-hour",
      keyKind: "user",
      points: 100,
      durationSeconds: ONE_HOUR_IN_SECONDS,
    },
    {
      name: "ai-ip-minute",
      keyKind: "ip",
      points: 20,
      durationSeconds: ONE_MINUTE_IN_SECONDS,
    },
    {
      name: "ai-ip-hour",
      keyKind: "ip",
      points: 200,
      durationSeconds: ONE_HOUR_IN_SECONDS,
    },
  ],
} as const satisfies Record<string, readonly RateLimitRule[]>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

export type RateLimitKeyInput = {
  readonly ip: string;
  /** Raw request body: the guard runs before `ValidationPipe`. */
  readonly body: unknown;
  /** Set by `JwtAuthGuard`, which runs first; `null` on public routes. */
  readonly userId: string | null;
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hasEmailString(body: unknown): body is { readonly email: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "email" in body &&
    typeof body.email === "string"
  );
}

/**
 * Hashes the key so neither the email nor the ip is kept in the store in clear
 * (spec section 3). A missing or non-string email falls back to an empty one;
 * the ip-only rules still count that request and `ValidationPipe` rejects it.
 */
export function buildRateLimitKey(
  rule: RateLimitRule,
  input: RateLimitKeyInput,
): string {
  switch (rule.keyKind) {
    case "ip":
      return sha256Hex(input.ip);
    case "ip-and-email": {
      const email = hasEmailString(input.body)
        ? normalizeEmail(input.body.email)
        : "";
      return sha256Hex(`${input.ip}\n${email}`);
    }
    case "user":
      if (input.userId === null) {
        // Programming error: a user rule on a route without authentication.
        throw new Error("Rate limit rule needs an authenticated user");
      }
      return sha256Hex(input.userId);
    default: {
      const unhandled: never = rule.keyKind;
      throw new Error(`Unhandled rate limit key kind: ${String(unhandled)}`);
    }
  }
}
