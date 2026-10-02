// Order follows the catalog table in the code generators spec, section 4.
// `path` contract, the same for every target:
// - enum-not-supported, type-not-supported, type-parameter-out-of-range,
//   key-column-type-narrowed, custom-type-unmapped, custom-type-unsafe:
//   ["columns", columnId, "type"]
// - key-column-type-not-indexable: the dropped element,
//   ["tables", tableId, "primaryKeyColumnIds"], ["columns", columnId, "isUnique"],
//   ["indexes", indexId] or ["relations", relationId]
// - referential-action-not-supported: ["relations", relationId, "onDelete"] or
//   ["relations", relationId, "onUpdate"], one diagnostic per changed action
// - referential-action-cycle: ["relations", relationId]
// - unique-nulls-restricted: ["columns", columnId, "isUnique"] or ["indexes", indexId]
// - table-without-identifier, seed-table-skipped, seed-rows-reduced: ["tables", tableId]
// - default-omitted: ["columns", columnId, "defaultValue"]
// - identifier-collision-renamed: the renamed element,
//   ["columns", columnId, "name"] or ["indexes", indexId, "name"]
// - null-character-removed: ["tables", tableId, "comment"],
//   ["columns", columnId, "comment"], ["columns", columnId, "defaultValue"] or
//   ["enums", enumId, "values", valueIndex]
// - comment-truncated: ["tables", tableId, "comment"] or ["columns", columnId, "comment"]
export const GENERATOR_DIAGNOSTIC_CODES = [
  "enum-not-supported",
  "type-not-supported",
  "type-parameter-out-of-range",
  "key-column-type-narrowed",
  "key-column-type-not-indexable",
  "referential-action-not-supported",
  "referential-action-cycle",
  "unique-nulls-restricted",
  "table-without-identifier",
  "custom-type-unmapped",
  "custom-type-unsafe",
  "default-omitted",
  "identifier-collision-renamed",
  "null-character-removed",
  "comment-truncated",
  "seed-table-skipped",
  "seed-rows-reduced",
] as const;

export type GeneratorDiagnosticCode =
  (typeof GENERATOR_DIAGNOSTIC_CODES)[number];
