import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it } from "vitest";

import { ApiException } from "../../common/api.exception.js";
import { RateLimit } from "./rate-limit.decorator.js";
import { RateLimitGuard } from "./rate-limit.guard.js";
import {
  buildRateLimitKey,
  RATE_LIMIT_POLICIES,
  type RateLimitRule,
} from "./rate-limit.policy.js";
import {
  type RateLimitDecision,
  RateLimiterStore,
} from "./rate-limit.store.js";

const IP = "198.51.100.23";
const EMAIL = "ada@example.com";
const [LOGIN_IP_EMAIL_RULE, LOGIN_IP_RULE] = RATE_LIMIT_POLICIES.login;

type ConsumeCall = { readonly ruleName: string; readonly key: string };

/** Records every call and answers with the decision configured per rule name. */
class FakeRateLimiterStore extends RateLimiterStore {
  readonly calls: ConsumeCall[] = [];
  private readonly decisions = new Map<string, RateLimitDecision>();

  deny(ruleName: string, retryAfterSeconds: number): void {
    this.decisions.set(ruleName, { isAllowed: false, retryAfterSeconds });
  }

  override consume(
    rule: RateLimitRule,
    key: string,
  ): Promise<RateLimitDecision> {
    this.calls.push({ ruleName: rule.name, key });
    return Promise.resolve(
      this.decisions.get(rule.name) ?? { isAllowed: true },
    );
  }
}

class FakeResponse {
  readonly headers = new Map<string, string>();

  setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }
}

class ProbeController {
  unlimited(): void {
    // Handler body is irrelevant; only its metadata matters.
  }

  @RateLimit("login")
  login(): void {
    // Handler body is irrelevant; only its metadata matters.
  }
}

function contextFor(
  handler: () => void,
  response: FakeResponse,
): ExecutionContextHost {
  return new ExecutionContextHost(
    [{ ip: IP, body: { email: ` ${EMAIL.toUpperCase()} ` } }, response],
    ProbeController,
    handler,
  );
}

async function rejectionOf(
  guard: RateLimitGuard,
  context: ExecutionContextHost,
): Promise<unknown> {
  try {
    await guard.canActivate(context);
  } catch (error: unknown) {
    return error instanceof ApiException ? error.body : error;
  }
  return "allowed";
}

/* eslint-disable @typescript-eslint/unbound-method -- only decorator metadata is read, handlers are never called */
const UNLIMITED_HANDLER = ProbeController.prototype.unlimited;
const LOGIN_HANDLER = ProbeController.prototype.login;
/* eslint-enable @typescript-eslint/unbound-method -- only the two handler references above need it */

describe("RateLimitGuard", () => {
  let guard: RateLimitGuard;
  let store: FakeRateLimiterStore;
  let response: FakeResponse;

  beforeEach(async () => {
    store = new FakeRateLimiterStore();
    response = new FakeResponse();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        { provide: RateLimiterStore, useValue: store },
      ],
    }).compile();
    guard = moduleRef.get(RateLimitGuard);
  });

  it("allows a handler without a rate limit policy", async () => {
    await expect(
      guard.canActivate(contextFor(UNLIMITED_HANDLER, response)),
    ).resolves.toBe(true);
    expect(store.calls).toEqual([]);
  });

  it("allows a request under the limit", async () => {
    await expect(
      guard.canActivate(contextFor(LOGIN_HANDLER, response)),
    ).resolves.toBe(true);
    expect(response.headers.has("Retry-After")).toBe(false);
  });

  it("rejects a request over the limit with too-many-requests and a Retry-After header", async () => {
    store.deny(LOGIN_IP_RULE.name, 42);

    const rejection = await rejectionOf(
      guard,
      contextFor(LOGIN_HANDLER, response),
    );

    expect(rejection).toEqual({ statusCode: 429, code: "too-many-requests" });
    expect(response.headers.get("Retry-After")).toBe("42");
  });

  it("uses the largest retry-after when several rules deny", async () => {
    store.deny(LOGIN_IP_EMAIL_RULE.name, 120);
    store.deny(LOGIN_IP_RULE.name, 30);

    await rejectionOf(guard, contextFor(LOGIN_HANDLER, response));

    expect(response.headers.get("Retry-After")).toBe("120");
  });

  it("consumes every rule of the policy even when one denies", async () => {
    store.deny(LOGIN_IP_EMAIL_RULE.name, 10);

    await rejectionOf(guard, contextFor(LOGIN_HANDLER, response));

    expect(store.calls.map((call) => call.ruleName)).toEqual([
      LOGIN_IP_EMAIL_RULE.name,
      LOGIN_IP_RULE.name,
    ]);
  });

  it("passes hashed keys to the store", async () => {
    await guard.canActivate(contextFor(LOGIN_HANDLER, response));

    expect(store.calls).toEqual([
      {
        ruleName: LOGIN_IP_EMAIL_RULE.name,
        key: buildRateLimitKey(LOGIN_IP_EMAIL_RULE, {
          ip: IP,
          body: { email: EMAIL },
        }),
      },
      {
        ruleName: LOGIN_IP_RULE.name,
        key: buildRateLimitKey(LOGIN_IP_RULE, { ip: IP, body: {} }),
      },
    ]);
  });
});
