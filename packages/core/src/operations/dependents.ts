import type { ColumnId } from "../model/ids.js";
import type { Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";

function sortById<Element extends { readonly id: string }>(
  elements: readonly Element[],
): readonly Element[] {
  return elements.toSorted((a, b) => {
    if (a.id < b.id) {
      return -1;
    }
    return a.id > b.id ? 1 : 0;
  });
}

/** Indexes that contain at least one of `columnIds`, sorted by id. */
export function findIndexesUsingColumns(
  schema: SchemaDocument,
  columnIds: ReadonlySet<ColumnId>,
): readonly Index[] {
  const indexes = Object.values(schema.indexes).filter((index) =>
    index.columnIds.some((columnId) => columnIds.has(columnId)),
  );
  return sortById(indexes);
}

/** Relations that use at least one of `columnIds` on either side, sorted by id. */
export function findRelationsUsingColumns(
  schema: SchemaDocument,
  columnIds: ReadonlySet<ColumnId>,
): readonly Relation[] {
  const relations = Object.values(schema.relations).filter((relation) =>
    relation.columnPairs.some(
      (pair) =>
        columnIds.has(pair.fromColumnId) || columnIds.has(pair.toColumnId),
    ),
  );
  return sortById(relations);
}
