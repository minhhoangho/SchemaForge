import { describe, expect, it } from "vitest";

import {
  AUTH_HINT_COOKIE_NAME,
  createAuthHintCookie,
  parseAuthHint,
  serializeAuthHintCookie,
  serializeClearedAuthHintCookie,
} from "./auth-hint-cookie";

describe("parseAuthHint", () => {
  it.each([
    ["1", true],
    ["0", false],
    ["true", false],
    ["", false],
    [" 1", false],
    [undefined, false],
  ])("accepts only the value 1 as a hint (%j)", (value, isHint) => {
    expect(parseAuthHint(value)).toBe(isHint);
  });
});

describe("serializeAuthHintCookie", () => {
  it("serializes the hint with path, max age and SameSite=Lax", () => {
    expect(serializeAuthHintCookie({ isSecure: false })).toBe(
      "sf-auth-hint=1; Path=/; Max-Age=2592000; SameSite=Lax",
    );
  });

  it.each([
    [true, "sf-auth-hint=1; Path=/; Max-Age=2592000; SameSite=Lax; Secure"],
    [false, "sf-auth-hint=1; Path=/; Max-Age=2592000; SameSite=Lax"],
  ])("adds Secure only when isSecure is true (%s)", (isSecure, expected) => {
    expect(serializeAuthHintCookie({ isSecure })).toBe(expected);
  });
});

describe("serializeClearedAuthHintCookie", () => {
  it("clears the hint with Max-Age=0", () => {
    expect(serializeClearedAuthHintCookie({ isSecure: true })).toBe(
      "sf-auth-hint=; Path=/; Max-Age=0; SameSite=Lax; Secure",
    );
  });
});

describe("createAuthHintCookie", () => {
  it("reads the hint among other cookies", () => {
    const hintCookie = createAuthHintCookie({
      cookieJar: { cookie: `sf-theme=dark; ${AUTH_HINT_COOKIE_NAME}=1; x=y` },
      isSecure: false,
    });

    expect(hintCookie.isPresent()).toBe(true);
  });

  it("reports no hint when only other cookies are set", () => {
    const hintCookie = createAuthHintCookie({
      cookieJar: { cookie: "sf-theme=dark; sf-auth-hint-other=1" },
      isSecure: false,
    });

    expect(hintCookie.isPresent()).toBe(false);
  });

  it("writes the serialized hint to the cookie jar", () => {
    const cookieJar = { cookie: "" };
    const hintCookie = createAuthHintCookie({ cookieJar, isSecure: true });

    hintCookie.write();

    expect(cookieJar.cookie).toBe(serializeAuthHintCookie({ isSecure: true }));
  });

  it("writes the cleared hint to the cookie jar", () => {
    const cookieJar = { cookie: "" };
    const hintCookie = createAuthHintCookie({ cookieJar, isSecure: false });

    hintCookie.clear();

    expect(cookieJar.cookie).toBe(
      serializeClearedAuthHintCookie({ isSecure: false }),
    );
  });
});
