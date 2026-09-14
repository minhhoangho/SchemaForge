import { describe, expect, it } from "vitest";

import { positionShape } from "./position.js";

describe("positionShape", () => {
  it("accepts finite coordinates", () => {
    expect(positionShape.safeParse({ x: -12.5, y: 320 }).success).toBe(true);
  });

  it("rejects an infinite coordinate", () => {
    expect(positionShape.safeParse({ x: Infinity, y: 0 }).success).toBe(false);
  });

  it("rejects NaN", () => {
    expect(positionShape.safeParse({ x: 0, y: Number.NaN }).success).toBe(
      false,
    );
  });
});
