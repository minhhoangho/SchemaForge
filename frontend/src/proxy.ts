import { NextResponse } from "next/server";
import type { NextRequest, ProxyConfig } from "next/server";

import { env } from "@/lib/env";
import {
  buildContentSecurityPolicy,
  CONTENT_SECURITY_POLICY_HEADER_NAME,
  NONCE_HEADER_NAME,
} from "@/lib/security/content-security-policy";

// CSP Level 3 recommends at least 128 bits of randomness for a nonce.
const NONCE_BYTE_LENGTH = 16;

export function proxy(request: NextRequest): NextResponse {
  const nonceBytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTE_LENGTH));
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  const policy = buildContentSecurityPolicy({
    nonce,
    isDevelopment: env.isDevelopment,
    apiOrigin: env.apiOrigin,
  });

  // Next.js reads the nonce from the request's CSP header while rendering and
  // attaches it to its own scripts; the layout reads x-nonce.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER_NAME, nonce);
  requestHeaders.set(CONTENT_SECURITY_POLICY_HEADER_NAME, policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(CONTENT_SECURITY_POLICY_HEADER_NAME, policy);
  return response;
}

// Next.js reads this object statically at build time, so it must stay a plain
// literal without computed values.
export const config: ProxyConfig = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
