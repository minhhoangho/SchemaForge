import type { ImportDiagnosticCode } from "@schemaforge/core";

// The element name has its own column in the import preview, so no message
// names an element.
export const enImportDiagnostics = {
  "source-too-large": "The source is too large to import.",
  "too-many-elements": "The source describes too many elements to import.",
  "parse-failed": "The source could not be read.",
  "syntax-error": "The source has a syntax error here.",
  "reference-not-found":
    "A reference points to something that does not exist, so the element holding it was left out.",
  "table-renamed":
    "The table was renamed because its name matched an existing table.",
  "enum-renamed":
    "The enum was renamed because its name matched an existing enum.",
  "index-renamed":
    "The index was renamed because its name matched an existing index.",
  "subject-area-renamed":
    "The subject area was renamed because its name matched an existing one.",
  "data-statements-ignored":
    "Statements that insert data were ignored. Only the structure is imported.",
  "view-not-supported": "Views are not supported and were ignored.",
  "routine-not-supported":
    "Functions and procedures are not supported and were ignored.",
  "trigger-not-supported": "Triggers are not supported and were ignored.",
  "sequence-not-supported": "Sequences are not supported and were ignored.",
  "statement-not-supported": "This statement is not supported and was ignored.",
  "namespace-dropped":
    "The schema or namespace of the table was dropped, because SchemaForge tables have no namespace.",
  "index-expression-not-supported":
    "An index on an expression is not supported, so the index was left out.",
  "index-type-dropped":
    "The index type was dropped, because SchemaForge does not store it.",
  "check-converted-to-enum":
    "A CHECK constraint that lists allowed values became an enum.",
  "check-constraint-not-supported":
    "A CHECK constraint is not supported and was ignored.",
  "computed-column-not-supported":
    "The expression of a computed column is not supported, so it was dropped.",
  "type-approximated":
    "The column type has no exact match and was replaced by the closest type.",
  "type-parameter-dropped":
    "A parameter of the column type, such as its length or precision, was dropped.",
  "identity-options-dropped":
    "The start value and increment of the identity column were dropped.",
  "type-not-supported":
    "The column type is not supported. The column was imported with a custom type.",
  "default-approximated":
    "The default value was replaced by the closest value SchemaForge supports.",
  "sequence-default-as-auto-increment":
    "A default value taken from a sequence became auto increment.",
  "default-not-supported":
    "The default value is not supported and was dropped.",
  "on-update-not-supported":
    "The ON UPDATE clause of the column is not supported and was dropped.",
  "provider-not-supported":
    "The datasource provider is not supported, or no datasource was found.",
  "composite-type-not-supported":
    "Composite types are not supported and were ignored.",
  "scalar-list-as-custom": "A list column was imported with a custom type.",
  "index-option-dropped":
    "An option of the index or key was dropped, because SchemaForge does not store it.",
  "updated-at-not-supported":
    "The @updatedAt attribute is not supported and was dropped.",
  "comment-dropped": "A comment was dropped, because it has no place here.",
  "color-dropped": "A color was dropped, because it has no place here.",
  "back-relation-missing":
    "The relation has no matching field on the other model, so it was built from this side only.",
  "implicit-many-to-many-not-supported":
    "An implicit many-to-many relation is not supported and was ignored.",
  "many-to-many-not-supported":
    "A many-to-many relation is not supported and was ignored.",
} as const satisfies Record<ImportDiagnosticCode, string>;
