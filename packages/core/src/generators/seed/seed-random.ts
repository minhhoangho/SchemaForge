import { fnv1a32Hex } from "../shared/constraint-names.js";

export type SeedRandom = {
  readonly nextUint32: () => number;
  readonly nextInt: (maxExclusive: number) => number;
};

const MULBERRY32_INCREMENT = 0x6d2b79f5;
const HEX_RADIX = 16;

/** mulberry32: a small, pure 32-bit PRNG; its state lives in the closure. */
export function createSeedRandom(state: number): SeedRandom {
  let current = state | 0;
  const nextUint32 = (): number => {
    current = (current + MULBERRY32_INCREMENT) | 0;
    let mixed = Math.imul(current ^ (current >>> 15), current | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return (mixed ^ (mixed >>> 14)) >>> 0;
  };
  const nextInt = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) {
      throw new RangeError(
        `nextInt needs a positive integer bound, got ${String(maxExclusive)}`,
      );
    }
    return nextUint32() % maxExclusive;
  };
  return { nextUint32, nextInt };
}

/** One stream per table, so adding or removing a table leaves the others' data alone. */
export function createTableSeedRandom(
  seed: number,
  tableName: string,
): SeedRandom {
  return createSeedRandom(
    (seed ^ Number.parseInt(fnv1a32Hex(tableName), HEX_RADIX)) >>> 0,
  );
}

// 2026 is not a leap year; dates are counted from 2026-01-01 without `Date`.
const SEED_YEAR = "2026";
const DAYS_IN_MONTH_2026 = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DAYS_IN_YEAR = 365;
const SECONDS_IN_DAY = 86_400;
const SECONDS_IN_HOUR = 3600;
const SECONDS_IN_MINUTE = 60;

function assertIntegerInRange(
  value: number,
  maxExclusive: number,
  label: string,
): void {
  if (!Number.isInteger(value) || value < 0 || value >= maxExclusive) {
    throw new RangeError(`${label} out of range: ${String(value)}`);
  }
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatSeedDate(dayOffset: number): string {
  assertIntegerInRange(dayOffset, DAYS_IN_YEAR, "Day offset");
  let remaining = dayOffset;
  let monthIndex = 0;
  for (const days of DAYS_IN_MONTH_2026) {
    if (remaining < days) {
      break;
    }
    remaining -= days;
    monthIndex += 1;
  }
  return `${SEED_YEAR}-${padTwo(monthIndex + 1)}-${padTwo(remaining + 1)}`;
}

export function formatSeedTime(secondOfDay: number): string {
  assertIntegerInRange(secondOfDay, SECONDS_IN_DAY, "Second of day");
  const hours = Math.floor(secondOfDay / SECONDS_IN_HOUR);
  const minutes = Math.floor(
    (secondOfDay % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE,
  );
  const seconds = secondOfDay % SECONDS_IN_MINUTE;
  return `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
}

const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_PADDING = "=";
const BYTES_PER_GROUP = 3;
const SEXTET_MASK = 0x3f;

function encodeGroup(group: readonly number[]): string {
  const [first = 0, second = 0, third = 0] = group;
  const bits = (first << 16) | (second << 8) | third;
  const characters = [18, 12, 6, 0].map((shift) =>
    BASE64_ALPHABET.charAt((bits >>> shift) & SEXTET_MASK),
  );
  const paddingCount = BYTES_PER_GROUP - group.length;
  return (
    characters.slice(0, characters.length - paddingCount).join("") +
    BASE64_PADDING.repeat(paddingCount)
  );
}

/** Standard base64 with "=" padding (RFC 4648), without `btoa` or `Buffer`. */
export function encodeBase64(bytes: readonly number[]): string {
  const groups: string[] = [];
  for (let start = 0; start < bytes.length; start += BYTES_PER_GROUP) {
    groups.push(encodeGroup(bytes.slice(start, start + BYTES_PER_GROUP)));
  }
  return groups.join("");
}

const UUID_BYTE_COUNT = 16;
const VERSION_BYTE = 6;
const VARIANT_BYTE = 8;
const UUID_GROUP_ENDS = [4, 6, 8, 10, 16];

/** A version 4 uuid: version nibble 4 and RFC 9562 variant bits 10. */
export function formatUuidV4(bytes: readonly number[]): string {
  if (bytes.length !== UUID_BYTE_COUNT) {
    throw new RangeError(`A uuid needs 16 bytes, got ${String(bytes.length)}`);
  }
  const hex = bytes.map((byte, index) => {
    if (index === VERSION_BYTE) {
      return (byte & 0x0f) | 0x40;
    }
    return index === VARIANT_BYTE ? (byte & 0x3f) | 0x80 : byte & 0xff;
  });
  const groups = UUID_GROUP_ENDS.map((end, groupIndex) =>
    hex
      .slice(UUID_GROUP_ENDS[groupIndex - 1] ?? 0, end)
      .map((byte) => byte.toString(HEX_RADIX).padStart(2, "0"))
      .join(""),
  );
  return groups.join("-");
}
