import { createHash } from "node:crypto";

import { normalizeEmail } from "../../common/normalize-email.js";

export type RateLimitKeyKind = "ip" | "ip-and-email";

export type RateLimitRule = {
  /** Also the limiter's key prefix, so it must be unique across policies. */
  readonly name: string;
  readonly keyKind: RateLimitKeyKind;
  readonly points: number;
  readonly durationSeconds: number;
};

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
} as const satisfies Record<string, readonly RateLimitRule[]>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

export type RateLimitKeyInput = {
  readonly ip: string;
  /** Raw request body: the guard runs before `ValidationPipe`. */
  readonly body: unknown;
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
    default: {
      const unhandled: never = rule.keyKind;
      throw new Error(`Unhandled rate limit key kind: ${String(unhandled)}`);
    }
  }
}
