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
  MemoryRateLimiterStore,
  type RateLimitDecision,
  RateLimiterStore,
} from "./rate-limit.store.js";

const IP = "198.51.100.23";
const EMAIL = "ada@example.com";
const USER_ID = "0190a1b2-0000-7000-8000-000000000001";
const OTHER_USER_ID = "0190a1b2-0000-7000-8000-000000000002";
const AI_USER_MINUTE_LIMIT = 10;
const [LOGIN_IP_EMAIL_RULE, LOGIN_IP_RULE] = RATE_LIMIT_POLICIES.login;
const [AI_USER_MINUTE_RULE] = RATE_LIMIT_POLICIES.ai;

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

  @RateLimit("ai")
  ai(): void {
    // Handler body is irrelevant; only its metadata matters.
  }
}

function contextFor(
  handler: () => void,
  response: FakeResponse,
  userId?: string,
): ExecutionContextHost {
  const request = {
    ip: IP,
    body: { email: ` ${EMAIL.toUpperCase()} ` },
    ...(userId === undefined ? {} : { user: { userId } }),
  };
  return new ExecutionContextHost(
    [request, response],
    ProbeController,
    handler,
  );
}

async function createGuard(store: RateLimiterStore): Promise<RateLimitGuard> {
  const moduleRef = await Test.createTestingModule({
    providers: [RateLimitGuard, { provide: RateLimiterStore, useValue: store }],
  }).compile();
  return moduleRef.get(RateLimitGuard);
}

/** Sends `count` allowed ai requests for one user. */
async function sendAiRequests(
  guard: RateLimitGuard,
  userId: string,
  count: number,
): Promise<void> {
  await Promise.all(
    Array.from({ length: count }, () =>
      guard.canActivate(contextFor(AI_HANDLER, new FakeResponse(), userId)),
    ),
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
const AI_HANDLER = ProbeController.prototype.ai;
/* eslint-enable @typescript-eslint/unbound-method -- only the handler references above need it */

describe("RateLimitGuard", () => {
  let guard: RateLimitGuard;
  let store: FakeRateLimiterStore;
  let response: FakeResponse;

  beforeEach(async () => {
    store = new FakeRateLimiterStore();
    response = new FakeResponse();
    guard = await createGuard(store);
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
          userId: null,
        }),
      },
      {
        ruleName: LOGIN_IP_RULE.name,
        key: buildRateLimitKey(LOGIN_IP_RULE, {
          ip: IP,
          body: {},
          userId: null,
        }),
      },
    ]);
  });

  it("passes the authenticated user id to user rules", async () => {
    await guard.canActivate(contextFor(AI_HANDLER, response, USER_ID));

    expect(store.calls).toContainEqual({
      ruleName: AI_USER_MINUTE_RULE.name,
      key: buildRateLimitKey(AI_USER_MINUTE_RULE, {
        ip: IP,
        body: {},
        userId: USER_ID,
      }),
    });
  });
});

describe("RateLimitGuard with the in-memory store", () => {
  let guard: RateLimitGuard;

  beforeEach(async () => {
    guard = await createGuard(new MemoryRateLimiterStore());
  });

  it("rejects the eleventh ai request in a minute for one user", async () => {
    await sendAiRequests(guard, USER_ID, AI_USER_MINUTE_LIMIT);
    const response = new FakeResponse();

    const rejection = await rejectionOf(
      guard,
      contextFor(AI_HANDLER, response, USER_ID),
    );

    expect(rejection).toEqual({ statusCode: 429, code: "too-many-requests" });
    expect(response.headers.has("Retry-After")).toBe(true);
  });

  it("does not limit another user after one user is limited", async () => {
    await sendAiRequests(guard, USER_ID, AI_USER_MINUTE_LIMIT);
    await rejectionOf(
      guard,
      contextFor(AI_HANDLER, new FakeResponse(), USER_ID),
    );

    await expect(
      guard.canActivate(
        contextFor(AI_HANDLER, new FakeResponse(), OTHER_USER_ID),
      ),
    ).resolves.toBe(true);
  });
});
