import { describe, expect, it } from "vitest";

import { isFocusTargetObscured } from "./is-focus-target-obscured";

const CANVAS = new DOMRect(0, 0, 1000, 800);
const MINIMAP = new DOMRect(780, 630, 200, 150);
const TOAST_AREA = new DOMRect(300, 700, 400, 80);

describe("isFocusTargetObscured", () => {
  it("treats an element outside the canvas as obscured", () => {
    expect(
      isFocusTargetObscured({
        target: new DOMRect(1200, 100, 200, 100),
        canvas: CANVAS,
        overlays: [MINIMAP, TOAST_AREA],
      }),
    ).toBe(true);
  });

  it("treats an element fully under the minimap as obscured", () => {
    expect(
      isFocusTargetObscured({
        target: new DOMRect(800, 650, 100, 60),
        canvas: CANVAS,
        overlays: [MINIMAP, TOAST_AREA],
      }),
    ).toBe(true);
  });

  it("treats an element fully inside the toast area as obscured", () => {
    expect(
      isFocusTargetObscured({
        target: new DOMRect(400, 710, 150, 40),
        canvas: CANVAS,
        overlays: [MINIMAP, TOAST_AREA],
      }),
    ).toBe(true);
  });

  it("treats a partly covered element as visible", () => {
    expect(
      isFocusTargetObscured({
        target: new DOMRect(700, 600, 200, 100),
        canvas: CANVAS,
        overlays: [MINIMAP, TOAST_AREA],
      }),
    ).toBe(false);
  });

  it("treats a fully visible element as visible", () => {
    expect(
      isFocusTargetObscured({
        target: new DOMRect(100, 100, 200, 100),
        canvas: CANVAS,
        overlays: [MINIMAP, TOAST_AREA],
      }),
    ).toBe(false);
  });

  it("treats the part of an element that sticks out of the canvas as hidden", () => {
    expect(
      isFocusTargetObscured({
        target: new DOMRect(850, 700, 300, 60),
        canvas: CANVAS,
        overlays: [new DOMRect(780, 630, 220, 170)],
      }),
    ).toBe(true);
  });
});
