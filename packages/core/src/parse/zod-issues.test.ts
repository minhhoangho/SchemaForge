import { describe, expect, it } from "vitest";
import { z } from "zod";

import { tableIdShape } from "../model/ids.js";

import { toStructuralErrors } from "./zod-issues.js";

function issuesFor(
  shape: z.ZodType,
  value: unknown,
): readonly z.core.$ZodIssue[] {
  const result = shape.safeParse(value);
  return result.success ? [] : result.error.issues;
}

describe("toStructuralErrors", () => {
  it("maps a missing field to invalid-shape at the field path", () => {
    const shape = z.strictObject({ name: z.string() });

    expect(toStructuralErrors(issuesFor(shape, {}))).toStrictEqual([
      { code: "invalid-shape", path: ["name"] },
    ]);
  });

  it("maps each unrecognized key to its own error with the key appended to the path", () => {
    const shape = z.strictObject({ name: z.string() });

    expect(
      toStructuralErrors(issuesFor(shape, { name: "x", extraA: 1, extraB: 2 })),
    ).toStrictEqual([
      { code: "invalid-shape", path: ["extraA"] },
      { code: "invalid-shape", path: ["extraB"] },
    ]);
  });

  it("maps an unknown discriminator to the path of the discriminator field", () => {
    const shape = z.discriminatedUnion("type", [
      z.strictObject({ type: z.literal("a") }),
    ]);

    expect(
      toStructuralErrors(issuesFor(shape, { type: "bogus" })),
    ).toStrictEqual([{ code: "invalid-shape", path: ["type"] }]);
  });

  it("maps an invalid record key to the path of the key", () => {
    const shape = z.record(tableIdShape, z.string());

    expect(toStructuralErrors(issuesFor(shape, { bogus: "x" }))).toStrictEqual([
      { code: "invalid-shape", path: ["bogus"] },
    ]);
  });

  it("drops duplicate paths", () => {
    const shapeExpectingString = z.strictObject({ name: z.string() });
    const shapeExpectingNumber = z.strictObject({ name: z.number() });

    const issues = [
      ...issuesFor(shapeExpectingString, { name: 1 }),
      ...issuesFor(shapeExpectingNumber, { name: "x" }),
    ];

    expect(toStructuralErrors(issues)).toStrictEqual([
      { code: "invalid-shape", path: ["name"] },
    ]);
  });

  it("sorts errors by path", () => {
    const shape = z.strictObject({ b: z.string(), a: z.string() });

    expect(toStructuralErrors(issuesFor(shape, {}))).toStrictEqual([
      { code: "invalid-shape", path: ["a"] },
      { code: "invalid-shape", path: ["b"] },
    ]);
  });
});
