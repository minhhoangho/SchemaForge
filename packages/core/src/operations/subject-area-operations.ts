import type { SubjectAreaId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { ApplyResult } from "./apply-result.js";
import { acceptOperation, rejectOperation } from "./apply-result.js";
import { withEntry, withoutIds } from "./id-map.js";
import type {
  Operation,
  OperationOfType,
  SubjectAreaOperation,
} from "./operation.js";

function addSubjectArea(
  schema: SchemaDocument,
  operation: OperationOfType<"addSubjectArea">,
): ApplyResult {
  const added = operation.subjectArea;
  if (schema.subjectAreas[added.id] !== undefined) {
    return rejectOperation("id-already-exists", ["subjectArea", "id"]);
  }
  return acceptOperation(
    {
      ...schema,
      subjectAreas: withEntry(schema.subjectAreas, added.id, added),
    },
    { type: "removeSubjectArea", subjectAreaId: added.id },
  );
}

function updateSubjectArea(
  schema: SchemaDocument,
  operation: OperationOfType<"updateSubjectArea">,
): ApplyResult {
  const current = schema.subjectAreas[operation.subjectAreaId];
  if (current === undefined) {
    return rejectOperation("subject-area-not-found", ["subjectAreaId"]);
  }
  const inverse: Operation = {
    type: "updateSubjectArea",
    subjectAreaId: current.id,
    changes: { name: current.name },
  };
  const { name } = operation.changes;
  if (name === current.name) {
    return acceptOperation(schema, inverse);
  }
  return acceptOperation(
    {
      ...schema,
      subjectAreas: withEntry(schema.subjectAreas, current.id, {
        ...current,
        name,
      }),
    },
    inverse,
  );
}

// `<` and `>` compare UTF-16 code units, so the inverse depends neither on the
// locale nor on the key order of the tables map.
function compareTablesById(left: Table, right: Table): number {
  if (left.id < right.id) {
    return -1;
  }
  return left.id > right.id ? 1 : 0;
}

function findMemberTables(
  schema: SchemaDocument,
  subjectAreaId: SubjectAreaId,
): readonly Table[] {
  return Object.values(schema.tables)
    .filter((table) => table.subjectAreaId === subjectAreaId)
    .toSorted(compareTablesById);
}

function removeSubjectArea(
  schema: SchemaDocument,
  operation: OperationOfType<"removeSubjectArea">,
): ApplyResult {
  const current = schema.subjectAreas[operation.subjectAreaId];
  if (current === undefined) {
    return rejectOperation("subject-area-not-found", ["subjectAreaId"]);
  }
  const members = findMemberTables(schema, current.id);
  // Without members the reduce returns the original map, keeping its reference.
  const tables = members.reduce(
    (result, table) =>
      withEntry(result, table.id, { ...table, subjectAreaId: null }),
    schema.tables,
  );
  const inverse: Operation = {
    type: "batch",
    operations: [
      { type: "addSubjectArea", subjectArea: current },
      ...members.map((table): Operation => ({
        type: "updateTable",
        tableId: table.id,
        changes: { subjectAreaId: current.id },
      })),
    ],
  };
  return acceptOperation(
    {
      ...schema,
      tables,
      subjectAreas: withoutIds(schema.subjectAreas, [current.id]),
    },
    inverse,
  );
}

export function applySubjectAreaOperation(
  schema: SchemaDocument,
  operation: SubjectAreaOperation,
): ApplyResult {
  switch (operation.type) {
    case "addSubjectArea":
      return addSubjectArea(schema, operation);
    case "updateSubjectArea":
      return updateSubjectArea(schema, operation);
    case "removeSubjectArea":
      return removeSubjectArea(schema, operation);
    default: {
      const unhandled: never = operation;
      throw new Error(
        `Unhandled subject area operation: ${JSON.stringify(unhandled)}`,
      );
    }
  }
}
