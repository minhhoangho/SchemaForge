import {
  MAX_NAME_BYTES,
  toNameKey,
  utf8ByteLength,
} from "../model/name-limits.js";
import type { SchemaDocument } from "../model/schema-document.js";

const NAME_SEPARATOR = "_";
const INDEX_SUFFIX = "_idx";
const UNIQUE_INDEX_SUFFIX = "_key";
// The first candidate carries no number, so numbering starts at 2.
const FIRST_CANDIDATE_NUMBER = 2;

// Iterating a string yields whole code points, so a multi-byte character is
// either kept or dropped, never split.
function truncateToByteLength(text: string, maxBytes: number): string {
  let truncated = "";
  let byteLength = 0;
  for (const character of text) {
    byteLength += utf8ByteLength(character);
    if (byteLength > maxBytes) {
      break;
    }
    truncated += character;
  }
  return truncated;
}

// The stem is shortened rather than the suffix, so the suffix and its number
// always survive and keep candidates distinct.
function buildCandidate(stem: string, suffix: string): string {
  const stemBudget = MAX_NAME_BYTES - utf8ByteLength(suffix);
  return truncateToByteLength(stem, stemBudget) + suffix;
}

/**
 * Suggests an index name from table and column names that no index in the
 * schema already uses, compared case-insensitively. Takes names rather than
 * ids so importers can name an index before its table exists in the schema.
 */
export function suggestIndexName(
  schema: SchemaDocument,
  input: {
    readonly tableName: string;
    readonly columnNames: readonly string[];
    readonly isUnique: boolean;
  },
): string {
  const stem = [input.tableName, ...input.columnNames].join(NAME_SEPARATOR);
  const suffix = input.isUnique ? UNIQUE_INDEX_SUFFIX : INDEX_SUFFIX;
  const usedNameKeys = new Set(
    Object.values(schema.indexes).map((index) => toNameKey(index.name)),
  );
  let candidate = buildCandidate(stem, suffix);
  let candidateNumber = FIRST_CANDIDATE_NUMBER;
  while (usedNameKeys.has(toNameKey(candidate))) {
    candidate = buildCandidate(stem, `${suffix}${String(candidateNumber)}`);
    candidateNumber += 1;
  }
  return candidate;
}
