import { sortByPathThenCode } from "../document-path.js";
import type { SchemaDocument } from "../model/schema-document.js";

import type { Issue } from "./issue-codes.js";
import { validateColumnDefaults } from "./rules/column-defaults.js";
import { validateColumns } from "./rules/columns.js";
import { validateEnums } from "./rules/enums.js";
import { validateNames } from "./rules/names.js";
import { validateRelations } from "./rules/relations.js";

/** Returns every semantic issue of a structurally valid schema, sorted by path, then by code (spec section 8). */
export function validateSchema(schema: SchemaDocument): readonly Issue[] {
  return sortByPathThenCode([
    ...validateNames(schema),
    ...validateColumns(schema),
    ...validateColumnDefaults(schema),
    ...validateRelations(schema),
    ...validateEnums(schema),
  ]);
}
