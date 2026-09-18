import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { API_ERROR_STATUS } from "@schemaforge/api-contract";
import type { Request, Response } from "express";

import { ApiException } from "../../common/api.exception.js";
import { RATE_LIMIT_POLICY_KEY } from "./rate-limit.decorator.js";
import {
  buildRateLimitKey,
  RATE_LIMIT_POLICIES,
  type RateLimitPolicyName,
} from "./rate-limit.policy.js";
import { RateLimiterStore } from "./rate-limit.store.js";

/**
 * Applies the `@RateLimit(policy)` of a handler. Every rule of the policy is
 * consumed on every request (spec section 3), so a denial on one rule does not
 * skip counting on the others.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly store: RateLimiterStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<
      RateLimitPolicyName | undefined
    >(RATE_LIMIT_POLICY_KEY, [context.getHandler(), context.getClass()]);
    if (policy === undefined) {
      return true;
    }
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    // Express types the parsed body as `any`; it is untrusted until narrowed.
    const body: unknown = request.body;
    const input = { ip: request.ip ?? "", body };
    const decisions = await Promise.all(
      RATE_LIMIT_POLICIES[policy].map((rule) =>
        this.store.consume(rule, buildRateLimitKey(rule, input)),
      ),
    );
    const retryAfterSeconds = decisions.flatMap((decision) =>
      decision.isAllowed ? [] : [decision.retryAfterSeconds],
    );
    if (retryAfterSeconds.length === 0) {
      return true;
    }
    http
      .getResponse<Response>()
      .setHeader("Retry-After", String(Math.max(...retryAfterSeconds)));
    throw new ApiException({
      statusCode: API_ERROR_STATUS["too-many-requests"],
      code: "too-many-requests",
    });
  }
}
