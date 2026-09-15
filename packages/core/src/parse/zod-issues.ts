import type { z } from "zod";

import { sortByPathThenCode } from "../document-path.js";
import type { DocumentPath } from "../document-path.js";
import type { StructuralError } from "../error-codes.js";

// Zod issue paths are PropertyKey[]; JSON has no symbol keys, so any symbol
// segment can only come from a check written against a non-JSON value.
function isDocumentPathSegment(
  segment: PropertyKey,
): segment is string | number {
  return typeof segment !== "symbol";
}

function toDocumentPath(path: readonly PropertyKey[]): DocumentPath {
  return path.filter(isDocumentPathSegment);
}

// unrecognized_keys reports every extra key on an object as one issue; each
// key becomes its own error so the frontend can point at it individually.
function toIssueErrors(issue: z.core.$ZodIssue): readonly StructuralError[] {
  const path = toDocumentPath(issue.path);
  if (issue.code === "unrecognized_keys") {
    return issue.keys.map((key) => ({
      code: "invalid-shape" as const,
      path: [...path, key],
    }));
  }
  return [{ code: "invalid-shape" as const, path }];
}

function dedupeByPath(
  errors: readonly StructuralError[],
): readonly StructuralError[] {
  const seenPaths = new Set<string>();
  const deduped: StructuralError[] = [];
  errors.forEach((error) => {
    const pathKey = JSON.stringify(error.path);
    if (seenPaths.has(pathKey)) {
      return;
    }
    seenPaths.add(pathKey);
    deduped.push(error);
  });
  return deduped;
}

// Never surfaces issue.message: core owns error codes, the frontend owns text.
export function toStructuralErrors(
  issues: readonly z.core.$ZodIssue[],
): readonly StructuralError[] {
  return sortByPathThenCode(dedupeByPath(issues.flatMap(toIssueErrors)));
}
