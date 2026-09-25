import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@schemaforge/api-contract";
import { describe, expect, it } from "vitest";

import { validateCredentials } from "./validate-credentials";

const VALID_EMAIL = "user@example.com";
const VALID_PASSWORD = "stapler-42";

// Pads the local part so the whole address has exactly `length` characters.
function emailOfLength(length: number): string {
  const domain = "@example.com";
  return `${"a".repeat(length - domain.length)}${domain}`;
}

describe("validateCredentials", () => {
  it.each([
    ["an empty email", "", [{ field: "email", code: "required" }]],
    ["a blank email", "   ", [{ field: "email", code: "required" }]],
    [
      "a too long email",
      emailOfLength(EMAIL_MAX_LENGTH + 1),
      [{ field: "email", code: "too-long" }],
    ],
    [
      "an email without @",
      "user.example.com",
      [{ field: "email", code: "invalid" }],
    ],
    [
      "an email without a domain",
      "user@",
      [{ field: "email", code: "invalid" }],
    ],
    ["a valid email", VALID_EMAIL, []],
    ["an email of the maximum length", emailOfLength(EMAIL_MAX_LENGTH), []],
    ["a valid email with surrounding spaces", `  ${VALID_EMAIL} `, []],
  ])("reports %s", (_case, email, expected) => {
    expect(validateCredentials({ email, password: VALID_PASSWORD })).toEqual(
      expected,
    );
  });

  it("measures password length after NFKC normalization", () => {
    // Each "ﬀ" ligature is one code point that NFKC expands into "ff", so four
    // of them reach the minimum only once normalized.
    const password = "ﬀ".repeat(PASSWORD_MIN_LENGTH / 2);

    expect(validateCredentials({ email: VALID_EMAIL, password })).toEqual([]);
  });

  it("counts code points rather than UTF-16 units", () => {
    // Each emoji is two UTF-16 units but one code point.
    const password = "😀".repeat(PASSWORD_MIN_LENGTH - 1);

    expect(validateCredentials({ email: VALID_EMAIL, password })).toEqual([
      { field: "password", code: "too-short" },
    ]);
  });

  it.each([
    [
      "shorter than the minimum",
      "a".repeat(PASSWORD_MIN_LENGTH - 1),
      [{ field: "password", code: "too-short" }],
    ],
    [
      "longer than the maximum",
      "a".repeat(PASSWORD_MAX_LENGTH + 1),
      [{ field: "password", code: "too-long" }],
    ],
    ["exactly the minimum", "a".repeat(PASSWORD_MIN_LENGTH), []],
    ["exactly the maximum", "a".repeat(PASSWORD_MAX_LENGTH), []],
  ])("reports a password %s", (_case, password, expected) => {
    expect(validateCredentials({ email: VALID_EMAIL, password })).toEqual(
      expected,
    );
  });

  it("reports the email error before the password error", () => {
    expect(validateCredentials({ email: "", password: "" })).toEqual([
      { field: "email", code: "required" },
      { field: "password", code: "too-short" },
    ]);
  });
});
