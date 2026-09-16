import type { IssueCode } from "@schemaforge/core";

export const enIssues = {
  "name-empty": "The name cannot be empty.",
  "name-invalid":
    "The name cannot start or end with a space and cannot contain control characters.",
  "name-too-long": "The name is too long: it has to fit in 63 bytes.",
  "table-name-duplicate": "Another table is already named “{{table}}”.",
  "enum-name-duplicate": "Another enum is already named “{{enum}}”.",
  "column-name-duplicate":
    "Table “{{table}}” already has another column named “{{column}}”.",
  "index-name-duplicate": "Another index is already named “{{index}}”.",
  "subject-area-name-duplicate": "Another subject area already has this name.",
  "enum-values-empty": "Enum “{{enum}}” has no values.",
  "enum-value-duplicate":
    "Enum “{{enum}}” lists the value “{{value}}” more than once.",
  "column-type-invalid-scale":
    "The scale of column “{{column}}” cannot be larger than its precision.",
  "column-custom-type-invalid":
    "The custom type of column “{{column}}” may only use letters, digits, underscores, spaces, commas and brackets.",
  "column-default-invalid":
    "The default value of column “{{column}}” is not a valid value for its type.",
  "column-default-incompatible":
    "The default value of column “{{column}}” cannot be used with its type.",
  "column-primary-key-nullable":
    "Primary key column “{{column}}” cannot be nullable.",
  "column-auto-increment-invalid-type":
    "Only an integer column can auto-increment, so column “{{column}}” cannot.",
  "column-auto-increment-nullable":
    "Auto-increment column “{{column}}” cannot be nullable.",
  "column-auto-increment-with-default":
    "Auto-increment column “{{column}}” cannot also have a default value.",
  "column-auto-increment-not-key":
    "Auto-increment column “{{column}}” has to be a primary key or unique.",
  "table-multiple-auto-increment":
    "Table “{{table}}” can have only one auto-increment column.",
  "relation-column-type-mismatch":
    "Column “{{column}}” has a different type from the column it points at.",
  "relation-target-not-unique":
    "The relation points at column “{{column}}”, which is neither a primary key nor unique.",
  "relation-one-to-one-not-unique":
    "A one-to-one relation needs column “{{column}}” to be a primary key or unique.",
  "relation-set-null-not-nullable":
    "Column “{{column}}” has to allow NULL before the relation can set it to NULL.",
  "relation-set-default-without-default":
    "Column “{{column}}” needs a default value before the relation can set it back to that default.",
} as const satisfies Record<IssueCode, string>;
