import { Injectable } from "@nestjs/common";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

import {
  RATE_LIMIT_POLICIES,
  type RateLimitRule,
} from "./rate-limit.policy.js";

export type RateLimitDecision =
  | { readonly isAllowed: true }
  | { readonly isAllowed: false; readonly retryAfterSeconds: number };

const MILLISECONDS_PER_SECOND = 1000;
const MIN_RETRY_AFTER_SECONDS = 1;

/**
 * Abstract class so it doubles as the DI token. Moving to a PostgreSQL or Redis
 * store later only changes the `useClass` in `RateLimitModule` (spec section 3).
 */
export abstract class RateLimiterStore {
  abstract consume(
    rule: RateLimitRule,
    key: string,
  ): Promise<RateLimitDecision>;
}

/** In-process counters: correct only while the backend runs as a single instance. */
@Injectable()
export class MemoryRateLimiterStore extends RateLimiterStore {
  private readonly limiters = new Map<string, RateLimiterMemory>(
    Object.values(RATE_LIMIT_POLICIES)
      .flat()
      .map((rule) => [
        rule.name,
        new RateLimiterMemory({
          keyPrefix: rule.name,
          points: rule.points,
          duration: rule.durationSeconds,
        }),
      ]),
  );

  override async consume(
    rule: RateLimitRule,
    key: string,
  ): Promise<RateLimitDecision> {
    const limiter = this.limiters.get(rule.name);
    if (limiter === undefined) {
      throw new Error(`Rate limit rule "${rule.name}" is not registered`);
    }
    try {
      await limiter.consume(key);
      return { isAllowed: true };
    } catch (error: unknown) {
      if (!(error instanceof RateLimiterRes)) {
        throw error;
      }
      return {
        isAllowed: false,
        retryAfterSeconds: Math.max(
          MIN_RETRY_AFTER_SECONDS,
          Math.ceil(error.msBeforeNext / MILLISECONDS_PER_SECOND),
        ),
      };
    }
  }
}
