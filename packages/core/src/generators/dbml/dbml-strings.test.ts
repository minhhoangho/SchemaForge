import { describe, expect, it } from "vitest";

import { dbmlString, quoteDbmlIdentifier } from "./dbml-strings.js";

describe("quoteDbmlIdentifier", () => {
  it.each<[string, string]>([
    ["users", '"users"'],
    ["người dùng", '"người dùng"'],
    ['say "hi"', '"say \\"hi\\""'],
    ["a\\b", '"a\\\\b"'],
    ['\\"', '"\\\\\\""'],
    ["it's", '"it\'s"'],
    ["", '""'],
  ])(
    "quotes identifiers and escapes double quotes and backslashes (%j)",
    (name, expected) => {
      expect(quoteDbmlIdentifier(name)).toBe(expected);
    },
  );
});

describe("dbmlString", () => {
  it.each<[string, string]>([
    ["hello", "'hello'"],
    ["it's", "'it\\'s'"],
    ["a\\b", "'a\\\\b'"],
    ['say "hi"', "'say \"hi\"'"],
    ["", "''"],
  ])(
    "writes single-line strings in single quotes with escapes (%j)",
    (text, expected) => {
      expect(dbmlString(text)).toBe(expected);
    },
  );

  it.each<[string, string]>([
    ["line one\nline two", "'''line one\nline two'''"],
    ["a\r\nb", "'''a\r\nb'''"],
    ["a\rb", "'''a\rb'''"],
    ["a'''b\nc", "'''a\\'\\'\\'b\nc'''"],
    ["a\nb\\", "'''a\nb\\\\'''"],
  ])(
    "writes multi-line strings in triple quotes and escapes a triple quote (%j)",
    (text, expected) => {
      expect(dbmlString(text)).toBe(expected);
    },
  );

  it.each<[string, string]>([
    ["a\nb'", "'''a\nb\\''''"],
    ["a\nb''", "'''a\nb\\'\\''''"],
  ])(
    "escapes every single quote in triple quotes so a trailing quote cannot close the string (%j)",
    (text, expected) => {
      expect(dbmlString(text)).toBe(expected);
    },
  );
});
