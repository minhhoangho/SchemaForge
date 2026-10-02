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

  it("allows names differing only by an accent when case-insensitive", () => {
    const allocator = createNameAllocator({
      ...CODE_OPTIONS,
      comparison: "caseInsensitive",
    });

    expect([allocator.allocate("ma"), allocator.allocate("Má")]).toStrictEqual([
      "ma",
      "Má",
    ]);
  });

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
    ["caseInsensitive", "ĐØŁĦ", "đøłħ"],
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
