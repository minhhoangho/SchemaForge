import { describe, expect, it } from "vitest";

import type { JsonValue } from "../shared/json-representation.js";
import { renderJsValue } from "./render-js-value.js";

describe("renderJsValue", () => {
  it.each<[JsonValue, string]>([
    [null, "null"],
    [true, "true"],
    [false, "false"],
    [42, "42"],
    [-1.5, "-1.5"],
    ['say "hi"\n', '"say \\"hi\\"\\n"'],
  ])("renders primitives with JSON.stringify (%j)", (value, expected) => {
    expect(renderJsValue(value)).toBe(expected);
  });

  it("renders arrays and nested objects", () => {
    expect(
      renderJsValue([1, { name: "a", tags: ["x", null], inner: { ok: true } }]),
    ).toBe('[1, { name: "a", tags: ["x", null], inner: { ok: true } }]');
  });

  it("renders a __proto__ key as a computed key", () => {
    expect(renderJsValue({ ["__proto__"]: { x: 1 } })).toBe(
      '{ ["__proto__"]: { x: 1 } }',
    );
  });

  it("quotes keys that are not identifiers", () => {
    expect(renderJsValue({ "first name": "Ann", "1st": 1 })).toBe(
      '{ "first name": "Ann", "1st": 1 }',
    );
  });

  it("renders an empty object", () => {
    expect([renderJsValue({}), renderJsValue([])]).toStrictEqual(["{}", "[]"]);
  });
});
