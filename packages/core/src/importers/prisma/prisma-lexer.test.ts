import { describe, expect, it } from "vitest";
import { unwrapError, unwrapOk } from "../../testing/unwrap-result.js";
import { tokenizePrisma } from "./prisma-lexer.js";

describe("tokenizePrisma", () => {
  it("tokenizes identifiers, strings, numbers and symbols with positions", () => {
    expect(
      unwrapOk(tokenizePrisma('a_1 "x" -2.5 { } ( ) [ ] , : = ? @ @@ .\nb')),
    ).toStrictEqual([
      { kind: "identifier", text: "a_1", position: { line: 1, column: 1 } },
      { kind: "string", text: "x", position: { line: 1, column: 5 } },
      { kind: "number", text: "-2.5", position: { line: 1, column: 9 } },
      { kind: "symbol", text: "{", position: { line: 1, column: 14 } },
      { kind: "symbol", text: "}", position: { line: 1, column: 16 } },
      { kind: "symbol", text: "(", position: { line: 1, column: 18 } },
      { kind: "symbol", text: ")", position: { line: 1, column: 20 } },
      { kind: "symbol", text: "[", position: { line: 1, column: 22 } },
      { kind: "symbol", text: "]", position: { line: 1, column: 24 } },
      { kind: "symbol", text: ",", position: { line: 1, column: 26 } },
      { kind: "symbol", text: ":", position: { line: 1, column: 28 } },
      { kind: "symbol", text: "=", position: { line: 1, column: 30 } },
      { kind: "symbol", text: "?", position: { line: 1, column: 32 } },
      { kind: "symbol", text: "@", position: { line: 1, column: 34 } },
      { kind: "symbol", text: "@@", position: { line: 1, column: 36 } },
      { kind: "symbol", text: ".", position: { line: 1, column: 39 } },
      { kind: "newline", text: "\n", position: { line: 1, column: 40 } },
      { kind: "identifier", text: "b", position: { line: 2, column: 1 } },
      { kind: "end", text: "", position: { line: 2, column: 2 } },
    ]);
  });

  it("keeps triple-slash comments and drops double-slash comments", () => {
    expect(
      unwrapOk(tokenizePrisma("// note\n///  Doc text\r\na // trailing")),
    ).toStrictEqual([
      { kind: "newline", text: "\n", position: { line: 1, column: 8 } },
      {
        kind: "docComment",
        text: " Doc text",
        position: { line: 2, column: 1 },
      },
      { kind: "newline", text: "\n", position: { line: 2, column: 15 } },
      { kind: "identifier", text: "a", position: { line: 3, column: 1 } },
      { kind: "end", text: "", position: { line: 3, column: 14 } },
    ]);
  });

  it.each([
    ["integer", "42", 3],
    ["negative decimal", "-0.00", 6],
    ["exponent", "1.5e+10", 8],
  ])("reads a %s number as its source text", (_label, text, endColumn) => {
    expect(unwrapOk(tokenizePrisma(text))).toStrictEqual([
      { kind: "number", text, position: { line: 1, column: 1 } },
      { kind: "end", text: "", position: { line: 1, column: endColumn } },
    ]);
  });

  it("decodes json-style escapes in strings", () => {
    expect(
      unwrapOk(tokenizePrisma(String.raw`"a\"b\\c\/d\b\f\n\r\t\u1EA1"`)),
    ).toStrictEqual([
      {
        kind: "string",
        text: 'a"b\\c/d\b\f\n\r\t\u1EA1',
        position: { line: 1, column: 1 },
      },
      { kind: "end", text: "", position: { line: 1, column: 29 } },
    ]);
  });

  it.each([
    ["at the end of the input", 'a "abc'],
    ["at a line break", 'a "abc\n"'],
  ])("reports an unterminated string at its start %s", (_label, source) => {
    expect(unwrapError(tokenizePrisma(source))).toStrictEqual({
      position: { line: 1, column: 3 },
    });
  });

  it.each([
    ["an unknown escape", String.raw`"ab\q"`],
    ["a short unicode escape", String.raw`"ab\u12"`],
    ["a non-hex unicode escape", String.raw`"ab\u12G4"`],
  ])("reports %s at its backslash", (_label, source) => {
    expect(unwrapError(tokenizePrisma(source))).toStrictEqual({
      position: { line: 1, column: 4 },
    });
  });

  it.each([
    ["an unexpected character", "a #", 3],
    ["a minus sign without digits", "a -b", 3],
    ["a single slash", "a / b", 3],
  ])("reports %s at its position", (_label, source, column) => {
    expect(unwrapError(tokenizePrisma(source))).toStrictEqual({
      position: { line: 1, column },
    });
  });

  it("counts columns in utf-16 code units", () => {
    expect(unwrapOk(tokenizePrisma('"h\u1ECD\u{1F600}" x'))).toStrictEqual([
      {
        kind: "string",
        text: "h\u1ECD\u{1F600}",
        position: { line: 1, column: 1 },
      },
      { kind: "identifier", text: "x", position: { line: 1, column: 8 } },
      { kind: "end", text: "", position: { line: 1, column: 9 } },
    ]);
  });
});
