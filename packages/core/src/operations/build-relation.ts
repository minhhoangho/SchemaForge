import type { DocumentPath } from "../document-path.js";
import type { ErrorCode, OperationError } from "../error-codes.js";
import type { Column } from "../model/column.js";
import { findColumnListErrors } from "../model/column-list-errors.js";
import {
  createColumnId,
  createIndexId,
  createRelationId,
} from "../model/ids.js";
import type { ColumnId, GenerateId, TableId } from "../model/ids.js";
import { toNameKey } from "../model/name-limits.js";
import type { ReferentialAction, RelationKind } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { Result } from "../result.js";
import { err, ok } from "../result.js";
import type { Operation } from "./operation.js";
import { suggestIndexName } from "./suggest-index-name.js";

export type RelationInput = {
  readonly fromTableId: TableId;
  readonly toTableId: TableId;
  readonly kind: RelationKind;
  readonly onDelete: ReferentialAction;
  readonly onUpdate: ReferentialAction;
  // Target table columns the foreign key references, in pair order. When
  // omitted, the target table's primary key is referenced in primary key order.
  readonly referencedColumnIds?: readonly ColumnId[];
};

type ForeignKeyColumn = {
  readonly column: Column;
  readonly referencedColumnId: ColumnId;
};

type RelationTables = {
  readonly fromTable: Table;
  readonly toTable: Table;
};

const NAME_SEPARATOR = "_";
// The unsuffixed name is the first candidate, so numbering starts at 2.
const FIRST_SUFFIX_NUMBER = 2;

function rejectInput(
  code: ErrorCode,
  path: DocumentPath,
): Result<never, OperationError> {
  return err({ code, path });
}

// Structural invariants guarantee that every column id a table lists exists,
// so a missing column means the schema was never parsed.
function findColumn(schema: SchemaDocument, columnId: ColumnId): Column {
  const column = schema.columns[columnId];
  if (column === undefined) {
    throw new Error(`Column ${columnId} listed by a table does not exist`);
  }
  return column;
}

function pickUnusedName(
  baseName: string,
  usedNameKeys: ReadonlySet<string>,
): string {
  let candidate = baseName;
  let suffixNumber = FIRST_SUFFIX_NUMBER;
  while (usedNameKeys.has(toNameKey(candidate))) {
    candidate = `${baseName}${NAME_SEPARATOR}${String(suffixNumber)}`;
    suffixNumber += 1;
  }
  return candidate;
}

function resolveReferencedColumnIds(
  schema: SchemaDocument,
  toTable: Table,
  referencedColumnIds: RelationInput["referencedColumnIds"],
): Result<readonly ColumnId[], OperationError> {
  if (referencedColumnIds === undefined) {
    return toTable.primaryKeyColumnIds.length === 0
      ? rejectInput("primary-key-missing", ["toTableId"])
      : ok(toTable.primaryKeyColumnIds);
  }
  if (referencedColumnIds.length === 0) {
    return rejectInput("invalid-shape", ["referencedColumnIds"]);
  }
  const [firstError] = findColumnListErrors(
    schema.columns,
    toTable.id,
    referencedColumnIds,
  );
  if (firstError !== undefined) {
    return rejectInput(firstError.code, [
      "referencedColumnIds",
      firstError.index,
    ]);
  }
  return ok(referencedColumnIds);
}

