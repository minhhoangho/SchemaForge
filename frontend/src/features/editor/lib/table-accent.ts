import type { TableId } from "@schemaforge/core";

const TABLE_ACCENTS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type TableAccentIndex = (typeof TABLE_ACCENTS)[number];

export const TABLE_ACCENT_COUNT = TABLE_ACCENTS.length;

// 32-bit FNV-1a over the UTF-16 code units of the id.
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function hashFnv1a(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME) >>> 0;
  }
  return hash;
}

/** The header color of a table, stable across reloads, devices and cloud. */
export function getTableAccent(tableId: TableId): TableAccentIndex {
  // The modulo keeps the index in range; `??` only satisfies
  // noUncheckedIndexedAccess.
  return (
    TABLE_ACCENTS[hashFnv1a(tableId) % TABLE_ACCENT_COUNT] ?? TABLE_ACCENTS[0]
  );
}

/** `var(--table-accent-N)`, for an inline `style` or a MiniMap `nodeColor`. */
export function getTableAccentColor(tableId: TableId): string {
  return `var(--table-accent-${String(getTableAccent(tableId))})`;
}
