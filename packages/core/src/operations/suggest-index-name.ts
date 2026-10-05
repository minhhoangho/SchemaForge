import { MAX_NAME_BYTES, utf8ByteLength } from "../model/name-limits.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { createNameClaimer } from "./pick-unused-name.js";
import type { NameClaimer } from "./pick-unused-name.js";

const NAME_SEPARATOR = "_";
const INDEX_SUFFIX = "_idx";
const UNIQUE_INDEX_SUFFIX = "_key";
// Attempt 1 carries no number, so numbering starts at 2.
const FIRST_ATTEMPT = 1;

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

type IndexNameInput = {
  readonly tableName: string;
  readonly columnNames: readonly string[];
  readonly isUnique: boolean;
};

/**
 * Takes the name `suggestIndexName` would suggest from `claimer`, which holds
 * the index and table name keys taken so far. Lets an importer name many
 * indexes in linear time.
 */
export function claimIndexName(
  claimer: NameClaimer,
  input: IndexNameInput,
): string {
  const stem = [input.tableName, ...input.columnNames].join(NAME_SEPARATOR);
  const suffix = input.isUnique ? UNIQUE_INDEX_SUFFIX : INDEX_SUFFIX;
  // The suffix is one of two fixed strings without NUL, so the key tells
  // apart every pair of stem and suffix.
  return claimer.claim(`${suffix}\u0000${stem}`, (attempt) =>
    buildCandidate(
      stem,
      attempt === FIRST_ATTEMPT ? suffix : `${suffix}${String(attempt)}`,
    ),
  );
}

/**
 * Suggests an index name from table and column names that no index in the
 * schema already uses, compared case-insensitively. Takes names rather than
 * ids so importers can name an index before its table exists in the schema.
 * Table names count as used too, so the suggestion never raises
 * index-name-conflicts-table.
 */
export function suggestIndexName(
  schema: SchemaDocument,
  input: IndexNameInput,
): string {
  const claimer = createNameClaimer(
    [...Object.values(schema.indexes), ...Object.values(schema.tables)].map(
      (element) => element.name,
    ),
  );
  return claimIndexName(claimer, input);
}
