import type { Position } from "@schemaforge/core";

export type MeasuredBox = {
  readonly position: Position;
  readonly width: number;
  readonly height: number;
};

/**
 * Where a merged import starts: `gap` right of every node on the canvas, level
 * with the topmost one (spec section 2, "Thêm vào schema hiện tại", step 3).
 */
export function computeMergeOrigin(
  nodes: readonly MeasuredBox[],
  gap: number,
): Position {
  if (nodes.length === 0) return { x: 0, y: 0 };
  const right = Math.max(...nodes.map((node) => node.position.x + node.width));
  const top = Math.min(...nodes.map((node) => node.position.y));
  return { x: Math.round(right + gap), y: Math.round(top) };
}
