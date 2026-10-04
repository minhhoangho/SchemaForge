import { Inject, Injectable, Logger } from "@nestjs/common";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

import { AI_GLOBAL_BUDGET_WINDOW_SECONDS } from "./ai.constants.js";
import { AI_GLOBAL_REQUESTS_PER_HOUR } from "./ai-model.provider.js";

const GLOBAL_BUDGET_KEY = "all-users";
const MS_PER_SECOND = 1000;

export type AiBudgetResult =
  | { readonly isAllowed: true }
  | { readonly isAllowed: false; readonly retryAfterSeconds: number };

/**
 * One running AI turn per user (AI-R56) and the global hourly budget that
 * caps the cost of the system key across all users (AI-R55).
 */
// ponytail: per-process lock and global budget; both reset on restart and are not shared across instances. Move them to a shared store when the backend runs more than one instance.
@Injectable()
export class AiCapacity {
  private readonly logger = new Logger(AiCapacity.name);
  private readonly streams = new Map<string, symbol>();
  private readonly globalBudget: RateLimiterMemory;

  constructor(
    @Inject(AI_GLOBAL_REQUESTS_PER_HOUR) private readonly budgetPerHour: number,
  ) {
    this.globalBudget = new RateLimiterMemory({
      keyPrefix: "ai-global",
      points: budgetPerHour,
      duration: AI_GLOBAL_BUDGET_WINDOW_SECONDS,
    });
  }

  /**
   * Returns a single-use release, or null while the user has a turn running.
   * The release frees the lock only while it still holds it, so a late or
   * repeated call never frees the lock of a newer turn.
   */
  tryAcquireStream(userId: string): (() => void) | null {
    if (this.streams.has(userId)) {
      return null;
    }
    const token = Symbol();
    this.streams.set(userId, token);
    return () => {
      if (this.streams.get(userId) === token) {
        this.streams.delete(userId);
      }
    };
  }

  /**
   * Spends one point. Once the hourly budget is used up, returns the seconds
   * until the window resets, for `Retry-After` (AI-R55).
   */
  async tryConsumeGlobalBudget(): Promise<AiBudgetResult> {
    try {
      await this.globalBudget.consume(GLOBAL_BUDGET_KEY);
      return { isAllowed: true };
    } catch (error: unknown) {
      if (!(error instanceof RateLimiterRes)) {
        throw error;
      }
      // Rejected calls still count, so only the first rejection of a window
      // has one point over the budget: one log line per window.
      if (error.consumedPoints === this.budgetPerHour + 1) {
        this.logger.warn("ai.budget.exhausted");
      }
      return {
        isAllowed: false,
        retryAfterSeconds: Math.ceil(error.msBeforeNext / MS_PER_SECOND),
      };
    }
  }
}
