export type SetCookie = {
  readonly name: string;
  readonly value: string;
  /** Attribute names lowercased: "path", "max-age", "httponly", "samesite", … */
  readonly attributes: ReadonlyMap<string, string | true>;
};

const NAME_VALUE_SEPARATOR = "=";

function parseAttributes(parts: readonly string[]): Map<string, string | true> {
  const attributes = new Map<string, string | true>();
  for (const part of parts) {
    const separator = part.indexOf(NAME_VALUE_SEPARATOR);
    if (separator === -1) {
      attributes.set(part.trim().toLowerCase(), true);
      continue;
    }
    attributes.set(
      part.slice(0, separator).trim().toLowerCase(),
      part.slice(separator + 1).trim(),
    );
  }
  return attributes;
}

function parseSetCookie(header: string): SetCookie | null {
  const [pair, ...rest] = header.split(";");
  if (pair === undefined) {
    return null;
  }
  const separator = pair.indexOf(NAME_VALUE_SEPARATOR);
  if (separator <= 0) {
    return null;
  }
  return {
    name: pair.slice(0, separator).trim(),
    value: pair.slice(separator + 1).trim(),
    attributes: parseAttributes(rest),
  };
}

/** Parses `response.headers["set-cookie"]`; anything that is not a string is ignored. */
export function parseSetCookieHeaders(header: unknown): readonly SetCookie[] {
  const entries: readonly unknown[] = Array.isArray(header) ? header : [];
  const cookies: SetCookie[] = [];
  for (const entry of entries) {
    const cookie = typeof entry === "string" ? parseSetCookie(entry) : null;
    if (cookie !== null) {
      cookies.push(cookie);
    }
  }
  return cookies;
}

/** A `Max-Age` of zero or an `Expires` in the past means the server cleared the cookie. */
export function isClearedSetCookie(cookie: SetCookie): boolean {
  const maxAge = cookie.attributes.get("max-age");
  if (typeof maxAge === "string" && Number(maxAge) <= 0) {
    return true;
  }
  const expires = cookie.attributes.get("expires");
  return typeof expires === "string" && Date.parse(expires) <= Date.now();
}

export function findSetCookie(
  cookies: readonly SetCookie[],
  name: string,
): SetCookie | null {
  return cookies.find((cookie) => cookie.name === name) ?? null;
}
