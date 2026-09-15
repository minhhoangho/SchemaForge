import { z } from "zod";

import { columnFieldsShape, columnShape } from "../model/column.js";
import { enumFieldsShape, enumShape } from "../model/enum.js";
import {
  columnIdShape,
  enumIdShape,
  indexIdShape,
  noteIdShape,
  relationIdShape,
  subjectAreaIdShape,
  tableIdShape,
} from "../model/ids.js";
import { noteFieldsShape, noteShape } from "../model/note.js";
import { positionShape } from "../model/position.js";
import { relationFieldsShape, relationShape } from "../model/relation.js";
import { indexFieldsShape, indexShape } from "../model/table-index.js";
import {
  subjectAreaFieldsShape,
  subjectAreaShape,
} from "../model/subject-area.js";
import { tableFieldsShape } from "../model/table.js";

const NON_NEGATIVE = 0;

// The 25 non-recursive operation shapes from spec section 9. `batch` is the
// one recursive case and lives in operation.ts.

export const renameSchemaOperationShape = z.strictObject({
  type: z.literal("renameSchema"),
  name: z.string(),
});

// A new table never carries columns or a primary key yet.
export const addTableOperationShape = z.strictObject({
  type: z.literal("addTable"),
  table: tableFieldsShape
    .omit({ columnIds: true, primaryKeyColumnIds: true })
    .readonly(),
});

export const updateTableOperationShape = z.strictObject({
  type: z.literal("updateTable"),
  tableId: tableIdShape,
  changes: tableFieldsShape
    .pick({ name: true, comment: true, subjectAreaId: true })
    .partial()
    .readonly(),
});

export const setPrimaryKeyOperationShape = z.strictObject({
  type: z.literal("setPrimaryKey"),
  tableId: tableIdShape,
  columnIds: z.array(columnIdShape).readonly(),
});

export const removeTableOperationShape = z.strictObject({
  type: z.literal("removeTable"),
  tableId: tableIdShape,
});

export const addColumnOperationShape = z.strictObject({
  type: z.literal("addColumn"),
  column: columnShape,
  insertAt: z.int().min(NON_NEGATIVE),
});

export const updateColumnOperationShape = z.strictObject({
  type: z.literal("updateColumn"),
  columnId: columnIdShape,
  changes: columnFieldsShape
    .omit({ id: true, tableId: true })
    .partial()
    .readonly(),
});

export const moveColumnOperationShape = z.strictObject({
  type: z.literal("moveColumn"),
  columnId: columnIdShape,
  toIndex: z.int().min(NON_NEGATIVE),
});

export const removeColumnOperationShape = z.strictObject({
  type: z.literal("removeColumn"),
  columnId: columnIdShape,
});

export const addRelationOperationShape = z.strictObject({
  type: z.literal("addRelation"),
  relation: relationShape,
});

export const updateRelationOperationShape = z.strictObject({
  type: z.literal("updateRelation"),
  relationId: relationIdShape,
  changes: relationFieldsShape
    .pick({ kind: true, columnPairs: true, onDelete: true, onUpdate: true })
    .partial()
    .readonly(),
});

export const removeRelationOperationShape = z.strictObject({
  type: z.literal("removeRelation"),
  relationId: relationIdShape,
});

export const addIndexOperationShape = z.strictObject({
  type: z.literal("addIndex"),
  index: indexShape,
});

export const updateIndexOperationShape = z.strictObject({
  type: z.literal("updateIndex"),
  indexId: indexIdShape,
  changes: indexFieldsShape
    .pick({ name: true, columnIds: true, isUnique: true })
    .partial()
    .readonly(),
});

export const removeIndexOperationShape = z.strictObject({
  type: z.literal("removeIndex"),
  indexId: indexIdShape,
});

export const addEnumOperationShape = z.strictObject({
  type: z.literal("addEnum"),
  enum: enumShape,
});

export const updateEnumOperationShape = z.strictObject({
  type: z.literal("updateEnum"),
  enumId: enumIdShape,
  changes: enumFieldsShape
    .pick({ name: true, values: true })
    .partial()
    .readonly(),
});

export const removeEnumOperationShape = z.strictObject({
  type: z.literal("removeEnum"),
  enumId: enumIdShape,
});

export const addSubjectAreaOperationShape = z.strictObject({
  type: z.literal("addSubjectArea"),
  subjectArea: subjectAreaShape,
});

// name is required here, unlike the other updateX shapes: a subject area
// with an empty name is meaningless, so partial() would allow a no-op.
export const updateSubjectAreaOperationShape = z.strictObject({
  type: z.literal("updateSubjectArea"),
  subjectAreaId: subjectAreaIdShape,
  changes: subjectAreaFieldsShape.pick({ name: true }).readonly(),
});

export const removeSubjectAreaOperationShape = z.strictObject({
  type: z.literal("removeSubjectArea"),
  subjectAreaId: subjectAreaIdShape,
});

export const addNoteOperationShape = z.strictObject({
  type: z.literal("addNote"),
  note: noteShape,
});

export const updateNoteOperationShape = z.strictObject({
  type: z.literal("updateNote"),
  noteId: noteIdShape,
  changes: noteFieldsShape.pick({ text: true }).readonly(),
});

export const removeNoteOperationShape = z.strictObject({
  type: z.literal("removeNote"),
  noteId: noteIdShape,
});

const elementMoveShape = z
  .strictObject({
    // Prefix distinguishes a table id from a note id; a column id is neither.
    elementId: z.union([tableIdShape, noteIdShape]),
    position: positionShape,
  })
  .readonly();

export const moveElementsOperationShape = z.strictObject({
  type: z.literal("moveElements"),
  moves: z.array(elementMoveShape).readonly(),
});