// One column per referenced column, in the given order. Names are unique
// against the from table's columns and the names generated before.
function buildForeignKeyColumns(
  schema: SchemaDocument,
  { fromTable, toTable }: RelationTables,
  input: RelationInput,
  referencedColumnIds: readonly ColumnId[],
  generateId: GenerateId,
): readonly ForeignKeyColumn[] {
  const usedNameKeys = new Set(
    fromTable.columnIds.map((id) => toNameKey(findColumn(schema, id).name)),
  );
  const isNullable =
    input.onDelete === "setNull" || input.onUpdate === "setNull";
  const isUnique =
    input.kind === "oneToOne" && referencedColumnIds.length === 1;
  return referencedColumnIds.map((referencedColumnId) => {
    const referenced = findColumn(schema, referencedColumnId);
    const name = pickUnusedName(
      `${toTable.name}${NAME_SEPARATOR}${referenced.name}`,
      usedNameKeys,
    );
    usedNameKeys.add(toNameKey(name));
    const column: Column = {
      id: createColumnId(generateId),
      tableId: fromTable.id,
      name,
      type: referenced.type,
      isNullable,
      defaultValue: null,
      isUnique,
      isAutoIncrement: false,
      comment: "",
    };
    return { column, referencedColumnId };
  });
}

// A single foreign key column is made unique by its own isUnique flag; a
// composite one needs a unique index to satisfy a one-to-one relation.
function buildUniqueIndexSteps(
  schema: SchemaDocument,
  fromTable: Table,
  input: RelationInput,
  foreignKeyColumns: readonly ForeignKeyColumn[],
  generateId: GenerateId,
): readonly Operation[] {
  if (input.kind !== "oneToOne" || foreignKeyColumns.length === 1) {
    return [];
  }
  const columns = foreignKeyColumns.map(({ column }) => column);
  const name = suggestIndexName(schema, {
    tableName: fromTable.name,
    columnNames: columns.map((column) => column.name),
    isUnique: true,
  });
  return [
    {
      type: "addIndex",
      index: {
        id: createIndexId(generateId),
        tableId: fromTable.id,
        name,
        columnIds: columns.map((column) => column.id),
        isUnique: true,
      },
    },
  ];
}

function buildRelationStep(
  input: RelationInput,
  foreignKeyColumns: readonly ForeignKeyColumn[],
  generateId: GenerateId,
): Operation {
  return {
    type: "addRelation",
    relation: {
      id: createRelationId(generateId),
      kind: input.kind,
      fromTableId: input.fromTableId,
      toTableId: input.toTableId,
      columnPairs: foreignKeyColumns.map(({ column, referencedColumnId }) => ({
        fromColumnId: column.id,
        toColumnId: referencedColumnId,
      })),
      onDelete: input.onDelete,
      onUpdate: input.onUpdate,
    },
  };
}

/**
 * Builds a one-to-one or one-to-many relation together with foreign key
 * columns matching the referenced columns (the target table's primary key
 * unless `referencedColumnIds` is given), as one batch so a single undo
 * removes everything. Ids come from `generateId` in a fixed order: the
 * new columns, the relation, then the unique index when there is one. The
 * operation is not applied; pass it to `applyOperation`.
 */
export function buildRelation(
  schema: SchemaDocument,
  input: RelationInput,
  generateId: GenerateId,
): Result<Operation, OperationError> {
  const fromTable = schema.tables[input.fromTableId];
  if (fromTable === undefined) {
    return rejectInput("table-not-found", ["fromTableId"]);
  }
  const toTable = schema.tables[input.toTableId];
  if (toTable === undefined) {
    return rejectInput("table-not-found", ["toTableId"]);
  }
  const referenced = resolveReferencedColumnIds(
    schema,
    toTable,
    input.referencedColumnIds,
  );
  if (!referenced.isOk) {
    return referenced;
  }
  const foreignKeyColumns = buildForeignKeyColumns(
    schema,
    { fromTable, toTable },
    input,
    referenced.value,
    generateId,
  );
  const columnSteps = foreignKeyColumns.map(
    ({ column }, position): Operation => ({
      type: "addColumn",
      column,
      insertAt: fromTable.columnIds.length + position,
    }),
  );
  const relationStep = buildRelationStep(input, foreignKeyColumns, generateId);
  const indexSteps = buildUniqueIndexSteps(
    schema,
    fromTable,
    input,
    foreignKeyColumns,
    generateId,
  );
  const batch: Operation = {
    type: "batch",
    operations: [...columnSteps, relationStep, ...indexSteps],
  };
  return ok(batch);
}
