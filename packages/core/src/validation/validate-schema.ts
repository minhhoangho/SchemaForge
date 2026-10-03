import { sortByPathThenCode } from "../document-path.js";
import type { SchemaDocument } from "../model/schema-document.js";

import type { Issue } from "./issue-codes.js";
import { validateColumnDefaults } from "./rules/column-defaults.js";
import { validateColumns } from "./rules/columns.js";
import { validateEnums } from "./rules/enums.js";
import { validateNames } from "./rules/names.js";
import { validateRelations } from "./rules/relations.js";
import { validateTables } from "./rules/tables.js";

/*
 * The one module-level state of the validation layer (AI-R57): validating the
 * largest AI document takes over 12 ms, and findIntroducedIssues validates two
 * documents per AI edit, where the "after" of one edit is the "before" of the
 * next. A document is never mutated (parsing freezes it, operations return new
 * objects and its type is deeply readonly), so its reference identifies its
 * issues and a cached entry cannot go stale. A WeakMap keeps no document alive
 * and is not observable apart from the shared, frozen result.
 * ponytail: only helps when the same document object is reused; incremental
 * validation of the changed elements is the upgrade path.
 */
const issuesByDocument = new WeakMap<SchemaDocument, readonly Issue[]>();

/**
 * Returns every semantic issue of a structurally valid schema, sorted by path,
 * then by code (spec section 8). The list is frozen and shared by every call
 * with the same document object.
 */
export function validateSchema(schema: SchemaDocument): readonly Issue[] {
  const cached = issuesByDocument.get(schema);
  if (cached !== undefined) {
    return cached;
  }
  const issues = Object.freeze(
    sortByPathThenCode([
      ...validateNames(schema),
      ...validateTables(schema),
      ...validateColumns(schema),
      ...validateColumnDefaults(schema),
      ...validateRelations(schema),
      ...validateEnums(schema),
    ]),
  );
  issuesByDocument.set(schema, issues);
  return issues;
}
