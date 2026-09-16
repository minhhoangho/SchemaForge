import type { ColumnDefault, ColumnType } from "@schemaforge/core";

type ColumnDefaultKind = ColumnDefault["kind"];

const NO_DEFAULTS: readonly ColumnDefaultKind[] = [];
const LITERAL_ONLY: readonly ColumnDefaultKind[] = ["literal"];
const TIMESTAMP_DEFAULTS: readonly ColumnDefaultKind[] = [
  "literal",
  "currentTimestamp",
];
const UUID_DEFAULTS: readonly ColumnDefaultKind[] = ["literal", "generateUuid"];

/**
 * The default value kinds the panel offers for a column type. This must match
 * the `column-default-incompatible` rule in packages/core
 * (`validation/rules/column-defaults.ts`): a binary column takes no default,
 * `currentTimestamp` needs `timestamp` or `timestamptz`, and `generateUuid`
 * needs `uuid`. Whether a literal is a valid value is a separate issue
 * (`column-default-invalid`) that the panel does not pre-check.
 */
export function getAllowedColumnDefaults(
  type: ColumnType,
): readonly ColumnDefaultKind[] {
  if (type.kind === "binary") {
    return NO_DEFAULTS;
  }
  if (type.kind === "timestamp" || type.kind === "timestamptz") {
    return TIMESTAMP_DEFAULTS;
  }
  if (type.kind === "uuid") {
    return UUID_DEFAULTS;
  }
  return LITERAL_ONLY;
}
