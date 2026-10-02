import { describe, expect, it } from "vitest";

import type { SqlDialect } from "./generator-types.js";
import {
  formatJsDocLines,
  formatPropertyKey,
  quoteSqlIdentifier,
  toAsciiWords,
  toCamelCaseIdentifier,
  toKebabCaseSegment,
  toPascalCaseIdentifier,
  withReservedWordSuffix,
} from "./identifiers.js";

describe("quoteSqlIdentifier", () => {
  it.each<[SqlDialect, string, string]>([
    ["postgresql", "order", '"order"'],
    ["mysql", "order", "`order`"],
    ["sqlserver", "order", "[order]"],
    ["postgresql", 'a"b', '"a""b"'],
    ["mysql", "a`b", "`a``b`"],
    ["sqlserver", "a]b", "[a]]b]"],
    ["sqlserver", "a[b", "[a[b]"],
    ["postgresql", "người dùng", '"người dùng"'],
    ["mysql", "người dùng", "`người dùng`"],
    ["sqlserver", "người dùng", "[người dùng]"],
  ])(
    "quotes identifiers for each dialect (%s, %s)",
    (dialect, name, quoted) => {
      expect(quoteSqlIdentifier(dialect, name)).toBe(quoted);
    },
  );
});

describe("toAsciiWords", () => {
  it.each<[string, readonly string[]]>([
    ["người dùng", ["nguoi", "dung"]],
    ["Đường đi", ["Duong", "di"]],
    ["USER_ID", ["user", "id"]],
    ["createdAt", ["createdAt"]],
    ["用户", []],
    ["2fa codes", ["2fa", "codes"]],
    ["2FA", ["2fa"]],
    ["a--b  c", ["a", "b", "c"]],
  ])("splits names into ascii words (%s)", (name, words) => {
    expect(toAsciiWords(name)).toStrictEqual(words);
  });
});

describe("toPascalCaseIdentifier and toCamelCaseIdentifier", () => {
  it.each([
    ["người dùng", "NguoiDung", "nguoiDung"],
    ["order", "Order", "order"],
    ["2fa codes", "Table2faCodes", "field2faCodes"],
    ["USER_ID", "UserId", "userId"],
    ["用户", "Table", "field"],
    ["order items", "OrderItems", "orderItems"],
    ["order_items", "OrderItems", "orderItems"],
    ["author_id", "AuthorId", "authorId"],
    ["createdAt", "CreatedAt", "createdAt"],
  ])(
    "maps the examples of spec section 5 to PascalCase and camelCase (%s)",
    (name, pascalCase, camelCase) => {
      expect([
        toPascalCaseIdentifier(name, "Table"),
        toCamelCaseIdentifier(name, "field"),
      ]).toStrictEqual([pascalCase, camelCase]);
    },
  );
});

describe("toKebabCaseSegment", () => {
  it.each([
    ["người dùng", "nguoi-dung"],
    ["USER_ID", "user-id"],
    ["createdAt", "createdat"],
    ["用户", "resource"],
  ])("maps names to kebab-case path segments (%s)", (name, segment) => {
    expect(toKebabCaseSegment(name, "resource")).toBe(segment);
  });
});

describe("withReservedWordSuffix", () => {
  it("appends an underscore to a reserved word", () => {
    expect(withReservedWordSuffix("class", ["class", "default"])).toBe(
      "class_",
    );
  });

  it("keeps an identifier that is not reserved", () => {
    expect(withReservedWordSuffix("Class", ["class", "default"])).toBe("Class");
  });
});

describe("formatPropertyKey", () => {
  it.each([
    ["USER_ID", "USER_ID"],
    ["$ref", "$ref"],
    ["họ tên", '"họ tên"'],
    ["2fa", '"2fa"'],
    ['a"b', '"a\\"b"'],
    ["__proto__", '["__proto__"]'],
  ])("formats property keys (%s)", (name, key) => {
    expect(formatPropertyKey(name)).toBe(key);
  });
});

describe("formatJsDocLines", () => {
  it("formats a one-line JSDoc comment", () => {
    expect(formatJsDocLines("User id", "  ")).toStrictEqual([
      "  /** User id */",
    ]);
  });

  it("formats a multi-line JSDoc comment", () => {
    expect(formatJsDocLines("first\r\n\rthird\nfourth", "  ")).toStrictEqual([
      "  /**",
      "   * first",
      "   *",
      "   * third",
      "   * fourth",
      "   */",
    ]);
  });

  it("escapes a comment terminator inside JSDoc", () => {
    expect(formatJsDocLines("a */ b */", "")).toStrictEqual([
      "/** a *\\/ b *\\/ */",
    ]);
  });

  it("returns no lines for an empty comment", () => {
    expect(formatJsDocLines("", "  ")).toStrictEqual([]);
  });
});
