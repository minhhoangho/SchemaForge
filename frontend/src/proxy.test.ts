import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

const PAGE_URL = "http://localhost/schemas/abc";
const NONCE_PATTERN = /'nonce-([^']+)'/;
// Next.js 16.3.5 encodes headers forwarded with NextResponse.next({ request })
// as x-middleware-request-<name> headers on the response.
const FORWARDED_HEADER_PREFIX = "x-middleware-request-";

function readNonce(policy: string | null): string | undefined {
  return NONCE_PATTERN.exec(policy ?? "")?.[1];
}

function runProxy(): Headers {
  return proxy(new NextRequest(PAGE_URL)).headers;
}

describe("proxy", () => {
  it("sets a Content-Security-Policy header with a nonce on the response", () => {
    const headers = runProxy();

    expect(readNonce(headers.get("Content-Security-Policy"))).toMatch(/.+/);
  });

  it("forwards the same nonce to the request as x-nonce", () => {
    const headers = runProxy();
    const nonce = readNonce(headers.get("Content-Security-Policy"));

    expect(headers.get(`${FORWARDED_HEADER_PREFIX}x-nonce`)).toBe(nonce);
  });

  it("forwards the Content-Security-Policy header to the request", () => {
    const headers = runProxy();

    expect(
      headers.get(`${FORWARDED_HEADER_PREFIX}content-security-policy`),
    ).toBe(headers.get("Content-Security-Policy"));
  });

  it("generates a different nonce for each request", () => {
    const firstNonce = readNonce(runProxy().get("Content-Security-Policy"));
    const secondNonce = readNonce(runProxy().get("Content-Security-Policy"));

    expect(firstNonce).not.toBe(secondNonce);
  });

  it("skips static assets and prefetch requests", () => {
    expect({
      page: unstable_doesMiddlewareMatch({ config, url: "/schemas/abc" }),
      staticAsset: unstable_doesMiddlewareMatch({
        config,
        url: "/_next/static/chunk.js",
      }),
      prefetch: unstable_doesMiddlewareMatch({
        config,
        url: "/schemas/abc",
        headers: { "next-router-prefetch": "1" },
      }),
    }).toStrictEqual({ page: true, staticAsset: false, prefetch: false });
  });
});
