import type { OperationError } from "../error-codes.js";
import type { Column } from "../model/column.js";
import type { ColumnId, GenerateId, TableId } from "../model/ids.js";
import {
  createColumnId,
  createRelationId,
  createTableId,
} from "../model/ids.js";
import { toNameKey } from "../model/name-limits.js";
import type { Position } from "../model/position.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { Result } from "../result.js";
import { err, ok } from "../result.js";
import type {
  BatchOperation,
  Operation,
  OperationOfType,
} from "./operation.js";

export type ManyToManyInput = {
  readonly leftTableId: TableId;
  readonly rightTableId: TableId;
  readonly junctionTableName: string;
  readonly position: Position;
};

const NAME_SEPARATOR = "_";
// The first generated name carries no number, so numbering starts at 2.
const FIRST_SUFFIX_NUMBER = 2;

type JoinedTables = {
  readonly left: Table;
  readonly right: Table;
};

// A junction column before it has an id: the key column it copies and its
// final, collision-free name.
type JunctionColumnDraft = {
  readonly keyColumn: Column;
  readonly name: string;
};

type JunctionColumn = {
  readonly column: Column;
  readonly keyColumnId: ColumnId;
};

function findJoinedTables(
  schema: SchemaDocument,
  input: ManyToManyInput,
): Result<JoinedTables, OperationError> {
  const left = schema.tables[input.leftTableId];
  if (left === undefined) {
    return err({ code: "table-not-found", path: ["leftTableId"] });
  }
  const right = schema.tables[input.rightTableId];
  if (right === undefined) {
    return err({ code: "table-not-found", path: ["rightTableId"] });
  }
  if (left.primaryKeyColumnIds.length === 0) {
    return err({ code: "primary-key-missing", path: ["leftTableId"] });
  }
  if (right.primaryKeyColumnIds.length === 0) {
    return err({ code: "primary-key-missing", path: ["rightTableId"] });
  }
  return ok({ left, right });
}

// A parsed schema always has every primary key column, so a miss means the
// document skipped parsing: a programmer error, not an expected failure.
function findPrimaryKeyColumns(
  schema: SchemaDocument,
  table: Table,
): readonly Column[] {
  return table.primaryKeyColumnIds.map((columnId) => {
    const column = schema.columns[columnId];
    if (column === undefined) {
      throw new Error(
        `Primary key column ${columnId} of table ${table.id} does not exist`,
      );
    }
    return column;
  });
}

function pickUnusedName(
  baseName: string,
  usedNameKeys: ReadonlySet<string>,
): string {
  let name = baseName;
  let suffixNumber = FIRST_SUFFIX_NUMBER;
  while (usedNameKeys.has(toNameKey(name))) {
    name = `${baseName}${NAME_SEPARATOR}${String(suffixNumber)}`;
    suffixNumber += 1;
  }
  return name;
}

// Left key columns come before right ones, each in primary key order. Names
// are never truncated: a name that is too long becomes a name-too-long issue.
function draftJunctionColumns(
  schema: SchemaDocument,
  tables: JoinedTables,
): readonly JunctionColumnDraft[] {
  const usedNameKeys = new Set<string>();
  const drafts: JunctionColumnDraft[] = [];
  for (const table of [tables.left, tables.right]) {
    for (const keyColumn of findPrimaryKeyColumns(schema, table)) {
      const baseName = `${table.name}${NAME_SEPARATOR}${keyColumn.name}`;
      const name = pickUnusedName(baseName, usedNameKeys);
      usedNameKeys.add(toNameKey(name));
      drafts.push({ keyColumn, name });
    }
  }
  return drafts;
}

function createJunctionColumn(
  junctionTableId: TableId,
  draft: JunctionColumnDraft,
  generateId: GenerateId,
): JunctionColumn {
  return {
    column: {
      id: createColumnId(generateId),
      tableId: junctionTableId,
      name: draft.name,
      type: draft.keyColumn.type,
      isNullable: false,
      defaultValue: null,
      isUnique: false,
      isAutoIncrement: false,
      comment: "",
    },
    keyColumnId: draft.keyColumn.id,
  };
}

function buildAddRelation(
  junctionTableId: TableId,
  toTableId: TableId,
  junctionColumns: readonly JunctionColumn[],
  generateId: GenerateId,
): OperationOfType<"addRelation"> {
  return {
    type: "addRelation",
    relation: {
      id: createRelationId(generateId),
      kind: "oneToMany",
      fromTableId: junctionTableId,
      toTableId,
      columnPairs: junctionColumns.map(({ column, keyColumnId }) => ({
        fromColumnId: column.id,
        toColumnId: keyColumnId,
      })),
      onDelete: "cascade",
      onUpdate: "noAction",
    },
  };
}

function buildJunctionTableSteps(
  input: ManyToManyInput,
  junctionTableId: TableId,
  junctionColumns: readonly JunctionColumn[],
): readonly Operation[] {
  return [
    {
      type: "addTable",
      table: {
        id: junctionTableId,
        name: input.junctionTableName,
        comment: "",
        position: input.position,
        subjectAreaId: null,
      },
    },
    ...junctionColumns.map(
      ({ column }, insertAt): OperationOfType<"addColumn"> => ({
        type: "addColumn",
        column,
        insertAt,
      }),
    ),
    {
      type: "setPrimaryKey",
      tableId: junctionTableId,
      columnIds: junctionColumns.map(({ column }) => column.id),
    },
  ];
}

/**
 * Builds one batch that joins two tables many-to-many: a junction table with a
 * column per primary key column of each end, a primary key over all of them,
 * and a one-to-many relation to each end. The batch is not applied; callers
 * pass it to `applyOperation`, so it is recorded and undone as one step.
 */
export function buildManyToMany(
  schema: SchemaDocument,
  input: ManyToManyInput,
  generateId: GenerateId,
): Result<Operation, OperationError> {
  const joined = findJoinedTables(schema, input);
  if (!joined.isOk) {
    return joined;
  }
  const { left, right } = joined.value;
  const drafts = draftJunctionColumns(schema, joined.value);
  // Ids are drawn in a fixed order: the junction table, its columns (left key
  // first), then the left relation and the right relation.
  const junctionTableId = createTableId(generateId);
  const junctionColumns = drafts.map((draft) =>
    createJunctionColumn(junctionTableId, draft, generateId),
  );
  const leftColumnCount = left.primaryKeyColumnIds.length;
  const leftRelation = buildAddRelation(
    junctionTableId,
    left.id,
    junctionColumns.slice(0, leftColumnCount),
    generateId,
  );
  const rightRelation = buildAddRelation(
    junctionTableId,
    right.id,
    junctionColumns.slice(leftColumnCount),
    generateId,
  );
  const batch: BatchOperation = {
    type: "batch",
    operations: [
      ...buildJunctionTableSteps(input, junctionTableId, junctionColumns),
      leftRelation,
      rightRelation,
    ],
  };
  return ok(batch);
}
