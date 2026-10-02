import { describe, expect, it } from "vitest";

import type { NameComparison } from "./name-allocator.js";
import {
  createNameAllocator,
  toComparisonKey,
  truncateToUtf8Bytes,
} from "./name-allocator.js";

const CODE_OPTIONS = {
  reserved: [],
  comparison: "exact",
  separator: "",
  maxBytes: null,
} as const;

describe("createNameAllocator", () => {
  it("returns the preferred name when it is free", () => {
    const allocator = createNameAllocator(CODE_OPTIONS);

    expect(allocator.allocate("OrderItems")).toBe("OrderItems");
  });

  it("appends 2, then 3 to repeated names", () => {
    const allocator = createNameAllocator(CODE_OPTIONS);

    expect([
      allocator.allocate("OrderItems"),
      allocator.allocate("OrderItems"),
      allocator.allocate("OrderItems"),
    ]).toStrictEqual(["OrderItems", "OrderItems2", "OrderItems3"]);
  });

  it("treats names differing only in case as taken when case-insensitive", () => {
    const allocator = createNameAllocator({
      ...CODE_OPTIONS,
      comparison: "caseInsensitive",
    });

    expect([
      allocator.allocate("users"),
      allocator.allocate("Users"),
    ]).toStrictEqual(["users", "Users2"]);
  });

  it("allows names differing only in case when comparison is exact", () => {
    const allocator = createNameAllocator(CODE_OPTIONS);

    expect([
      allocator.allocate("users"),
      allocator.allocate("Users"),
    ]).toStrictEqual(["users", "Users"]);
  });

  it("treats names differing only by an accent as taken when case and accent insensitive", () => {
    const allocator = createNameAllocator({
      ...CODE_OPTIONS,
      comparison: "caseAndAccentInsensitive",
      separator: "_",
    });

    expect([
      allocator.allocate("t_ma_key"),
      allocator.allocate("t_Má_key"),
    ]).toStrictEqual(["t_ma_key", "t_Má_key_2"]);
  });

  it.each([
    ["đa", "da"],
    ["Øl", "ol"],
    ["łza", "lza"],
    ["ħal", "hal"],
  ])(
    "folds đ, ø, ł and ħ when case and accent insensitive (%s, %s)",
    (first, second) => {
      const allocator = createNameAllocator({
        ...CODE_OPTIONS,
        comparison: "caseAndAccentInsensitive",
      });

      expect([
        allocator.allocate(first),
        allocator.allocate(second),
      ]).toStrictEqual([first, `${second}2`]);
    },
  );

  it("never returns a reserved name", () => {
    const allocator = createNameAllocator({
      ...CODE_OPTIONS,
      reserved: ["PrismaClient", "PrismaClient2"],
    });

    expect(allocator.allocate("PrismaClient")).toBe("PrismaClient3");
  });

  it("uses the separator before the number", () => {
    const allocator = createNameAllocator({
      ...CODE_OPTIONS,
      separator: "-",
    });

    expect([
      allocator.allocate("users"),
      allocator.allocate("users"),
    ]).toStrictEqual(["users", "users-2"]);
  });

  it("truncates the base so the suffixed name fits the byte limit", () => {
    const allocator = createNameAllocator({
      ...CODE_OPTIONS,
      separator: "_",
      maxBytes: 6,
    });

    expect([
      allocator.allocate("abcdef"),
      allocator.allocate("abcdef"),
    ]).toStrictEqual(["abcdef", "abcd_2"]);
  });

  it("does not split a surrogate pair when truncating", () => {
    const allocator = createNameAllocator({
      ...CODE_OPTIONS,
      separator: "_",
      maxBytes: 7,
    });

    expect([
      allocator.allocate("ab😀"),
      allocator.allocate("ab😀"),
    ]).toStrictEqual(["ab😀", "ab_2"]);
  });

  it("keeps separate state for separate allocators", () => {
    const first = createNameAllocator(CODE_OPTIONS);
    const second = createNameAllocator(CODE_OPTIONS);
    first.allocate("users");

    expect(second.allocate("users")).toBe("users");
  });
});

describe("toComparisonKey", () => {
  it.each<[NameComparison, string, string]>([
    ["exact", "Người Dùng", "Người Dùng"],
    ["caseInsensitive", "Người Dùng", "người dùng"],
    ["caseAndAccentInsensitive", "Người Dùng", "nguoi dung"],
    ["caseAndAccentInsensitive", "ĐØŁĦ", "dolh"],
  ])(
    "builds comparison keys for each comparison (%s, %s)",
    (comparison, name, key) => {
      expect(toComparisonKey(name, comparison)).toBe(key);
    },
  );
});

describe("truncateToUtf8Bytes", () => {
  it.each([
    ["abc", 5, "abc"],
    ["abcdef", 3, "abc"],
    ["aé", 2, "a"],
    ["a😀b", 4, "a"],
    ["a😀b", 5, "a😀"],
    ["abc", 0, ""],
  ])(
    "keeps the longest prefix within the byte limit (%s, %i)",
    (text, maxBytes, prefix) => {
      expect(truncateToUtf8Bytes(text, maxBytes)).toBe(prefix);
    },
  );
});
