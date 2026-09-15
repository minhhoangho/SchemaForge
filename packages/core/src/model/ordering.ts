import type { Enum } from "./enum.js";
import { toNameKey } from "./name-limits.js";
import type { Note } from "./note.js";
import type { Relation } from "./relation.js";
import type { SchemaDocument } from "./schema-document.js";
import type { SubjectArea } from "./subject-area.js";
import type { Index } from "./table-index.js";
import type { Table } from "./table.js";

type IdentifiedElement = { readonly id: string };

type NamedElement = IdentifiedElement & { readonly name: string };

// A structurally valid document never has a dangling reference; if one slips
// through, it sorts first and the id tie-break still keeps the order total.
const UNKNOWN_POSITION = -1;

// `<` and `>` compare UTF-16 code units, so the order never depends on locale.
function compareCodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

function compareById(
  left: IdentifiedElement,
  right: IdentifiedElement,
): number {
  return compareCodeUnits(left.id, right.id);
}

function compareByName(left: NamedElement, right: NamedElement): number {
  return (
    compareCodeUnits(toNameKey(left.name), toNameKey(right.name)) ||
    compareCodeUnits(left.name, right.name) ||
    compareById(left, right)
  );
}

function sortByName<Element extends NamedElement>(
  elements: readonly Element[],
): readonly Element[] {
  return elements.toSorted(compareByName);
}

function positionsById(
  elements: readonly IdentifiedElement[],
): ReadonlyMap<string, number> {
  return new Map(elements.map((element, position) => [element.id, position]));
}

function positionOf(
  positions: ReadonlyMap<string, number>,
  id: string,
): number {
  return positions.get(id) ?? UNKNOWN_POSITION;
}

function firstForeignKeyColumnPosition(
  schema: SchemaDocument,
  relation: Relation,
): number {
  const firstPair = relation.columnPairs[0];
  const fromTable = schema.tables[relation.fromTableId];
  if (firstPair === undefined || fromTable === undefined) {
    return UNKNOWN_POSITION;
  }
  return fromTable.columnIds.indexOf(firstPair.fromColumnId);
}

/** Tables by case-insensitive name, then exact name, then id. */
export function sortTables(schema: SchemaDocument): readonly Table[] {
  return sortByName(Object.values(schema.tables));
}

/** Enums by case-insensitive name, then exact name, then id. */
export function sortEnums(schema: SchemaDocument): readonly Enum[] {
  return sortByName(Object.values(schema.enums));
}

/** Subject areas by case-insensitive name, then exact name, then id. */
export function sortSubjectAreas(
  schema: SchemaDocument,
): readonly SubjectArea[] {
  return sortByName(Object.values(schema.subjectAreas));
}

/** Indexes by the order of their table in `sortTables`, then by name, then id. */
export function sortIndexes(schema: SchemaDocument): readonly Index[] {
  const tablePositions = positionsById(sortTables(schema));
  return Object.values(schema.indexes).toSorted(
    (left, right) =>
      positionOf(tablePositions, left.tableId) -
        positionOf(tablePositions, right.tableId) || compareByName(left, right),
  );
}

/**
 * Relations by the order of their foreign key table in `sortTables`, then by
 * the position of their first foreign key column in that table, then by id.
 */
export function sortRelations(schema: SchemaDocument): readonly Relation[] {
  const tablePositions = positionsById(sortTables(schema));
  return Object.values(schema.relations).toSorted(
    (left, right) =>
      positionOf(tablePositions, left.fromTableId) -
        positionOf(tablePositions, right.fromTableId) ||
      firstForeignKeyColumnPosition(schema, left) -
        firstForeignKeyColumnPosition(schema, right) ||
      compareById(left, right),
  );
}

/** Notes by id: they have no name to sort by. */
export function sortNotes(schema: SchemaDocument): readonly Note[] {
  return Object.values(schema.notes).toSorted(compareById);
}
