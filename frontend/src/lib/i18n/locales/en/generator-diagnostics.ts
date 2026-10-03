import type { GeneratorDiagnosticCode } from "@schemaforge/core";

export const enGeneratorDiagnostics = {
  "enum-not-supported":
    "Column “{{column}}” of “{{table}}” uses an enum, which this output cannot express. It is written as text, so its values are no longer enforced.",
  "type-not-supported":
    "Column “{{column}}” of “{{table}}” has a type this output does not support. It is written as text.",
  "type-parameter-out-of-range":
    "The type of column “{{column}}” of “{{table}}” exceeds a limit of this output and was adjusted to fit.",
  "key-column-type-narrowed":
    "The type of column “{{column}}” of “{{table}}” was narrowed because it is part of a key or index and the output limits key length.",
  "key-column-type-not-indexable":
    "In table “{{table}}”, a key, unique constraint, index or relation was dropped because this output cannot index its columns.",
  "referential-action-not-supported":
    "The relation from “{{table}}” uses an action this output does not support. It is written as NO ACTION.",
  "referential-action-cycle":
    "The relation from “{{table}}” would create a cascade cycle or a second cascade path. Its actions are written as NO ACTION.",
  "unique-nulls-restricted":
    "In table “{{table}}”, a unique constraint on a nullable column allows only one NULL row in this output.",
  "table-without-identifier":
    "Table “{{table}}” has no primary key or required unique column, so this output only covers part of what it describes.",
  "custom-type-unmapped":
    "Column “{{column}}” of “{{table}}” has a custom type this output cannot map. It is written as an unknown type.",
  "custom-type-unsafe":
    "The custom type of column “{{column}}” of “{{table}}” is not a safe type name. It is written as text.",
  "default-omitted":
    "The default value of column “{{column}}” of “{{table}}” does not fit its type and was left out.",
  "identifier-collision-renamed":
    "In table “{{table}}”, a column or index was renamed with a numeric suffix because its name matched another one in this output.",
  "null-character-removed":
    "A null character was removed from a comment, default value or enum value because this output cannot store it.",
  "comment-truncated":
    "A comment of table “{{table}}” or of one of its columns was cut to the length this output allows.",
  "seed-table-skipped":
    "Table “{{table}}” has no rows because a required column could not get a value.",
  "seed-rows-reduced":
    "Table “{{table}}” has fewer rows than requested because a unique constraint does not have enough distinct values.",
} as const satisfies Record<GeneratorDiagnosticCode, string>;
