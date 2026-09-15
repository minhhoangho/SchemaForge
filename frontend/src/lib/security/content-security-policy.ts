export const NONCE_HEADER_NAME = "x-nonce";
export const CONTENT_SECURITY_POLICY_HEADER_NAME = "Content-Security-Policy";

const SELF = "'self'";
const NONE = "'none'";
const STRICT_DYNAMIC = "'strict-dynamic'";
// React uses eval in development to rebuild server error stacks in the browser.
const UNSAFE_EVAL = "'unsafe-eval'";
// Radix, Sonner, and React Flow inject style tags and attributes at runtime
// without a nonce; scripts stay locked to the nonce.
const UNSAFE_INLINE = "'unsafe-inline'";

export type ContentSecurityPolicyInput = {
  readonly nonce: string;
  readonly isDevelopment: boolean;
};

export function buildContentSecurityPolicy(
  input: ContentSecurityPolicyInput,
): string {
  const scriptSources = [
    SELF,
    `'nonce-${input.nonce}'`,
    STRICT_DYNAMIC,
    ...(input.isDevelopment ? [UNSAFE_EVAL] : []),
  ];

  return [
    `default-src ${SELF}`,
    `script-src ${scriptSources.join(" ")}`,
    `style-src ${SELF} ${UNSAFE_INLINE}`,
    `img-src ${SELF} blob: data:`,
    `font-src ${SELF}`,
    `connect-src ${SELF}`,
    `object-src ${NONE}`,
    `base-uri ${SELF}`,
    `form-action ${SELF}`,
    `frame-ancestors ${NONE}`,
    // The development server runs on plain http://localhost.
    ...(input.isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
