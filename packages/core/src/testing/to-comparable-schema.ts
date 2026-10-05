import type { ColumnType } from "../model/column-type.js";
import type { Column } from "../model/column.js";
import {
  createColumnId,
  createEnumId,
  createIndexId,
  createNoteId,
  createRelationId,
  createSubjectAreaId,
  createTableId,
} from "../model/ids.js";
import type {
  ColumnId,
  EnumId,
  GenerateId,
  IndexId,
  NoteId,
  RelationId,
  SubjectAreaId,
  TableId,
} from "../model/ids.js";
import type { Note } from "../model/note.js";
import {
  sortEnums,
  sortIndexes,
  sortRelations,
  sortSubjectAreas,
  sortTables,
} from "../model/ordering.js";
import type { Position } from "../model/position.js";
import type { Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";
import type { Table } from "../model/table.js";
import { createCounterIdGenerator } from "./factories.js";

const ORIGIN: Position = { x: 0, y: 0 };

type IdMapping<Id extends string> = ReadonlyMap<string, Id>;

type CanonicalIds = {
  readonly tables: IdMapping<TableId>;
  readonly columns: IdMapping<ColumnId>;
  readonly enums: IdMapping<EnumId>;
  readonly subjectAreas: IdMapping<SubjectAreaId>;
  readonly indexes: IdMapping<IndexId>;
  readonly relations: IdMapping<RelationId>;
  readonly notes: IdMapping<NoteId>;
};

function compareCodeUnits(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

// Notes have no name; equal texts at equal positions normalize identically,
// so the id never decides the outcome.
function sortNotesByContent(schema: SchemaDocument): readonly Note[] {
  return Object.values(schema.notes).toSorted(
    (left, right) =>
      compareCodeUnits(left.text, right.text) ||
      left.position.x - right.position.x ||
      left.position.y - right.position.y,
  );
}

// The Map constructor walks the array in order, so ids are drawn in that order.
function assignIds<Id extends string>(
  oldIds: readonly string[],
  createId: (generateId: GenerateId) => Id,
  generateId: GenerateId,
): IdMapping<Id> {
  return new Map(oldIds.map((oldId) => [oldId, createId(generateId)]));
}

function assignCanonicalIds(schema: SchemaDocument): CanonicalIds {
  const generateId = createCounterIdGenerator();
  const tables = sortTables(schema);
  const idsOf = (elements: readonly { readonly id: string }[]): string[] =>
    elements.map((element) => element.id);
  return {
    tables: assignIds(idsOf(tables), createTableId, generateId),
    columns: assignIds(
      tables.flatMap((table) => table.columnIds),
      createColumnId,
      generateId,
    ),
    enums: assignIds(idsOf(sortEnums(schema)), createEnumId, generateId),
    subjectAreas: assignIds(
      idsOf(sortSubjectAreas(schema)),
      createSubjectAreaId,
      generateId,
    ),
    indexes: assignIds(idsOf(sortIndexes(schema)), createIndexId, generateId),
    relations: assignIds(
      idsOf(sortRelations(schema)),
      createRelationId,
      generateId,
    ),
    notes: assignIds(
      idsOf(sortNotesByContent(schema)),
      createNoteId,
      generateId,
    ),
  };
}

function rename<Id extends string>(ids: IdMapping<Id>, oldId: string): Id {
  const newId = ids.get(oldId);
  if (newId === undefined) {
    throw new Error(`toComparableSchema: unknown id ${JSON.stringify(oldId)}`);
  }
  return newId;
}

function keyById<Element extends { readonly id: string }>(
  elements: readonly Element[],
): Readonly<Record<string, Element>> {
  return Object.fromEntries(
    elements
      .toSorted((left, right) => compareCodeUnits(left.id, right.id))
      .map((element) => [element.id, element]),
  );
}

function renameColumnType(type: ColumnType, ids: CanonicalIds): ColumnType {
  return type.kind === "enum"
    ? { kind: "enum", enumId: rename(ids.enums, type.enumId) }
    : type;
}

function renameColumn(column: Column, ids: CanonicalIds): Column {
  return {
    ...column,
    id: rename(ids.columns, column.id),
    tableId: rename(ids.tables, column.tableId),
    type: renameColumnType(column.type, ids),
  };
}

function renameColumnIds(
  columnIds: readonly string[],
  ids: CanonicalIds,
): ColumnId[] {
  return columnIds.map((columnId) => rename(ids.columns, columnId));
}

function renameTable(table: Table, ids: CanonicalIds): Table {
  return {
    ...table,
    id: rename(ids.tables, table.id),
    position: ORIGIN,
    subjectAreaId:
      table.subjectAreaId === null
        ? null
        : rename(ids.subjectAreas, table.subjectAreaId),
    columnIds: renameColumnIds(table.columnIds, ids),
    primaryKeyColumnIds: renameColumnIds(table.primaryKeyColumnIds, ids),
  };
}

function renameRelation(relation: Relation, ids: CanonicalIds): Relation {
  return {
    ...relation,
    id: rename(ids.relations, relation.id),
    fromTableId: rename(ids.tables, relation.fromTableId),
    toTableId: rename(ids.tables, relation.toTableId),
    columnPairs: relation.columnPairs.map((pair) => ({
      fromColumnId: rename(ids.columns, pair.fromColumnId),
      toColumnId: rename(ids.columns, pair.toColumnId),
    })),
  };
}

function renameIndex(index: Index, ids: CanonicalIds): Index {
  return {
    ...index,
    id: rename(ids.indexes, index.id),
    tableId: rename(ids.tables, index.tableId),
    columnIds: renameColumnIds(index.columnIds, ids),
  };
}

/**
 * Normalizes a document for structural comparison in tests (import spec,
 * section 15): ids are reassigned in the deterministic order of core, every
 * reference follows, positions move to the origin, and map keys are sorted.
 */
export function toComparableSchema(document: SchemaDocument): SchemaDocument {
  const ids = assignCanonicalIds(document);
  return {
    ...document,
    tables: keyById(
      Object.values(document.tables).map((table) => renameTable(table, ids)),
    ),
    columns: keyById(
      Object.values(document.columns).map((column) =>
        renameColumn(column, ids),
      ),
    ),
    relations: keyById(
      Object.values(document.relations).map((relation) =>
        renameRelation(relation, ids),
      ),
    ),
    indexes: keyById(
      Object.values(document.indexes).map((index) => renameIndex(index, ids)),
    ),
    enums: keyById(
      Object.values(document.enums).map((element) => ({
        ...element,
        id: rename(ids.enums, element.id),
      })),
    ),
    subjectAreas: keyById(
      Object.values(document.subjectAreas).map((area) => ({
        ...area,
        id: rename(ids.subjectAreas, area.id),
      })),
    ),
    notes: keyById(
      Object.values(document.notes).map((note) => ({
        ...note,
        id: rename(ids.notes, note.id),
        position: ORIGIN,
      })),
    ),
  };
}
