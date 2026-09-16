import type { ErrorCode } from "@schemaforge/core";

export const enErrors = {
  codes: {
    "invalid-shape": "The saved data does not have the expected structure.",
    "version-unsupported":
      "This schema was saved by a newer version of SchemaForge.",
    "id-mismatch": "The saved data is inconsistent: an element has a wrong id.",
    "table-not-found": "The table to change no longer exists.",
    "column-not-found": "The column to change no longer exists.",
    "relation-not-found": "The relation to change no longer exists.",
    "index-not-found": "The index to change no longer exists.",
    "enum-not-found": "The enum to change no longer exists.",
    "subject-area-not-found": "The subject area to change no longer exists.",
    "note-not-found": "The note to change no longer exists.",
    "column-not-in-table": "That column belongs to a different table.",
    "column-listed-twice": "The same column was listed twice.",
    "column-ownership-mismatch":
      "The saved data is inconsistent: a column belongs to a table that does not list it.",
    "id-already-exists": "Something with the same id already exists.",
    "enum-in-use": "This enum is still used by at least one column.",
    "insert-position-out-of-range":
      "The chosen position is outside of the list.",
    "primary-key-missing":
      "The table needs a primary key before it can be used in a relation.",
  } as const satisfies Record<ErrorCode, string>,
  operationNotApplied: "The action was not applied",
} as const;
