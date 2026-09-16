import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getRequestLocale,
  getRequestNonce,
  getRequestThemePreference,
} from "./request-locale";

// The mocked next/headers reads this request, so each test sets only the
// cookies and headers it is about.
const request = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  headers: new Headers(),
}));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = request.cookies.get(name);
        return value === undefined ? undefined : { name, value };
      },
    }),
  headers: () => Promise.resolve(request.headers),
}));

beforeEach(() => {
  request.cookies = new Map();
  request.headers = new Headers();
});

describe("getRequestLocale", () => {
  it("reads the locale from the sf-locale cookie", async () => {
    request.cookies = new Map([["sf-locale", "vi"]]);
    request.headers = new Headers({ "accept-language": "en-US,en;q=0.9" });

    expect(await getRequestLocale()).toBe("vi");
  });

  it("falls back to Accept-Language without a cookie", async () => {
    request.headers = new Headers({ "accept-language": "vi-VN,vi;q=0.9" });

    expect(await getRequestLocale()).toBe("vi");
  });

  it("falls back to en without a cookie or a matching header", async () => {
    request.headers = new Headers({ "accept-language": "fr-FR,de;q=0.8" });

    expect(await getRequestLocale()).toBe("en");
  });
});

describe("getRequestThemePreference", () => {
  it("reads the theme preference from the sf-theme cookie", async () => {
    request.cookies = new Map([["sf-theme", "dark"]]);

    expect(await getRequestThemePreference()).toBe("dark");
  });
});

describe("getRequestNonce", () => {
  it("returns null when the nonce header is missing", async () => {
    expect(await getRequestNonce()).toBeNull();
  });
});
