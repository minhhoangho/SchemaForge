import { readFileSync } from "node:fs";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@schemaforge/api-contract";
import type { Result } from "@schemaforge/core";

export type PasswordViolation = "too-short" | "too-long" | "too-common";

const COMMON_PASSWORDS_FILE = new URL(
  "./common-passwords.txt",
  import.meta.url,
);
const COMMENT_PREFIX = "#";
const MAX_BMP_CODE_POINT = 0xffff;
// NFKC can expand one code point into up to 18 (U+FDFA), so normalizing an unbounded
// string blocks the event loop. Four UTF-16 units per allowed code point still admits a
// maximum-length password typed with combining marks or characters outside the BMP.
const RAW_UTF16_UNITS_PER_CODE_POINT = 4;
export const MAX_RAW_PASSWORD_UTF16_LENGTH =
  PASSWORD_MAX_LENGTH * RAW_UTF16_UNITS_PER_CODE_POINT;
// OWASP ASVS 5.0 level 1 requires checking at least 3000 common passwords (spec section 2).
export const COMMON_PASSWORDS_MIN_ENTRIES = 3000;

export function normalizePassword(password: string): string {
  return password.normalize("NFKC");
}

/** Counts code points, stopping at `limit + 1` so long input is not walked to the end. */
export function countCodePoints(
  text: string,
  limit: number = Number.POSITIVE_INFINITY,
): number {
  let count = 0;
  let index = 0;
  while (index < text.length && count <= limit) {
    const codePoint = text.codePointAt(index) ?? 0;
    // A surrogate pair is one code point; a lone surrogate counts as one, like string iteration.
    index += codePoint > MAX_BMP_CODE_POINT ? 2 : 1;
    count += 1;
  }
  return count;
}

/** Returns the NFKC-normalized password when it satisfies the policy of spec section 2. */
export function checkPassword(
  password: string,
  commonPasswords: ReadonlySet<string>,
): Result<string, PasswordViolation> {
  if (password.length > MAX_RAW_PASSWORD_UTF16_LENGTH) {
    return { isOk: false, error: "too-long" };
  }
  const normalized = normalizePassword(password);
  const length = countCodePoints(normalized, PASSWORD_MAX_LENGTH);
  if (length < PASSWORD_MIN_LENGTH) {
    return { isOk: false, error: "too-short" };
  }
  if (length > PASSWORD_MAX_LENGTH) {
    return { isOk: false, error: "too-long" };
  }
  if (commonPasswords.has(normalized.toLowerCase())) {
    return { isOk: false, error: "too-common" };
  }
  return { isOk: true, value: normalized };
}

export function parseCommonPasswords(text: string): ReadonlySet<string> {
  const entries = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith(COMMENT_PREFIX))
    .map((line) => line.toLowerCase());
  return new Set(entries);
}

/** Fails closed when the bundled list is truncated or empty. */
export function assertCommonPasswordsComplete(
  commonPasswords: ReadonlySet<string>,
): ReadonlySet<string> {
  if (commonPasswords.size < COMMON_PASSWORDS_MIN_ENTRIES) {
    throw new Error(
      `Common passwords list has ${String(commonPasswords.size)} entries; expected at least ${String(COMMON_PASSWORDS_MIN_ENTRIES)}`,
    );
  }
  return commonPasswords;
}

/** Reads the bundled list synchronously; call once at startup. */
export function loadCommonPasswords(): ReadonlySet<string> {
  return assertCommonPasswordsComplete(
    parseCommonPasswords(readFileSync(COMMON_PASSWORDS_FILE, "utf8")),
  );
}
