import type { Position } from "../model/position.js";
import type { SchemaDocument } from "../model/schema-document.js";

// Grid constants of AI-R13, fixed by plan issue 14 (the same 400 spacing as
// createLargeSchema).
export const AI_TABLES_PER_ROW = 4;
export const AI_TABLE_GRID_STEP_X = 400;
export const AI_TABLE_GRID_STEP_Y = 400;

/**
 * Anchored to the turn's original document, not the draft, so tables created
 * in one turn fill one row instead of each pushing the origin right (AI-R13).
 */
export type AiTablePlacement = {
  readonly originX: number;
  readonly placedCount: number;
};

export function createAiTablePlacement(
  original: SchemaDocument,
): AiTablePlacement {
  const tables = Object.values(original.tables);
  // reduce instead of Math.max(...xs): spreading a huge table list can overflow the stack.
  const originX =
    tables.length === 0
      ? 0
      : tables.reduce(
          (rightmost, table) => Math.max(rightmost, table.position.x),
          -Infinity,
        ) + AI_TABLE_GRID_STEP_X;
  return { originX, placedCount: 0 };
}

export function aiTablePosition(placement: AiTablePlacement): Position {
  const { originX, placedCount } = placement;
  return {
    x: originX + (placedCount % AI_TABLES_PER_ROW) * AI_TABLE_GRID_STEP_X,
    y: Math.floor(placedCount / AI_TABLES_PER_ROW) * AI_TABLE_GRID_STEP_Y,
  };
}
