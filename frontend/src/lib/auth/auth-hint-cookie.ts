export const AUTH_HINT_COOKIE_NAME = "sf-auth-hint";

// 30 days, the lifetime of the refresh token.
export const AUTH_HINT_MAX_AGE_SECONDS = 2_592_000;

// The hint only says "this browser signed in before". It never holds a token
// or anything about the user; the backend trusts only its HttpOnly cookies.
const AUTH_HINT_VALUE = "1";

type AuthHintCookieOptions = { readonly isSecure: boolean };

export type AuthHintCookie = {
  readonly isPresent: () => boolean;
  readonly write: () => void;
  readonly clear: () => void;
};

export function parseAuthHint(value: string | undefined): boolean {
  return value === AUTH_HINT_VALUE;
}

function serializeWithAttributes(
  value: string,
  maxAgeSeconds: number,
  options: AuthHintCookieOptions,
): string {
  const serialized = `${AUTH_HINT_COOKIE_NAME}=${value}; Path=/; Max-Age=${String(maxAgeSeconds)}; SameSite=Lax`;
  return options.isSecure ? `${serialized}; Secure` : serialized;
}

export function serializeAuthHintCookie(
  options: AuthHintCookieOptions,
): string {
  return serializeWithAttributes(
    AUTH_HINT_VALUE,
    AUTH_HINT_MAX_AGE_SECONDS,
    options,
  );
}

export function serializeClearedAuthHintCookie(
  options: AuthHintCookieOptions,
): string {
  return serializeWithAttributes("", 0, options);
}

function readCookieValue(cookies: string, name: string): string | undefined {
  for (const entry of cookies.split(";")) {
    const separatorIndex = entry.indexOf("=");
    if (
      separatorIndex !== -1 &&
      entry.slice(0, separatorIndex).trim() === name
    ) {
      return entry.slice(separatorIndex + 1).trim();
    }
  }
  return undefined;
}

export function createAuthHintCookie(input: {
  readonly cookieJar: Pick<Document, "cookie">;
  readonly isSecure: boolean;
}): AuthHintCookie {
  const options = { isSecure: input.isSecure };
  return {
    isPresent: () =>
      parseAuthHint(
        readCookieValue(input.cookieJar.cookie, AUTH_HINT_COOKIE_NAME),
      ),
    write: () => {
      input.cookieJar.cookie = serializeAuthHintCookie(options);
    },
    clear: () => {
      input.cookieJar.cookie = serializeClearedAuthHintCookie(options);
    },
  };
}
