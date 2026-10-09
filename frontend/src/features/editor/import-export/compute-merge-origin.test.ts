import { describe, expect, it } from "vitest";

import { computeMergeOrigin } from "./compute-merge-origin";

describe("computeMergeOrigin", () => {
  it("returns the origin for an empty canvas", () => {
    expect(computeMergeOrigin([], 80)).toEqual({ x: 0, y: 0 });
  });

  it("places the origin right of every node at the top edge", () => {
    const nodes = [
      { position: { x: 0, y: 40 }, width: 300.4, height: 100 },
      { position: { x: 500, y: -20.6 }, width: 250, height: 80 },
      { position: { x: 100, y: 300 }, width: 320, height: 200 },
    ];

    expect(computeMergeOrigin(nodes, 80)).toEqual({ x: 830, y: -21 });
  });
});
