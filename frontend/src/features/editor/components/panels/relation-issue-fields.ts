import type { DocumentPath, Issue, RelationId } from "@schemaforge/core";

const RELATION_FIELDS = [
  "kind",
  "columnPairs",
  "onDelete",
  "onUpdate",
] as const;

export type RelationField = (typeof RELATION_FIELDS)[number];

// Relation issue paths are ["relations", relationId, field, ...]; a column pair
// issue adds the index of the pair after the field (core `relations` rule).
const FIELD_SEGMENT_INDEX = 2;
const PAIR_SEGMENT_INDEX = 3;

function isRelationField(
  segment: DocumentPath[number] | undefined,
): segment is RelationField {
  return RELATION_FIELDS.some((field) => field === segment);
}

/**
 * Returns the panel field an issue of the relation belongs to, or `null` when
 * the path names no field the panel shows (the panel lists those at its top).
 */
export function fieldOfIssue(issue: Issue): RelationField | null {
  const segment = issue.path[FIELD_SEGMENT_INDEX];
  return isRelationField(segment) ? segment : null;
}

/** Returns the index of the column pair an issue points at, if any. */
export function pairIndexOfIssue(issue: Issue): number | null {
  if (fieldOfIssue(issue) !== "columnPairs") {
    return null;
  }
  const segment = issue.path[PAIR_SEGMENT_INDEX];
  return typeof segment === "number" ? segment : null;
}

export function issuesOfField(
  issues: readonly Issue[],
  field: RelationField | null,
): readonly Issue[] {
  return issues.filter((issue) => fieldOfIssue(issue) === field);
}

/** The path of a relation field, as issues and focus requests name it. */
export function relationFieldPath(
  relationId: RelationId,
  field: RelationField,
): DocumentPath {
  return ["relations", relationId, field];
}

/** The path of one column pair, as its type mismatch issue names it. */
export function columnPairPath(
  relationId: RelationId,
  pairIndex: number,
): DocumentPath {
  return [...relationFieldPath(relationId, "columnPairs"), pairIndex];
}

/** Joins the ids given for `aria-describedby`, or `undefined` when none is. */
export function joinIds(
  ids: readonly (string | undefined)[],
): string | undefined {
  const present = ids.filter((id) => id !== undefined);
  return present.length === 0 ? undefined : present.join(" ");
}
