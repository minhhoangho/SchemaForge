import type { DocumentPath } from "../document-path.js";
import type { ImportDiagnosticCode } from "../importers/shared/import-diagnostic-codes.js";
import { createImportDiagnostic } from "../importers/shared/import-diagnostics.js";
import type { ImportDiagnostic } from "../importers/shared/import-types.js";
import type { Column } from "../model/column.js";
import type { ColumnType } from "../model/column-type.js";
import type { Enum } from "../model/enum.js";
import type {
  ColumnId,
  EnumId,
  GenerateId,
  SubjectAreaId,
  TableId,
} from "../model/ids.js";
import {
  createColumnId,
  createEnumId,
  createIndexId,
  createNoteId,
  createRelationId,
  createSubjectAreaId,
  createTableId,
} from "../model/ids.js";
import { toNameKey } from "../model/name-limits.js";
import type { Note } from "../model/note.js";
import {
  sortEnums,
  sortIndexes,
  sortNotes,
  sortRelations,
  sortSubjectAreas,
  sortTables,
} from "../model/ordering.js";
import type { Position } from "../model/position.js";
import type { Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { SubjectArea } from "../model/subject-area.js";
import type { Index } from "../model/table-index.js";
import type { Table } from "../model/table.js";
import { pickUnusedName } from "./pick-unused-name.js";

export type MergedDocument = {
  readonly document: SchemaDocument;
  /** One `*-renamed` diagnostic per renamed element, not yet finalized. */
  readonly diagnostics: readonly ImportDiagnostic[];
};

// Built fresh for every call; nothing here outlives remapMergedDocument.
// The name sets hold the name keys taken per namespace: tables and enums share
// one, and index names also avoid table names so a merge never adds
// index-name-conflicts-table, like suggestIndexName.
type MergeContext = {
  readonly generateId: GenerateId;
  readonly tableAndEnumNames: Set<string>;
  readonly indexNames: Set<string>;
  readonly subjectAreaNames: Set<string>;
  readonly diagnostics: ImportDiagnostic[];
  readonly enumIds: Map<EnumId, EnumId>;
  readonly subjectAreaIds: Map<SubjectAreaId, SubjectAreaId>;
  readonly tableIds: Map<TableId, TableId>;
  readonly columnIds: Map<ColumnId, ColumnId>;
  readonly moveBy: Position;
};

function lookupNewId<Id extends string>(ids: ReadonlyMap<Id, Id>, id: Id): Id {
  const newId = ids.get(id);
  if (newId === undefined) {
    // A parsed document never references a missing element.
    throw new Error(`Imported element ${id} has no new id`);
  }
  return newId;
}

function nameKeys(elements: readonly { readonly name: string }[]): Set<string> {
  return new Set(elements.map((element) => toNameKey(element.name)));
}

function createMergeContext(
  target: SchemaDocument,
  moveBy: Position,
  generateId: GenerateId,
): MergeContext {
  const tables = Object.values(target.tables);
  return {
    generateId,
    tableAndEnumNames: nameKeys([...tables, ...Object.values(target.enums)]),
    indexNames: nameKeys([...Object.values(target.indexes), ...tables]),
    subjectAreaNames: nameKeys(Object.values(target.subjectAreas)),
    diagnostics: [],
    enumIds: new Map(),
    subjectAreaIds: new Map(),
    tableIds: new Map(),
    columnIds: new Map(),
    moveBy,
  };
}

function claimName(
  context: MergeContext,
  scope: Set<string>,
  name: string,
  diagnostic: {
    readonly code: ImportDiagnosticCode;
    readonly path: DocumentPath;
  },
): string {
  const claimed = pickUnusedName(name, scope);
  scope.add(toNameKey(claimed));
  if (claimed !== name) {
    context.diagnostics.push(
      createImportDiagnostic(diagnostic.code, null, diagnostic.path),
    );
  }
  return claimed;
}

// Subtracting the corner first makes the corner element land exactly on
// origin, with no floating point drift.
function computeMoveBy(imported: SchemaDocument, origin: Position): Position {
  const positions = [
    ...Object.values(imported.tables),
    ...Object.values(imported.notes),
  ].map((element) => element.position);
  if (positions.length === 0) {
    return { x: 0, y: 0 };
  }
  const minX = positions.reduce((min, { x }) => Math.min(min, x), Infinity);
  const minY = positions.reduce((min, { y }) => Math.min(min, y), Infinity);
  return { x: origin.x - minX, y: origin.y - minY };
}

function move(position: Position, moveBy: Position): Position {
  return { x: position.x + moveBy.x, y: position.y + moveBy.y };
}

function remapEnum(context: MergeContext, element: Enum): Enum {
  const id = createEnumId(context.generateId);
  context.enumIds.set(element.id, id);
  const name = claimName(context, context.tableAndEnumNames, element.name, {
    code: "enum-renamed",
    path: ["enums", id, "name"],
  });
  return { ...element, id, name };
}

function remapSubjectArea(
  context: MergeContext,
  element: SubjectArea,
): SubjectArea {
  const id = createSubjectAreaId(context.generateId);
  context.subjectAreaIds.set(element.id, id);
  const name = claimName(context, context.subjectAreaNames, element.name, {
    code: "subject-area-renamed",
    path: ["subjectAreas", id, "name"],
  });
  return { ...element, id, name };
}

function remapColumnType(context: MergeContext, type: ColumnType): ColumnType {
  return type.kind === "enum"
    ? { kind: "enum", enumId: lookupNewId(context.enumIds, type.enumId) }
    : type;
}

function remapColumn(
  context: MergeContext,
  imported: SchemaDocument,
  tableId: TableId,
  columnId: ColumnId,
): Column {
  const column = imported.columns[columnId];
  if (column === undefined) {
    throw new Error(`Imported column ${columnId} does not exist`);
  }
  const id = createColumnId(context.generateId);
  context.columnIds.set(columnId, id);
  return {
    ...column,
    id,
    tableId,
    type: remapColumnType(context, column.type),
  };
}

// Returns the table and its columns; a table's ids are drawn right before
// those of its columns.
function remapTable(
  context: MergeContext,
  imported: SchemaDocument,
  table: Table,
): readonly [Table, readonly Column[]] {
  const id = createTableId(context.generateId);
  context.tableIds.set(table.id, id);
  const name = claimName(context, context.tableAndEnumNames, table.name, {
    code: "table-renamed",
    path: ["tables", id, "name"],
  });
  context.indexNames.add(toNameKey(name));
  const columns = table.columnIds.map((columnId) =>
    remapColumn(context, imported, id, columnId),
  );
  const remapped: Table = {
    ...table,
    id,
    name,
    position: move(table.position, context.moveBy),
    subjectAreaId:
      table.subjectAreaId === null
        ? null
        : lookupNewId(context.subjectAreaIds, table.subjectAreaId),
    columnIds: columns.map((column) => column.id),
    primaryKeyColumnIds: table.primaryKeyColumnIds.map((columnId) =>
      lookupNewId(context.columnIds, columnId),
    ),
  };
  return [remapped, columns];
}

function remapIndex(context: MergeContext, index: Index): Index {
  const id = createIndexId(context.generateId);
  const name = claimName(context, context.indexNames, index.name, {
    code: "index-renamed",
    path: ["indexes", id, "name"],
  });
  return {
    ...index,
    id,
    name,
    tableId: lookupNewId(context.tableIds, index.tableId),
    columnIds: index.columnIds.map((columnId) =>
      lookupNewId(context.columnIds, columnId),
    ),
  };
}

function remapRelation(context: MergeContext, relation: Relation): Relation {
  return {
    ...relation,
    id: createRelationId(context.generateId),
    fromTableId: lookupNewId(context.tableIds, relation.fromTableId),
    toTableId: lookupNewId(context.tableIds, relation.toTableId),
    columnPairs: relation.columnPairs.map((pair) => ({
      fromColumnId: lookupNewId(context.columnIds, pair.fromColumnId),
      toColumnId: lookupNewId(context.columnIds, pair.toColumnId),
    })),
  };
}

function remapNote(context: MergeContext, note: Note): Note {
  const id = createNoteId(context.generateId);
  return { ...note, id, position: move(note.position, context.moveBy) };
}

function keyById<Element extends { readonly id: string }>(
  elements: readonly Element[],
): Readonly<Record<string, Element>> {
  return Object.fromEntries(elements.map((element) => [element.id, element]));
}

/**
 * Rewrites `imported` for a merge into `target`: every element gets a fresh id
 * from `generateId` and every reference follows it, names that clash with the
 * target or with a name given out earlier get a `_2`, `_3`… suffix, and tables
 * and notes move so their top left corner is at `origin`. Ids are drawn, and
 * names claimed, kind by kind in step order and within a kind in the sort*
 * order of `imported`, so the result depends only on the inputs.
 */
export function remapMergedDocument(
  target: SchemaDocument,
  imported: SchemaDocument,
  origin: Position,
  generateId: GenerateId,
): MergedDocument {
  const moveBy = computeMoveBy(imported, origin);
  const context = createMergeContext(target, moveBy, generateId);
  const enums = sortEnums(imported).map((element) =>
    remapEnum(context, element),
  );
  const subjectAreas = sortSubjectAreas(imported).map((element) =>
    remapSubjectArea(context, element),
  );
  const tables = sortTables(imported).map((table) =>
    remapTable(context, imported, table),
  );
  const document: SchemaDocument = {
    ...imported,
    enums: keyById(enums),
    subjectAreas: keyById(subjectAreas),
    tables: keyById(tables.map(([table]) => table)),
    columns: keyById(tables.flatMap(([, columns]) => columns)),
    indexes: keyById(
      sortIndexes(imported).map((index) => remapIndex(context, index)),
    ),
    relations: keyById(
      sortRelations(imported).map((relation) =>
        remapRelation(context, relation),
      ),
    ),
    notes: keyById(sortNotes(imported).map((note) => remapNote(context, note))),
  };
  return { document, diagnostics: context.diagnostics };
}
