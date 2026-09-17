import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@schemaforge/api-contract";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertCommonPasswordsComplete,
  checkPassword,
  COMMON_PASSWORDS_MIN_ENTRIES,
  countCodePoints,
  loadCommonPasswords,
  MAX_RAW_PASSWORD_UTF16_LENGTH,
  normalizePassword,
  parseCommonPasswords,
} from "./password.policy.js";

// U+FDFA ARABIC LIGATURE SALLALLAHOU ALAYHE WASALLAM: NFKC expands it to 18 code points.
const MAXIMUM_EXPANSION_LIGATURE = String.fromCodePoint(0xfdfa);
const COMBINING_ACUTE_ACCENT = String.fromCodePoint(0x301);

afterEach(() => {
  vi.restoreAllMocks();
});

const NO_COMMON_PASSWORDS: ReadonlySet<string> = new Set();
const COMMON_PASSWORDS: ReadonlySet<string> = new Set(["password"]);

// U+FB01 LATIN SMALL LIGATURE FI: one code point that NFKC expands to "fi".
const LIGATURE_FI = "ﬁ";
// U+2126 OHM SIGN: NFKC maps it to U+03A9 GREEK CAPITAL LETTER OMEGA.
const OHM_SIGN = "Ω";
const GREEK_OMEGA = "Ω";

describe("normalizePassword", () => {
  it("normalizes a password to NFKC", () => {
    expect(normalizePassword(`${LIGATURE_FI}${OHM_SIGN}`)).toBe(
      `fi${GREEK_OMEGA}`,
    );
  });

  it("composes Vietnamese letters typed with combining marks", () => {
    // "mật" with a precomposed U+1EAD versus "a" + dot below + circumflex.
    const precomposed = "mật";
    const combining = "mật";

    expect(normalizePassword(combining)).toBe(normalizePassword(precomposed));
  });
});

describe("countCodePoints", () => {
  it.each([
    { label: "ASCII", text: "abcdefgh", expected: 8 },
    { label: "precomposed Vietnamese", text: "mật khẩu", expected: 8 },
    { label: "emoji outside the BMP", text: "a\u{1F600}b", expected: 3 },
  ])("counts length in code points ($label)", ({ text, expected }) => {
    expect(countCodePoints(text)).toBe(expected);
  });

  it("counts a lone surrogate as one code point", () => {
    expect(countCodePoints(`a${String.fromCharCode(0xd800)}b`)).toBe(3);
  });

  it("stops counting one code point past the limit", () => {
    expect(countCodePoints("abcdefgh", 2)).toBe(3);
  });

  it("returns the exact count when the text is within the limit", () => {
    expect(countCodePoints("abc", 5)).toBe(3);
  });
});

