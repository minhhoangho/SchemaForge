import { toNameKey } from "../../model/name-limits.js";
import type { Position } from "../../model/position.js";
import type { LayoutMetrics } from "./import-types.js";

export type PlacementInput = {
  /** In source order. */
  readonly tables: readonly {
    readonly columnCount: number;
    readonly subjectAreaName: string | null;
  }[];
  readonly noteCount: number;
};

/** Positions in the same order as the input. */
export type Placement = {
  readonly tables: readonly Position[];
  readonly notes: readonly Position[];
};

type TableGroup = {
  readonly name: string | null;
  readonly tableIndexes: number[];
};

function assertLayout(layout: LayoutMetrics): void {
  for (const [field, value] of Object.entries(layout)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`Layout metric ${field} must be finite and >= 0`);
    }
  }
}

function compareGroups(left: TableGroup, right: TableGroup): number {
  if (left.name === null || right.name === null) {
    return Number(left.name === null) - Number(right.name === null);
  }
  const leftKey = toNameKey(left.name);
  const rightKey = toNameKey(right.name);
  if (leftKey !== rightKey) {
    return leftKey < rightKey ? -1 : 1;
  }
  return left.name < right.name ? -1 : Number(left.name > right.name);
}

/** Groups by subject area name, keeping source order inside each group. */
function groupTables(tables: PlacementInput["tables"]): readonly TableGroup[] {
  const groups = new Map<string | null, TableGroup>();
  tables.forEach(({ subjectAreaName }, index) => {
    const group = groups.get(subjectAreaName);
    if (group === undefined) {
      groups.set(subjectAreaName, {
        name: subjectAreaName,
        tableIndexes: [index],
      });
    } else {
      group.tableIndexes.push(index);
    }
  });
  return [...groups.values()].toSorted(compareGroups);
}

function toPoint(x: number, y: number): Position {
  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Deterministic grid for importers without positions (spec section 4): groups
 * start a new row, rows are as tall as their tallest table plus `gap`, and
 * notes sit on one row below every table.
 */
export function placeElements(
  input: PlacementInput,
  layout: LayoutMetrics,
): Placement {
  assertLayout(layout);
  const gridColumns = Math.max(1, Math.ceil(Math.sqrt(input.tables.length)));
  const cellWidth = layout.tableWidth + layout.gap;
  const tables: Position[] = [];
  let rowTop = 0;
  for (const { tableIndexes } of groupTables(input.tables)) {
    for (let start = 0; start < tableIndexes.length; start += gridColumns) {
      const row = tableIndexes.slice(start, start + gridColumns);
      row.forEach((tableIndex, gridColumn) => {
        tables[tableIndex] = toPoint(gridColumn * cellWidth, rowTop);
      });
      const tallestColumnCount = Math.max(
        ...row.map((tableIndex) => input.tables[tableIndex]?.columnCount ?? 0),
      );
      rowTop +=
        layout.headerHeight +
        tallestColumnCount * layout.columnRowHeight +
        layout.gap;
    }
  }
  const notes = Array.from({ length: input.noteCount }, (_, noteIndex) =>
    toPoint(noteIndex * cellWidth, rowTop),
  );
  return { tables, notes };
}
