import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "./content-security-policy";

const NONCE = "bm9uY2UtdmFsdWU=";

function parseDirectives(policy: string): ReadonlyMap<string, string> {
  return new Map(
    policy.split("; ").map((directive) => {
      const separatorIndex = directive.indexOf(" ");
      return separatorIndex === -1
        ? [directive, ""]
        : [
            directive.slice(0, separatorIndex),
            directive.slice(separatorIndex + 1),
          ];
    }),
  );
}

function buildDirectives(isDevelopment: boolean): ReadonlyMap<string, string> {
  return parseDirectives(
    buildContentSecurityPolicy({ nonce: NONCE, isDevelopment }),
  );
}

describe("buildContentSecurityPolicy", () => {
  it.each([
    "default-src",
    "script-src",
    "style-src",
    "img-src",
    "font-src",
    "connect-src",
    "object-src",
    "base-uri",
    "form-action",
    "frame-ancestors",
    "upgrade-insecure-requests",
  ])("includes the %s directive", (directive) => {
    expect(buildDirectives(false).has(directive)).toBe(true);
  });

  it("lists the production directives in the order of the spec", () => {
    expect(
      buildContentSecurityPolicy({ nonce: NONCE, isDevelopment: false }),
    ).toBe(
      [
        "default-src 'self'",
        `script-src 'self' 'nonce-${NONCE}' 'strict-dynamic'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
      ].join("; "),
    );
  });

  it("puts the nonce and strict-dynamic in script-src", () => {
    expect(buildDirectives(false).get("script-src")).toBe(
      `'self' 'nonce-${NONCE}' 'strict-dynamic'`,
    );
  });

  it("allows unsafe-eval only in development", () => {
    expect({
      development: buildDirectives(true).get("script-src"),
      production: buildDirectives(false).get("script-src"),
    }).toStrictEqual({
      development: `'self' 'nonce-${NONCE}' 'strict-dynamic' 'unsafe-eval'`,
      production: `'self' 'nonce-${NONCE}' 'strict-dynamic'`,
    });
  });

  it("adds upgrade-insecure-requests only outside development", () => {
    expect({
      development: buildDirectives(true).has("upgrade-insecure-requests"),
      production: buildDirectives(false).has("upgrade-insecure-requests"),
    }).toStrictEqual({ development: false, production: true });
  });

  it("allows inline styles", () => {
    expect(buildDirectives(false).get("style-src")).toBe(
      "'self' 'unsafe-inline'",
    );
  });

  it("forbids framing, plugins and cross-origin connections", () => {
    const directives = buildDirectives(false);

    expect({
      frameAncestors: directives.get("frame-ancestors"),
      objectSource: directives.get("object-src"),
      connectSource: directives.get("connect-src"),
    }).toStrictEqual({
      frameAncestors: "'none'",
      objectSource: "'none'",
      connectSource: "'self'",
    });
  });
});
