import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { PROPERTY_RUNS, PROPERTY_SEED } from "../../testing/arbitraries.js";
import { locateJsonSyntaxError } from "./locate-json-syntax-error.js";

const NESTING_DEPTH = 20_000;
const PROPERTY_TIMEOUT_MS = 30_000;
// Characters that most often turn valid JSON into invalid JSON or back.
const MUTATION_CHARACTERS = [
  ",",
  ":",
  "{",
  "}",
  "[",
  "]",
  '"',
  "\\",
  " ",
  "\n",
  "\t",
  "0",
  "-",
  ".",
  "e",
  "u",
  "x",
] as const;

function isParsableJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function insertCharacter(
  text: string,
  index: number,
  character: string,
): string {
  const offset = index % (text.length + 1);
  return text.slice(0, offset) + character + text.slice(offset);
}

describe("locateJsonSyntaxError", () => {
  it.each([
    ["an object", '{"a": [1, -2.5e+3, true, false, null, "x\\n\\u00e9"]}'],
    ["a bare string", '"text"'],
    ["a number surrounded by whitespace", " \t\r\n0 "],
    ["an empty array", "[]"],
    ["nested empty containers", '{"a": {}, "b": [[], {}]}'],
  ])("returns null for valid json: %s", (_name, source) => {
    expect(locateJsonSyntaxError(source)).toBeNull();
  });

  it.each([
    ["a missing comma", '{"a": 1 "b": 2}', { line: 1, column: 9 }],
    ["a trailing comma", '{\n  "a": 1,\n}', { line: 3, column: 1 }],
    ["an unterminated string", '{"a": "abc', { line: 1, column: 11 }],
    ["a control character inside a string", '["a\tb"]', { line: 1, column: 4 }],
    ["an invalid escape", '["a\\x"]', { line: 1, column: 5 }],
    ["an invalid unicode escape", '["\\u12G4"]', { line: 1, column: 7 }],
    ["a second root value", "{} {}", { line: 1, column: 4 }],
    ["an unexpected end", '{"a": [1, 2', { line: 1, column: 12 }],
    ["an empty source", "", { line: 1, column: 1 }],
    ["a misspelled literal", "[tru]", { line: 1, column: 5 }],
    ["a leading zero", "[01]", { line: 1, column: 3 }],
    ["a fraction without digits", "[1.]", { line: 1, column: 4 }],
    ["an exponent without digits", "[1e+]", { line: 1, column: 5 }],
    ["a minus sign without digits", "[-]", { line: 1, column: 3 }],
    ["a key that is not a string", "{a: 1}", { line: 1, column: 2 }],
    ["a missing colon", '{"a" 1}', { line: 1, column: 6 }],
    ["a mismatched closing bracket", '{"a": 1]', { line: 1, column: 8 }],
    ["a closing bracket at the root", "]", { line: 1, column: 1 }],
    ["a byte order mark", "﻿{}", { line: 1, column: 1 }],
  ])("locates %s", (_name, source, expected) => {
    expect(locateJsonSyntaxError(source)).toStrictEqual(expected);
  });

  it("counts columns in code units after an emoji", () => {
    expect(locateJsonSyntaxError('{"name": "😀", x}')).toStrictEqual({
      line: 1,
      column: 16,
    });
  });

  it("handles 20000 nested brackets without a stack overflow", () => {
    const source = "[".repeat(NESTING_DEPTH) + "]".repeat(NESTING_DEPTH);

    expect(locateJsonSyntaxError(source)).toBeNull();
  });

  it(
    "finds an error exactly when JSON.parse rejects the text",
    { timeout: PROPERTY_TIMEOUT_MS },
    () => {
      fc.assert(
        fc.property(
          fc.json(),
          fc.nat(),
          fc.constantFrom(...MUTATION_CHARACTERS),
          (json, index, character) => {
            const text = insertCharacter(json, index, character);

            expect(locateJsonSyntaxError(text) === null).toBe(
              isParsableJson(text),
            );
          },
        ),
        { seed: PROPERTY_SEED, numRuns: PROPERTY_RUNS },
      );
    },
  );
});
