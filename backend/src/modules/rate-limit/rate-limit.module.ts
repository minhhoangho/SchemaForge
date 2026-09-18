import { Module } from "@nestjs/common";

import { RateLimitGuard } from "./rate-limit.guard.js";
import {
  MemoryRateLimiterStore,
  RateLimiterStore,
} from "./rate-limit.store.js";

@Module({
  providers: [
    { provide: RateLimiterStore, useClass: MemoryRateLimiterStore },
    RateLimitGuard,
  ],
  exports: [RateLimiterStore, RateLimitGuard],
})
export class RateLimitModule {}
