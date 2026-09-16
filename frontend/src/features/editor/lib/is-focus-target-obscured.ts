type Bounds = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

function intersect(first: DOMRect, second: DOMRect): Bounds | null {
  const bounds = {
    left: Math.max(first.left, second.left),
    top: Math.max(first.top, second.top),
    right: Math.min(first.right, second.right),
    bottom: Math.min(first.bottom, second.bottom),
  };
  // A horizontal or vertical edge has a zero-thickness box, so only a negative
  // size means the two rectangles do not meet.
  return bounds.left > bounds.right || bounds.top > bounds.bottom
    ? null
    : bounds;
}

function contains(outer: DOMRect, inner: Bounds): boolean {
  return (
    inner.left >= outer.left &&
    inner.top >= outer.top &&
    inner.right <= outer.right &&
    inner.bottom <= outer.bottom
  );
}

/**
 * Tells whether a focused element is entirely hidden (WCAG 2.4.11): it lies
 * outside the canvas, or the part inside the canvas sits wholly under one
 * overlay such as the minimap or the toast area. A partly covered element
 * still counts as visible.
 */
export function isFocusTargetObscured(input: {
  readonly target: DOMRect;
  readonly canvas: DOMRect;
  readonly overlays: readonly DOMRect[];
}): boolean {
  const visiblePart = intersect(input.target, input.canvas);
  if (visiblePart === null) {
    return true;
  }
  return input.overlays.some((overlay) => contains(overlay, visiblePart));
}
