import { describe, expect, it } from "vitest";

const SCALE_FACTOR = 1.5;
const POINTER_ID = 1;

describe("setup-tests", () => {
  it("provides a ResizeObserver that can observe an element", () => {
    const observer = new ResizeObserver(() => undefined);
    const element = document.createElement("div");

    expect(() => {
      observer.observe(element);
      observer.unobserve(element);
      observer.disconnect();
    }).not.toThrow();
  });

  it("provides a DOMMatrixReadOnly that reads the scale factor", () => {
    const matrix = new DOMMatrixReadOnly(
      `translate(10px, 20px) scale(${String(SCALE_FACTOR)})`,
    );

    expect(matrix.m22).toBe(SCALE_FACTOR);
  });

  it("provides a matchMedia that does not match by default", () => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    expect(mediaQuery.matches).toBe(false);
  });

  it("provides pointer capture and scrollIntoView on elements", () => {
    const element = document.createElement("div");

    expect(element.hasPointerCapture(POINTER_ID)).toBe(false);
    expect(() => {
      element.setPointerCapture(POINTER_ID);
      element.releasePointerCapture(POINTER_ID);
      element.scrollIntoView();
    }).not.toThrow();
  });

  it("resolves modules through the @/ alias", async () => {
    await expect(import("@/testing/setup-tests")).resolves.toBeDefined();
  });
});
