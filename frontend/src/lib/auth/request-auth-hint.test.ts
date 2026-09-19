import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRequestAuthHint } from "./request-auth-hint";

// The mocked next/headers reads this request, so each test sets only the
// cookie it is about.
const request = vi.hoisted(() => ({ cookies: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = request.cookies.get(name);
        return value === undefined ? undefined : { name, value };
      },
    }),
}));

beforeEach(() => {
  request.cookies = new Map();
});

describe("getRequestAuthHint", () => {
  it("returns true when the hint cookie is 1", async () => {
    request.cookies = new Map([["sf-auth-hint", "1"]]);

    expect(await getRequestAuthHint()).toBe(true);
  });

  it("returns false when the cookie is missing", async () => {
    expect(await getRequestAuthHint()).toBe(false);
  });

  it("returns false when the cookie has another value", async () => {
    request.cookies = new Map([["sf-auth-hint", "yes"]]);

    expect(await getRequestAuthHint()).toBe(false);
  });
});
