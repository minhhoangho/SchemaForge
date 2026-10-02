import { describe, expect, it } from "vitest";

import { BASE64_PATTERN } from "../shared/json-representation.js";
import {
  createSeedRandom,
  createTableSeedRandom,
  encodeBase64,
  formatSeedDate,
  formatSeedTime,
  formatUuidV4,
} from "./seed-random.js";

const SAMPLE_COUNT = 5;

function takeUint32(
  random: ReturnType<typeof createSeedRandom>,
): readonly number[] {
  return Array.from({ length: SAMPLE_COUNT }, () => random.nextUint32());
}

describe("createSeedRandom", () => {
  it("returns the same sequence for the same state", () => {
    expect(takeUint32(createSeedRandom(42))).toStrictEqual(
      takeUint32(createSeedRandom(42)),
    );
  });

  // Computed once with the reference mulberry32 implementation, outside core.
  it("matches the first mulberry32 outputs for state 1", () => {
    expect(takeUint32(createSeedRandom(1))).toStrictEqual([
      2693262067, 11749833, 2265367787, 4213581821, 4159151403,
    ]);
  });

  it("returns integers below the bound from nextInt", () => {
    const random = createSeedRandom(7);
    const values = Array.from({ length: 100 }, () => random.nextInt(3));
    expect(values.every((value) => value >= 0 && value < 3)).toBe(true);
  });

  it.each([0, -1, 1.5])("throws RangeError for nextInt of %s", (bound) => {
    expect(() => createSeedRandom(1).nextInt(bound)).toThrow(RangeError);
  });
});

describe("createTableSeedRandom", () => {
  it("returns the same sequence for the same seed and table name", () => {
    expect(takeUint32(createTableSeedRandom(1, "users"))).toStrictEqual(
      takeUint32(createTableSeedRandom(1, "users")),
    );
  });

  it("returns different sequences for different table names", () => {
    expect(takeUint32(createTableSeedRandom(1, "users"))).not.toStrictEqual(
      takeUint32(createTableSeedRandom(1, "orders")),
    );
  });

  it("returns different sequences for different seeds", () => {
    expect(takeUint32(createTableSeedRandom(1, "users"))).not.toStrictEqual(
      takeUint32(createTableSeedRandom(2, "users")),
    );
  });
});

describe("formatSeedDate", () => {
  it.each([
    [0, "2026-01-01"],
    [31, "2026-02-01"],
    [58, "2026-02-28"],
    [59, "2026-03-01"],
    [364, "2026-12-31"],
  ])("formats day offset %i as %s", (dayOffset, expected) => {
    expect(formatSeedDate(dayOffset)).toBe(expected);
  });

  it.each([-1, 365, 1.5])("throws RangeError for day offset %s", (offset) => {
    expect(() => formatSeedDate(offset)).toThrow(RangeError);
  });
});

describe("formatSeedTime", () => {
  it.each([
    [0, "00:00:00"],
    [3661, "01:01:01"],
    [86399, "23:59:59"],
  ])("formats second %i of the day as %s", (second, expected) => {
    expect(formatSeedTime(second)).toBe(expected);
  });

  it.each([-1, 86400, 0.5])("throws RangeError for second %s", (second) => {
    expect(() => formatSeedTime(second)).toThrow(RangeError);
  });
});

describe("encodeBase64", () => {
  // RFC 4648 test vectors for "", "f", "fo", "foo", "foob".
  it.each([
    [[], ""],
    [[0x66], "Zg=="],
    [[0x66, 0x6f], "Zm8="],
    [[0x66, 0x6f, 0x6f], "Zm9v"],
    [[0x66, 0x6f, 0x6f, 0x62], "Zm9vYg=="],
  ])("encodes %j as %s", (bytes, expected) => {
    expect(encodeBase64(bytes)).toBe(expected);
  });

  it("produces text that matches the base64 pattern for high bytes", () => {
    expect(encodeBase64([0xff, 0xfe, 0xfd, 0xfc])).toMatch(
      new RegExp(BASE64_PATTERN),
    );
  });
});

describe("formatUuidV4", () => {
  it("formats a version 4 uuid with the variant bits", () => {
    expect(formatUuidV4(Array.from({ length: 16 }, () => 0xff))).toBe(
      "ffffffff-ffff-4fff-bfff-ffffffffffff",
    );
  });

  it("sets the version and variant on zero bytes", () => {
    expect(formatUuidV4(Array.from({ length: 16 }, () => 0))).toBe(
      "00000000-0000-4000-8000-000000000000",
    );
  });

  it("throws RangeError for a byte count other than 16", () => {
    expect(() => formatUuidV4([1, 2, 3])).toThrow(RangeError);
  });
});
