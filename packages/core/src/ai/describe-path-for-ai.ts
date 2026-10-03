import type { DocumentPath } from "../document-path.js";
import type { SchemaDocument } from "../model/schema-document.js";

const PLAIN_NAME_PATTERN = /^[A-Za-z0-9_]+$/;

// Stands for an element the path names by id but `schema` does not hold, and
// for a note, which has no name; either way no id reaches the model (AI-R16).
const UNKNOWN_NAME = "?";

type PathSegment = DocumentPath[number];

/** Keeps a plain identifier as is; quotes anything else as a JSON string. */
export function formatAiName(name: string): string {
  return PLAIN_NAME_PATTERN.test(name) ? name : JSON.stringify(name);
}

// Object.hasOwn keeps an id such as "constructor" from reaching the prototype (AI-R63).
function lookup<Element>(
  elements: Readonly<Record<string, Element>>,
  id: PathSegment,
): Element | undefined {
  return typeof id === "string" && Object.hasOwn(elements, id)
    ? elements[id]
    : undefined;
}

function nameOf(element: { readonly name: string } | undefined): string {
  return element === undefined ? UNKNOWN_NAME : formatAiName(element.name);
}

function describeTableChild(
  schema: SchemaDocument,
  kind: "columns" | "indexes",
  element: { readonly tableId: string; readonly name: string } | undefined,
): string {
  const table = element && lookup(schema.tables, element.tableId);
  return `tables.${nameOf(table)}.${kind}.${nameOf(element)}`;
}

function describeRelation(schema: SchemaDocument, id: PathSegment): string {
  const relation = lookup(schema.relations, id);
  if (relation === undefined) {
    return `relations.${UNKNOWN_NAME}`;
  }
  const fromColumns = relation.columnPairs.map((pair) =>
    nameOf(lookup(schema.columns, pair.fromColumnId)),
  );
  const fromTable = lookup(schema.tables, relation.fromTableId);
  return `relations.${nameOf(fromTable)}(${fromColumns.join(",")})`;
}

// Returns null when the first segment is not an id-keyed map of the document,
// so the path holds no id and is kept as is.
function describeElement(
  schema: SchemaDocument,
  collection: PathSegment,
  id: PathSegment,
): string | null {
  switch (collection) {
    case "tables":
      return `tables.${nameOf(lookup(schema.tables, id))}`;
    case "columns":
      return describeTableChild(schema, "columns", lookup(schema.columns, id));
    case "indexes":
      return describeTableChild(schema, "indexes", lookup(schema.indexes, id));
    case "relations":
      return describeRelation(schema, id);
    case "enums":
      return `enums.${nameOf(lookup(schema.enums, id))}`;
    case "subjectAreas":
      return `subjectAreas.${nameOf(lookup(schema.subjectAreas, id))}`;
    case "notes":
      return `notes.${UNKNOWN_NAME}`;
    default:
      return null;
  }
}

/**
 * Turns a core document path into a path by names, such as
 * `tables.users.columns.email`, for the `at` of a tool error (AI-R16). The
 * result never contains an id: an id `schema` does not hold becomes `?`.
 */
export function describePathForAi(
  schema: SchemaDocument,
  path: DocumentPath,
): string {
  const [collection, id, ...tail] = path;
  const element =
    collection === undefined || id === undefined
      ? null
      : describeElement(schema, collection, id);
  return element === null ? path.join(".") : [element, ...tail].join(".");
}
