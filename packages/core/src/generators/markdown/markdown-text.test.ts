import { describe, expect, it } from "vitest";

import { escapeMarkdownText, formatMarkdownInline } from "./markdown-text.js";

describe("escapeMarkdownText", () => {
  it.each<[string, string]>([
    ["\\", "\\\\"],
    ["`", "\\`"],
    ["*", "\\*"],
    ["_", "\\_"],
    ["{", "\\{"],
    ["}", "\\}"],
    ["[", "\\["],
    ["]", "\\]"],
    ["(", "\\("],
    [")", "\\)"],
    ["#", "\\#"],
    ["+", "\\+"],
    ["-", "\\-"],
    [".", "\\."],
    ["!", "\\!"],
    ["|", "\\|"],
    ["<", "\\<"],
    [">", "\\>"],
    ["~", "\\~"],
  ])("escapes every markdown special character (%j)", (text, expected) => {
    expect(escapeMarkdownText(text)).toBe(expected);
  });

  it("keeps letters, digits, spaces and Vietnamese text", () => {
    expect(escapeMarkdownText("Người dùng 123 abc XYZ")).toBe(
      "Người dùng 123 abc XYZ",
    );
  });

  it("escapes each special character inside a longer text", () => {
    expect(escapeMarkdownText("order_items.id|[x]")).toBe(
      "order\\_items\\.id\\|\\[x\\]",
    );
  });
});

describe("formatMarkdownInline", () => {
  it.each<[string, string]>([
    ["a\nb", "a<br>b"],
    ["a\r\nb", "a<br>b"],
    ["a\rb", "a<br>b"],
    ["a\n\nb", "a<br><br>b"],
    ["x_1\ny|z", "x\\_1<br>y\\|z"],
  ])("turns line breaks into <br> after escaping (%j)", (text, expected) => {
    expect(formatMarkdownInline(text)).toBe(expected);
  });
});
