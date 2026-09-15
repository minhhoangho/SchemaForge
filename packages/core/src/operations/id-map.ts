import type { Column } from "../model/column.js";
import type { Enum } from "../model/enum.js";
import type {
  ColumnId,
  EnumId,
  IndexId,
  NoteId,
  RelationId,
  SubjectAreaId,
  TableId,
} from "../model/ids.js";
import type { Note } from "../model/note.js";
import type { Relation } from "../model/relation.js";
import type { IdMap } from "../model/schema-document.js";
import type { SubjectArea } from "../model/subject-area.js";
import type { Index } from "../model/table-index.js";
import type { Table } from "../model/table.js";

/** Returns a copy of `map` with `id` added (or replaced) with `value`. */
export function withEntry<K extends string, V>(
  map: IdMap<K, V>,
  id: K,
  value: V,
): IdMap<K, V> {
  return { ...map, [id]: value };
}

export function withoutIds(
  map: IdMap<TableId, Table>,
  ids: readonly TableId[],
): IdMap<TableId, Table>;
export function withoutIds(
  map: IdMap<ColumnId, Column>,
  ids: readonly ColumnId[],
): IdMap<ColumnId, Column>;
export function withoutIds(
  map: IdMap<RelationId, Relation>,
  ids: readonly RelationId[],
): IdMap<RelationId, Relation>;
export function withoutIds(
  map: IdMap<IndexId, Index>,
  ids: readonly IndexId[],
): IdMap<IndexId, Index>;
export function withoutIds(
  map: IdMap<EnumId, Enum>,
  ids: readonly EnumId[],
): IdMap<EnumId, Enum>;
export function withoutIds(
  map: IdMap<SubjectAreaId, SubjectArea>,
  ids: readonly SubjectAreaId[],
): IdMap<SubjectAreaId, SubjectArea>;
export function withoutIds(
  map: IdMap<NoteId, Note>,
  ids: readonly NoteId[],
): IdMap<NoteId, Note>;
/** Returns a copy of `map` with every id in `ids` removed. Keys not listed keep their reference. */
export function withoutIds(
  map: Readonly<Record<string, { readonly id: string }>>,
  ids: readonly string[],
): Readonly<Record<string, { readonly id: string }>> {
  const idsToRemove = new Set(ids);
  return Object.fromEntries(
    Object.entries(map).filter(([key]) => !idsToRemove.has(key)),
  );
}
