import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  buildRateLimitKey,
  RATE_LIMIT_POLICIES,
  type RateLimitRule,
} from "./rate-limit.policy.js";

const IP = "203.0.113.7";
const EMAIL = "ada@example.com";

const IP_RULE: RateLimitRule = {
  name: "test-ip",
  keyKind: "ip",
  points: 1,
  durationSeconds: 60,
};

const USER_ID = "0190a1b2-0000-7000-8000-000000000001";

const USER_RULE: RateLimitRule = {
  name: "test-user",
  keyKind: "user",
  points: 1,
  durationSeconds: 60,
};

const IP_AND_EMAIL_RULE: RateLimitRule = {
  name: "test-ip-email",
  keyKind: "ip-and-email",
  points: 1,
  durationSeconds: 60,
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("RATE_LIMIT_POLICIES", () => {
  it.each([
    ["login", 0, "ip-and-email", 10, 900],
    ["login", 1, "ip", 30, 900],
    ["register", 0, "ip", 5, 3600],
    ["refresh", 0, "ip", 60, 900],
    ["ai", 0, "user", 10, 60],
    ["ai", 1, "user", 100, 3600],
    ["ai", 2, "ip", 20, 60],
    ["ai", 3, "ip", 200, 3600],
  ] as const)(
    "defines the limits of spec section 3 (%s rule %i)",
    (policy, index, keyKind, points, durationSeconds) => {
      expect(RATE_LIMIT_POLICIES[policy][index]).toMatchObject({
        keyKind,
        points,
        durationSeconds,
      });
    },
  );
});

describe("buildRateLimitKey", () => {
  it("hashes the ip key with sha256", () => {
    expect(buildRateLimitKey(IP_RULE, { ip: IP, body: {}, userId: null })).toBe(
      sha256Hex(IP),
    );
  });

  it("builds the same key for emails differing in case and surrounding spaces", () => {
    const plain = buildRateLimitKey(IP_AND_EMAIL_RULE, {
      ip: IP,
      userId: null,
      body: { email: EMAIL },
    });
    const messy = buildRateLimitKey(IP_AND_EMAIL_RULE, {
      ip: IP,
      userId: null,
      body: { email: "  Ada@Example.COM " },
    });

    expect(messy).toBe(plain);
  });

  it("builds different keys for different emails from the same ip", () => {
    const first = buildRateLimitKey(IP_AND_EMAIL_RULE, {
      ip: IP,
      userId: null,
      body: { email: EMAIL },
    });
    const second = buildRateLimitKey(IP_AND_EMAIL_RULE, {
      ip: IP,
      userId: null,
      body: { email: "grace@example.com" },
    });

    expect(second).not.toBe(first);
  });

  it.each([
    ["an undefined body", undefined],
    ["a null body", null],
    ["a body without email", { username: "ada" }],
    ["a non-string email", { email: 42 }],
    ["a string body", "email=ada@example.com"],
  ])(
    "builds a key without an email when the body has no email string (%s)",
    (_label, body) => {
      expect(
        buildRateLimitKey(IP_AND_EMAIL_RULE, { ip: IP, body, userId: null }),
      ).toBe(sha256Hex(`${IP}\n`));
    },
  );

  it("never includes the plain email or ip in the key", () => {
    const key = buildRateLimitKey(IP_AND_EMAIL_RULE, {
      ip: IP,
      userId: null,
      body: { email: EMAIL },
    });

    expect(key).toBe(sha256Hex(`${IP}\n${EMAIL}`));
    expect(key).not.toContain(EMAIL);
    expect(key).not.toContain(IP);
  });

  it("hashes the user key with sha256", () => {
    expect(
      buildRateLimitKey(USER_RULE, { ip: IP, body: {}, userId: USER_ID }),
    ).toBe(sha256Hex(USER_ID));
  });

  it("throws for a user rule without a user", () => {
    expect(() =>
      buildRateLimitKey(USER_RULE, { ip: IP, body: {}, userId: null }),
    ).toThrow("Rate limit rule needs an authenticated user");
  });

  it("never includes the plain user id in the key", () => {
    const key = buildRateLimitKey(USER_RULE, {
      ip: IP,
      body: {},
      userId: USER_ID,
    });

    expect(key).not.toContain(USER_ID);
  });
});
