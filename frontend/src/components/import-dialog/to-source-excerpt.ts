import type { SourceLocation } from "@schemaforge/core";

const MAX_EXCERPT_LENGTH = 200;
const LINE_BREAK = /\r\n|\r|\n/;
// Control characters and invisible format characters (bidi overrides, zero
// width marks) could hide or reorder what the excerpt shows.
const UNSAFE_CHARACTERS = /[\p{Cc}\p{Cf}]/gu;
const REPLACEMENT_CHARACTER = "�";

export type SourceExcerptLine = {
  readonly line: string;
  // 1-based position of the marked character inside `line`.
  readonly markColumn: number;
};

/**
 * The source line a diagnostic points at, cut to 200 characters around the
 * column and with control characters replaced, so it is safe to show as text.
 */
export function toSourceExcerpt(
  source: string,
  location: SourceLocation,
): SourceExcerptLine {
  const fullLine = source.split(LINE_BREAK)[location.line - 1] ?? "";
  const column = Math.min(Math.max(location.column, 1), fullLine.length + 1);
  const start = Math.min(
    Math.max(column - 1 - MAX_EXCERPT_LENGTH / 2, 0),
    Math.max(fullLine.length - MAX_EXCERPT_LENGTH, 0),
  );
  return {
    // One replacement per UTF-16 unit keeps the columns of the source.
    line: fullLine
      .slice(start, start + MAX_EXCERPT_LENGTH)
      .replace(UNSAFE_CHARACTERS, (match) =>
        REPLACEMENT_CHARACTER.repeat(match.length),
      ),
    markColumn: column - start,
  };
}
