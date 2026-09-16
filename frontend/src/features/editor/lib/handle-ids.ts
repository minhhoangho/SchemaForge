import type { ColumnId, Position, TableId } from "@schemaforge/core";

export type HandleSide = "left" | "right";

export type ParsedHandle =
  | {
      readonly kind: "column";
      readonly columnId: string;
      readonly side: HandleSide;
    }
  | {
      readonly kind: "table";
      readonly tableId: string;
      readonly side: HandleSide;
    };

const HANDLE_SEPARATOR = ":";
const HANDLE_PART_COUNT = 3;

function isHandleSide(value: string): value is HandleSide {
  return value === "left" || value === "right";
}

export function formatColumnHandleId(
  columnId: ColumnId,
  side: HandleSide,
): string {
  return ["column", columnId, side].join(HANDLE_SEPARATOR);
}

export function formatTableHandleId(
  tableId: TableId,
  side: HandleSide,
): string {
  return ["table", tableId, side].join(HANDLE_SEPARATOR);
}

/**
 * Reads a handle id back into its parts. The element id stays a plain string
 * because core exports no id type guard; callers look the element up in the
 * document and use its typed `id` (plan issue 27).
 */
export function parseHandleId(
  handleId: string | null | undefined,
): ParsedHandle | null {
  if (handleId === null || handleId === undefined) {
    return null;
  }
  const parts = handleId.split(HANDLE_SEPARATOR);
  const [kind, elementId, side] = parts;
  if (
    parts.length !== HANDLE_PART_COUNT ||
    elementId === undefined ||
    elementId === "" ||
    side === undefined ||
    !isHandleSide(side)
  ) {
    return null;
  }
  if (kind === "column") {
    return { kind, columnId: elementId, side };
  }
  return kind === "table" ? { kind, tableId: elementId, side } : null;
}

/**
 * Connects the facing sides of two tables. Equal positions (a self relation)
 * take the first branch; the caller forces the target to the right side.
 */
export function chooseHandleSides(
  fromPosition: Position,
  toPosition: Position,
): { readonly source: HandleSide; readonly target: HandleSide } {
  return fromPosition.x <= toPosition.x
    ? { source: "right", target: "left" }
    : { source: "left", target: "right" };
}
