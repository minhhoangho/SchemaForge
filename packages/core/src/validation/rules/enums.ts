import { sortByPathThenCode } from "../../document-path.js";
import type { DocumentPath } from "../../document-path.js";
import { toNameKey } from "../../model/name-limits.js";
import type { Enum } from "../../model/enum.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Issue } from "../issue-codes.js";

function findEmptyValuesIssues(enumDefinition: Enum): readonly Issue[] {
  return enumDefinition.values.length === 0
    ? [
        {
          code: "enum-values-empty",
          path: ["enums", enumDefinition.id, "values"],
        },
      ]
    : [];
}

// Groups value indexes by case-insensitive key; an empty value never joins a
// group, matching how MySQL and SQL Server collate enum labels.
function groupValueIndexesByNameKey(
  values: readonly string[],
): ReadonlyMap<string, readonly number[]> {
  const groups = new Map<string, number[]>();
  values.forEach((value, index) => {
    const nameKey = toNameKey(value);
    if (nameKey.length === 0) {
      return;
    }
    const indexes = groups.get(nameKey);
    if (indexes === undefined) {
      groups.set(nameKey, [index]);
    } else {
      indexes.push(index);
    }
  });
  return groups;
}

function findDuplicateValueIssues(enumDefinition: Enum): readonly Issue[] {
  const groups = groupValueIndexesByNameKey(enumDefinition.values);
  const issues: Issue[] = [];
  for (const indexes of groups.values()) {
    if (indexes.length < 2) {
      continue;
    }
    for (const index of indexes) {
      const path: DocumentPath = ["enums", enumDefinition.id, "values", index];
      issues.push({ code: "enum-value-duplicate", path });
    }
  }
  return issues;
}

/** Validates enum value lists (spec section 6): non-empty and free of duplicates. */
export function validateEnums(schema: SchemaDocument): readonly Issue[] {
  const issues: Issue[] = [];
  for (const enumDefinition of Object.values(schema.enums)) {
    issues.push(...findEmptyValuesIssues(enumDefinition));
    issues.push(...findDuplicateValueIssues(enumDefinition));
  }
  return sortByPathThenCode(issues);
}
