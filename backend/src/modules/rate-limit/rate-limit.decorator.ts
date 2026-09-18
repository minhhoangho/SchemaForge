import { type CustomDecorator, SetMetadata } from "@nestjs/common";

import type { RateLimitPolicyName } from "./rate-limit.policy.js";

export const RATE_LIMIT_POLICY_KEY = "rateLimitPolicy";

/** Applies a policy of `RATE_LIMIT_POLICIES` to a handler or controller. */
export const RateLimit = (policy: RateLimitPolicyName): CustomDecorator =>
  SetMetadata(RATE_LIMIT_POLICY_KEY, policy);
