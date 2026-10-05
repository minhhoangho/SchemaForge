import {
  createColumnId,
  createEnumId,
  createIndexId,
  createNoteId,
  createRelationId,
  createSubjectAreaId,
  createTableId,
} from "../../model/ids.js";
import type {
  ColumnId,
  EnumId,
  GenerateId,
  IndexId,
  NoteId,
  RelationId,
  SubjectAreaId,
  TableId,
} from "../../model/ids.js";
import type { ImportDraft } from "./import-draft.js";
import { elementAt } from "./resolve-references.js";
import type { ResolvedDraft } from "./resolve-references.js";

// Ids follow kept-element order; the maps go from a draft position to the id
// and have no entry for a dropped element.
export type AssignedIds = {
  readonly enums: readonly EnumId[];
  readonly tables: readonly TableId[];
  readonly columns: readonly (readonly ColumnId[])[];
  readonly indexes: readonly IndexId[];
  readonly relations: readonly RelationId[];
  readonly subjectAreas: readonly SubjectAreaId[];
  readonly notes: readonly NoteId[];
  readonly columnsByDraft: readonly ReadonlyMap<number, ColumnId>[];
  readonly indexesByDraft: ReadonlyMap<number, IndexId>;
  readonly relationsByDraft: ReadonlyMap<number, RelationId>;
};

function mapDraftPositions<Id>(
  kept: readonly { readonly draftIndex: number }[],
  ids: readonly Id[],
): ReadonlyMap<number, Id> {
  return new Map(
    kept.map(({ draftIndex }, position) => [
      draftIndex,
      elementAt(ids, position),
    ]),
  );
}

/**
 * Assigns ids to the kept elements in the documented order (spec section 1):
 * enums, tables, columns table by table, indexes, relations, subject areas,
 * notes.
 */
export function assignImportIds(
  draft: ImportDraft,
  resolved: ResolvedDraft,
  generateId: GenerateId,
): AssignedIds {
  const enums = draft.enums.map(() => createEnumId(generateId));
  const tables = resolved.tables.map(() => createTableId(generateId));
  const columns = resolved.tables.map((table) =>
    table.columns.map(() => createColumnId(generateId)),
  );
  const indexes = resolved.indexes.map(() => createIndexId(generateId));
  const relations = resolved.relations.map(() => createRelationId(generateId));
  return {
    enums,
    tables,
    columns,
    indexes,
    relations,
    subjectAreas: draft.subjectAreas.map(() => createSubjectAreaId(generateId)),
    notes: draft.notes.map(() => createNoteId(generateId)),
    columnsByDraft: resolved.tables.map((table, tableIndex) =>
      mapDraftPositions(table.columns, elementAt(columns, tableIndex)),
    ),
    indexesByDraft: mapDraftPositions(resolved.indexes, indexes),
    relationsByDraft: mapDraftPositions(resolved.relations, relations),
  };
}
