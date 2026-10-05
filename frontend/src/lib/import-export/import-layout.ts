import type { LayoutMetrics } from "@schemaforge/core";

// Derived from the TableNode classes (not measured in a browser yet), at the
// 16px root size:
// - tableWidth: `max-w-80` = 20rem = 320px, the widest a node gets.
// - headerHeight: header `h-9` = 2.25rem = 36px plus the 1px card border on
//   top = 37px. The 2px diff border is not counted: it only shows in an AI
//   proposal preview, never right after an import.
// - columnRowHeight: row `h-7` = 1.75rem = 28px. Neither theme changes a size
//   (themes only swap colors), so one value serves both.
// - gap: the 80px the import layout leaves between tables; it also absorbs the
//   card's bottom border.
// ponytail: derived values, to be checked against the rendered node in a
// browser (plan Task 32); raise them if tables overlap after an import.
export const IMPORT_LAYOUT_METRICS: LayoutMetrics = {
  tableWidth: 320,
  headerHeight: 37,
  columnRowHeight: 28,
  gap: 80,
};
