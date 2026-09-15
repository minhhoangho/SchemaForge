import { compareDocumentPaths } from "../document-path.js";
import type { DocumentPath } from "../document-path.js";
import type { OperationError } from "../error-codes.js";
import type { TableId } from "../model/ids.js";
import type { ColumnPair, Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import { acceptOperation, rejectOperation } from "./apply-result.js";
import type { ApplyResult } from "./apply-result.js";
import { withEntry, withoutIds } from "./id-map.js";
import { isJsonEqual } from "./json-equal.js";
import type {
  Operation,
  OperationOfType,
  RelationOperation,
} from "./operation.js";
import { checkColumnList } from "./references.js";

type RelationChanges = OperationOfType<"updateRelation">["changes"];

type RelationTables = Pick<Relation, "fromTableId" | "toTableId">;

function checkColumnSide(
  schema: SchemaDocument,
  tableId: TableId,
  columnPairs: readonly ColumnPair[],
  path: DocumentPath,
  side: keyof ColumnPair,
): OperationError | null {
  const columnIds = columnPairs.map((pair) => pair[side]);
  const error = checkColumnList(schema, tableId, columnIds, path);
  return error === null
    ? null
    : { code: error.code, path: [...error.path, side] };
}

// Each side reports only its first error, so the smaller of the two paths is
// the first error overall: an earlier pair wins, and within one pair
// "fromColumnId" sorts before "toColumnId".
function checkColumnPairs(
  schema: SchemaDocument,
  tables: RelationTables,
  columnPairs: readonly ColumnPair[],
  path: DocumentPath,
): OperationError | null {
  const fromError = checkColumnSide(
    schema,
    tables.fromTableId,
    columnPairs,
    path,
    "fromColumnId",
  );
  const toError = checkColumnSide(
    schema,
    tables.toTableId,
    columnPairs,
    path,
    "toColumnId",
  );
  if (fromError === null || toError === null) {
    return fromError ?? toError;
  }
  return compareDocumentPaths(toError.path, fromError.path) < 0
    ? toError
    : fromError;
}

function addRelation(
  schema: SchemaDocument,
  { relation }: OperationOfType<"addRelation">,
): ApplyResult {
  if (schema.relations[relation.id] !== undefined) {
    return rejectOperation("id-already-exists", ["relation", "id"]);
  }
  if (schema.tables[relation.fromTableId] === undefined) {
    return rejectOperation("table-not-found", ["relation", "fromTableId"]);
  }
  if (schema.tables[relation.toTableId] === undefined) {
    return rejectOperation("table-not-found", ["relation", "toTableId"]);
  }
  const columnError = checkColumnPairs(schema, relation, relation.columnPairs, [
    "relation",
    "columnPairs",
  ]);
  if (columnError !== null) {
    return rejectOperation(columnError.code, columnError.path);
  }
  return acceptOperation(
    {
      ...schema,
      relations: withEntry(schema.relations, relation.id, relation),
    },
    { type: "removeRelation", relationId: relation.id },
  );
}

// The inverse carries the current value of exactly the keys given a value.
function pickPreviousValues(
  relation: Relation,
  changes: RelationChanges,
): RelationChanges {
  return {
    ...(changes.kind === undefined ? {} : { kind: relation.kind }),
    ...(changes.columnPairs === undefined
      ? {}
      : { columnPairs: relation.columnPairs }),
    ...(changes.onDelete === undefined ? {} : { onDelete: relation.onDelete }),
    ...(changes.onUpdate === undefined ? {} : { onUpdate: relation.onUpdate }),
  };
}

function applyRelationChanges(
  relation: Relation,
  changes: RelationChanges,
): Relation {
  return {
    ...relation,
    kind: changes.kind ?? relation.kind,
    columnPairs: changes.columnPairs ?? relation.columnPairs,
    onDelete: changes.onDelete ?? relation.onDelete,
    onUpdate: changes.onUpdate ?? relation.onUpdate,
  };
}

function updateRelation(
  schema: SchemaDocument,
  { relationId, changes }: OperationOfType<"updateRelation">,
): ApplyResult {
  const relation = schema.relations[relationId];
  if (relation === undefined) {
    return rejectOperation("relation-not-found", ["relationId"]);
  }
  const columnError =
    changes.columnPairs === undefined
      ? null
      : checkColumnPairs(schema, relation, changes.columnPairs, [
          "changes",
          "columnPairs",
        ]);
  if (columnError !== null) {
    return rejectOperation(columnError.code, columnError.path);
  }
  const inverse: Operation = {
    type: "updateRelation",
    relationId,
    changes: pickPreviousValues(relation, changes),
  };
  const updated = applyRelationChanges(relation, changes);
  if (isJsonEqual(updated, relation)) {
    return acceptOperation(schema, inverse);
  }
  return acceptOperation(
    { ...schema, relations: withEntry(schema.relations, relationId, updated) },
    inverse,
  );
}

function removeRelation(
  schema: SchemaDocument,
  { relationId }: OperationOfType<"removeRelation">,
): ApplyResult {
  const relation = schema.relations[relationId];
  if (relation === undefined) {
    return rejectOperation("relation-not-found", ["relationId"]);
  }
  return acceptOperation(
    { ...schema, relations: withoutIds(schema.relations, [relationId]) },
    { type: "addRelation", relation },
  );
}

export function applyRelationOperation(
  schema: SchemaDocument,
  operation: RelationOperation,
): ApplyResult {
  switch (operation.type) {
    case "addRelation":
      return addRelation(schema, operation);
    case "updateRelation":
      return updateRelation(schema, operation);
    case "removeRelation":
      return removeRelation(schema, operation);
    default: {
      const unhandled: never = operation;
      throw new Error(
        `Unhandled relation operation: ${JSON.stringify(unhandled)}`,
      );
    }
  }
}
