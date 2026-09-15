import { z } from "zod";

import {
  addColumnOperationShape,
  addEnumOperationShape,
  addIndexOperationShape,
  addNoteOperationShape,
  addRelationOperationShape,
  addSubjectAreaOperationShape,
  addTableOperationShape,
  moveColumnOperationShape,
  moveElementsOperationShape,
  removeColumnOperationShape,
  removeEnumOperationShape,
  removeIndexOperationShape,
  removeNoteOperationShape,
  removeRelationOperationShape,
  removeSubjectAreaOperationShape,
  removeTableOperationShape,
  renameSchemaOperationShape,
  setPrimaryKeyOperationShape,
  updateColumnOperationShape,
  updateEnumOperationShape,
  updateIndexOperationShape,
  updateNoteOperationShape,
  updateRelationOperationShape,
  updateSubjectAreaOperationShape,
  updateTableOperationShape,
} from "./step-operation-shapes.js";

// The 25 non-recursive operation shapes; `batch`, the one recursive case, is
// added below and kept out of this list so its type can be written by hand.
const stepOperationShapes = [
  renameSchemaOperationShape,
  addTableOperationShape,
  updateTableOperationShape,
  setPrimaryKeyOperationShape,
  removeTableOperationShape,
  addColumnOperationShape,
  updateColumnOperationShape,
  moveColumnOperationShape,
  removeColumnOperationShape,
  addRelationOperationShape,
  updateRelationOperationShape,
  removeRelationOperationShape,
  addIndexOperationShape,
  updateIndexOperationShape,
  removeIndexOperationShape,
  addEnumOperationShape,
  updateEnumOperationShape,
  removeEnumOperationShape,
  addSubjectAreaOperationShape,
  updateSubjectAreaOperationShape,
  removeSubjectAreaOperationShape,
  addNoteOperationShape,
  updateNoteOperationShape,
  removeNoteOperationShape,
  moveElementsOperationShape,
] as const;

type StepOperation = Readonly<z.infer<(typeof stepOperationShapes)[number]>>;

export type BatchOperation = {
  readonly type: "batch";
  readonly operations: readonly Operation[];
};

// TypeScript cannot infer a recursive type through a getter (z.lazy), so the
// recursive union is written by hand; the 25 step types still come from Zod.
export type Operation = StepOperation | BatchOperation;

const batchOperationShape = z.strictObject({
  type: z.literal("batch"),
  operations: z
    .array(z.lazy((): z.ZodType<Operation> => operationShape))
    .readonly(),
});

// discriminatedUnion (not union) keeps nested error paths precise, e.g.
// ["operations", 1, "type"], instead of collapsing to invalid_union at [].
export const operationShape: z.ZodType<Operation> = z
  .discriminatedUnion("type", [...stepOperationShapes, batchOperationShape])
  .readonly();

export type OperationType = Operation["type"];

export type OperationOfType<T extends OperationType> = Extract<
  Operation,
  { readonly type: T }
>;

export type TableOperation = OperationOfType<
  "addTable" | "updateTable" | "setPrimaryKey" | "removeTable"
>;

export type ColumnOperation = OperationOfType<
  "addColumn" | "updateColumn" | "moveColumn" | "removeColumn"
>;

export type RelationOperation = OperationOfType<
  "addRelation" | "updateRelation" | "removeRelation"
>;

export type IndexOperation = OperationOfType<
  "addIndex" | "updateIndex" | "removeIndex"
>;

export type EnumOperation = OperationOfType<
  "addEnum" | "updateEnum" | "removeEnum"
>;

export type SubjectAreaOperation = OperationOfType<
  "addSubjectArea" | "updateSubjectArea" | "removeSubjectArea"
>;

export type NoteOperation = OperationOfType<
  "addNote" | "updateNote" | "removeNote"
>;
