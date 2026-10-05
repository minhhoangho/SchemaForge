import type { SourceLocation } from "./import-types.js";

const LINE_FEED = "\n";
const CARRIAGE_RETURN = "\r";

/** Offsets where each line starts; "\n", "\r\n" and a lone "\r" each end a line. */
export function createLineStarts(source: string): readonly number[] {
  const lineStarts = [0];
  for (let offset = 0; offset < source.length; offset += 1) {
    const character = source[offset];
    const isCrlf =
      character === CARRIAGE_RETURN && source[offset + 1] === LINE_FEED;
    if (isCrlf) {
      offset += 1;
    }
    if (character === LINE_FEED || character === CARRIAGE_RETURN) {
      lineStarts.push(offset + 1);
    }
  }
  return lineStarts;
}

/**
 * Maps a string offset to a 1-based line and UTF-16 column. The source length
 * itself maps to the position right after the last character.
 */
export function toSourceLocation(
  lineStarts: readonly number[],
  offset: number,
): SourceLocation {
  // Binary search for the last line that starts at or before the offset.
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((lineStarts[middle] ?? 0) <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return { line: low + 1, column: offset - (lineStarts[low] ?? 0) + 1 };
}

/** Normalizes a parser library position whose line already starts at 1. */
export function fromParserPosition(
  line: number,
  column: number,
  columnBase: 0 | 1,
): SourceLocation {
  return { line, column: column + 1 - columnBase };
}
