// A placeholder origin: a return path is valid only if resolving it against
// this origin keeps the origin, that is, it points inside the app.
const RETURN_TO_BASE_URL = new URL("https://return-to.invalid");

const FALLBACK_RETURN_TO = "/";

function hasSafeShape(value: string): boolean {
  return (
    value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
  );
}

function resolveSameOrigin(value: string): URL | null {
  try {
    const resolved = new URL(value, RETURN_TO_BASE_URL);
    return resolved.origin === RETURN_TO_BASE_URL.origin ? resolved : null;
  } catch {
    // An unparsable value is simply not a valid return path.
    return null;
  }
}

/**
 * Keeps only a path inside the app, so a crafted `returnTo` cannot redirect
 * to another site (auth-cloud spec, section 6).
 */
export function sanitizeReturnTo(value: string | null | undefined): string {
  if (value === null || value === undefined || !hasSafeShape(value)) {
    return FALLBACK_RETURN_TO;
  }
  const resolved = resolveSameOrigin(value);
  if (resolved === null) {
    return FALLBACK_RETURN_TO;
  }
  const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
  // Dot segments can normalize to a leading "//" ("/.//evil.com"), which the
  // router would treat as a protocol-relative URL to another host.
  return hasSafeShape(path) ? path : FALLBACK_RETURN_TO;
}

export function buildAuthHref(
  route: "/sign-in" | "/sign-up",
  returnTo: string,
): string {
  const query = new URLSearchParams({ returnTo: sanitizeReturnTo(returnTo) });
  return `${route}?${query.toString()}`;
}
