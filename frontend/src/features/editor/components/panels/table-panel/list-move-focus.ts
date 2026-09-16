// Focus targets for the move buttons of the column and index lists. Placing
// focus after the dispatch is `usePendingFocus` (enum-pending-focus.ts); what
// is specific here is which control keeps focus once a moved element reaches
// the end of its list and its own move button becomes disabled.

export type MoveDirection = "up" | "down";

export type MoveControl = "moveUp" | "moveDown";

const STEP_BY_DIRECTION = { up: -1, down: 1 } as const;

/** The DOM id of one control of a list element, unique within `baseId`. */
export function controlId(
  baseId: string,
  elementId: string,
  control: string,
): string {
  return `${baseId}-${elementId}-${control}`;
}

export function targetIndex(
  position: number,
  direction: MoveDirection,
): number {
  return position + STEP_BY_DIRECTION[direction];
}

/**
 * The move button that keeps focus after an element moved to `toIndex`: the
 * same button, unless the element reached the end it was moving to and that
 * button is now disabled, in which case the opposite one.
 */
export function moveFocusControl(
  direction: MoveDirection,
  toIndex: number,
  count: number,
): MoveControl {
  if (direction === "up") {
    return toIndex === 0 ? "moveDown" : "moveUp";
  }
  return toIndex === count - 1 ? "moveUp" : "moveDown";
}
