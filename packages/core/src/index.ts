export type { DocumentPath } from "./document-path.js";
export type {
  ErrorCode,
  OperationError,
  OperationErrorCode,
  StructuralError,
  StructuralErrorCode,
} from "./error-codes.js";
export { ERROR_CODES } from "./error-codes.js";
export type { History, HistoryEntry } from "./history/history.js";
export {
  createEmptyHistory,
  recordEntry,
  redo,
  undo,
} from "./history/history.js";
export { mergeLastEntry } from "./history/merge-last-entry.js";
export type { Column } from "./model/column.js";
export type { ColumnDefault } from "./model/column-default.js";
export type { ColumnType } from "./model/column-type.js";
export { createEmptySchema } from "./model/create-empty-schema.js";
export type { Enum } from "./model/enum.js";
export type {
  ColumnId,
  EnumId,
  GenerateId,
  IndexId,
  NoteId,
  RelationId,
  SubjectAreaId,
  TableId,
} from "./model/ids.js";
export {
  createColumnId,
  createEnumId,
  createIndexId,
  createNoteId,
  createRelationId,
  createSubjectAreaId,
  createTableId,
} from "./model/ids.js";
export type { Note } from "./model/note.js";
export {
  sortEnums,
  sortIndexes,
  sortNotes,
  sortRelations,
  sortSubjectAreas,
  sortTables,
} from "./model/ordering.js";
export type { Position } from "./model/position.js";
export type {
  ColumnPair,
  ReferentialAction,
  Relation,
  RelationKind,
} from "./model/relation.js";
export type { IdMap, SchemaDocument } from "./model/schema-document.js";
export { CURRENT_SCHEMA_VERSION } from "./model/schema-document.js";
export type { SubjectArea } from "./model/subject-area.js";
export type { Index } from "./model/table-index.js";
export type { Table } from "./model/table.js";
export { applyOperation } from "./operations/apply-operation.js";
export type { AppliedOperation } from "./operations/apply-result.js";
export type { ManyToManyInput } from "./operations/build-many-to-many.js";
export { buildManyToMany } from "./operations/build-many-to-many.js";
export type { RelationInput } from "./operations/build-relation.js";
export { buildRelation } from "./operations/build-relation.js";
export type {
  BatchOperation,
  Operation,
  OperationOfType,
  OperationType,
} from "./operations/operation.js";
export { suggestIndexName } from "./operations/suggest-index-name.js";
export { MAX_BATCH_DEPTH, parseOperation } from "./parse/parse-operation.js";
export { parseSchemaDocument } from "./parse/parse-schema-document.js";
export type { Result } from "./result.js";
export { findIntroducedIssues } from "./validation/find-introduced-issues.js";
export type { Issue, IssueCode } from "./validation/issue-codes.js";
export { ISSUE_CODES } from "./validation/issue-codes.js";
export { validateSchema } from "./validation/validate-schema.js";