describe("checkPassword", () => {
  it("rejects a password shorter than the minimum after normalization", () => {
    // Seven letters plus a combining acute accent: 8 code points that NFKC composes into 7.
    const password = "abcdefé";

    expect(countCodePoints(password)).toBe(PASSWORD_MIN_LENGTH);
    expect(checkPassword(password, NO_COMMON_PASSWORDS)).toEqual({
      isOk: false,
      error: "too-short",
    });
  });

  it("accepts a password of exactly the minimum length", () => {
    const password = "x".repeat(PASSWORD_MIN_LENGTH);

    expect(checkPassword(password, NO_COMMON_PASSWORDS)).toEqual({
      isOk: true,
      value: password,
    });
  });

  it("accepts a password of exactly the maximum length", () => {
    const password = "\u{1F600}".repeat(PASSWORD_MAX_LENGTH);

    expect(checkPassword(password, NO_COMMON_PASSWORDS)).toEqual({
      isOk: true,
      value: password,
    });
  });

  it("rejects a password longer than the maximum", () => {
    const password = "x".repeat(PASSWORD_MAX_LENGTH + 1);

    expect(checkPassword(password, NO_COMMON_PASSWORDS)).toEqual({
      isOk: false,
      error: "too-long",
    });
  });

  it("sets the raw length cap to four UTF-16 units per allowed code point", () => {
    expect(MAX_RAW_PASSWORD_UTF16_LENGTH).toBe(PASSWORD_MAX_LENGTH * 4);
  });

  it("rejects raw input over the cap as too long without normalizing it", () => {
    const normalizeSpy = vi.spyOn(String.prototype, "normalize");
    const password = MAXIMUM_EXPANSION_LIGATURE.repeat(
      MAX_RAW_PASSWORD_UTF16_LENGTH + 1,
    );

    expect(checkPassword(password, NO_COMMON_PASSWORDS)).toEqual({
      isOk: false,
      error: "too-long",
    });
    expect(normalizeSpy).not.toHaveBeenCalled();
  });

  it("accepts a maximum-length password typed with combining marks", () => {
    const password = `e${COMBINING_ACUTE_ACCENT}`.repeat(PASSWORD_MAX_LENGTH);

    expect(checkPassword(password, NO_COMMON_PASSWORDS)).toEqual({
      isOk: true,
      value: password.normalize("NFKC"),
    });
  });

  it("keeps leading and trailing spaces", () => {
    const password = "  abcdefgh  ";

    expect(checkPassword(password, NO_COMMON_PASSWORDS)).toEqual({
      isOk: true,
      value: password,
    });
  });

  it.each(["password", "PASSWORD", "PassWord"])(
    "rejects a common password regardless of case: %s",
    (password) => {
      expect(checkPassword(password, COMMON_PASSWORDS)).toEqual({
        isOk: false,
        error: "too-common",
      });
    },
  );

  it("returns the normalized password when the password is allowed", () => {
    expect(
      checkPassword(`${LIGATURE_FI}${OHM_SIGN}secret99`, COMMON_PASSWORDS),
    ).toEqual({
      isOk: true,
      value: `fi${GREEK_OMEGA}secret99`,
    });
  });
});

describe("parseCommonPasswords", () => {
  it("parses common passwords ignoring blank lines, comments and CRLF", () => {
    const text =
      "# Source: test\r\n\r\nPassword\r\n  qwerty123  \n\n#comment\nletmein\n";

    expect(parseCommonPasswords(text)).toEqual(
      new Set(["password", "qwerty123", "letmein"]),
    );
  });
});

describe("assertCommonPasswordsComplete", () => {
  it("throws when the list has fewer entries than required", () => {
    const truncated = parseCommonPasswords("# header only\npassword\n");

    expect(() => assertCommonPasswordsComplete(truncated)).toThrow(
      /common passwords/i,
    );
  });

  it("throws when the list is empty", () => {
    expect(() =>
      assertCommonPasswordsComplete(parseCommonPasswords("")),
    ).toThrow(/common passwords/i);
  });

  it("returns the list when it has the required number of entries", () => {
    const text = Array.from(
      { length: COMMON_PASSWORDS_MIN_ENTRIES },
      (_, index) => `entry-${String(index)}`,
    ).join("\n");
    const complete = parseCommonPasswords(text);

    expect(assertCommonPasswordsComplete(complete)).toBe(complete);
  });
});

describe("loadCommonPasswords", () => {
  const bundledPasswords = loadCommonPasswords();

  it("loads the bundled list with 3000 entries including password and 12345678", () => {
    expect(bundledPasswords.size).toBe(3000);
    expect(bundledPasswords.has("password")).toBe(true);
    expect(bundledPasswords.has("12345678")).toBe(true);
  });

  it("keeps only entries whose length is within the password limits", () => {
    const outOfRange = Array.from(bundledPasswords).filter(
      (entry) =>
        countCodePoints(entry) < PASSWORD_MIN_LENGTH ||
        countCodePoints(entry) > PASSWORD_MAX_LENGTH,
    );

    expect(outOfRange).toEqual([]);
  });

  it("stores every entry in the normalized lowercase form the policy compares", () => {
    const notNormalized = Array.from(bundledPasswords).filter(
      (entry) => normalizePassword(entry).toLowerCase() !== entry,
    );

    expect(notNormalized).toEqual([]);
  });

  it.each(["password", "12345678", "Baseball"])(
    "rejects %s from the bundled list as too common",
    (password) => {
      expect(checkPassword(password, bundledPasswords)).toEqual({
        isOk: false,
        error: "too-common",
      });
    },
  );
});
