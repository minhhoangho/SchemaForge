import type { DocumentPath } from "../../document-path.js";
import { createDiagnostic } from "./diagnostics.js";
import type { GeneratorDiagnostic, SqlDialect } from "./generator-types.js";
import { removeNullCharacters } from "./sql-literals.js";

// Strict mode rejects longer comments (spec section 4, "Cắt comment").
const MYSQL_MAX_COLUMN_COMMENT_CODE_POINTS = 1024;
const MYSQL_MAX_TABLE_COMMENT_CODE_POINTS = 2048;
// MS_Description is at most 7500 bytes of nvarchar.
const SQLSERVER_MAX_COMMENT_CODE_UNITS = 3750;

const MIN_HIGH_SURROGATE = 0xd800;
const MAX_HIGH_SURROGATE = 0xdbff;
const MIN_LOW_SURROGATE = 0xdc00;
const MAX_LOW_SURROGATE = 0xdfff;

export type SqlComment = {
  readonly text: string;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

/** The first `max` code points of `text` (MySQL counts comment characters that way). */
export function truncateCodePoints(text: string, max: number): string {
  // A string never has more code points than code units.
  if (text.length <= max) {
    return text;
  }
  // Code points, not graphemes: MySQL counts one character per code point.
  let count = 0;
  let end = 0;
  for (const codePoint of text) {
    if (count === max) {
      return text.slice(0, end);
    }
    count += 1;
    end += codePoint.length;
  }
  return text;
}

/** The longest prefix of at most `max` UTF-16 code units that keeps surrogate pairs whole. */
export function truncateUtf16CodeUnits(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const last = text.charCodeAt(max - 1);
  const next = text.charCodeAt(max);
  const isSplittingPair =
    last >= MIN_HIGH_SURROGATE &&
    last <= MAX_HIGH_SURROGATE &&
    next >= MIN_LOW_SURROGATE &&
    next <= MAX_LOW_SURROGATE;
  return text.slice(0, isSplittingPair ? max - 1 : max);
}

function truncatedComment(
  comment: string,
  text: string,
  path: DocumentPath,
): SqlComment {
  return {
    text,
    diagnostics:
      text === comment ? [] : [createDiagnostic("comment-truncated", path)],
  };
}

/** A table or column comment as the dialect can store it, with its diagnostics. */
export function resolveSqlComment(
  dialect: SqlDialect,
  owner: "table" | "column",
  comment: string,
  path: DocumentPath,
): SqlComment {
  switch (dialect) {
    case "postgresql": {
      const { text, hasRemoved } = removeNullCharacters(comment);
      return {
        text,
        diagnostics: hasRemoved
          ? [createDiagnostic("null-character-removed", path)]
          : [],
      };
    }
    case "mysql": {
      const max =
        owner === "table"
          ? MYSQL_MAX_TABLE_COMMENT_CODE_POINTS
          : MYSQL_MAX_COLUMN_COMMENT_CODE_POINTS;
      return truncatedComment(comment, truncateCodePoints(comment, max), path);
    }
    case "sqlserver":
      return truncatedComment(
        comment,
        truncateUtf16CodeUnits(comment, SQLSERVER_MAX_COMMENT_CODE_UNITS),
        path,
      );
    default: {
      const unreachable: never = dialect;
      return unreachable;
    }
  }
}
