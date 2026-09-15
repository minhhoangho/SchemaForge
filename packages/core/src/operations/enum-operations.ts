import type { Enum } from "../model/enum.js";
import type { EnumId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { ApplyResult } from "./apply-result.js";
import { acceptOperation, rejectOperation } from "./apply-result.js";
import { withEntry, withoutIds } from "./id-map.js";
import { isJsonEqual } from "./json-equal.js";
import type { EnumOperation, OperationOfType } from "./operation.js";

function addEnum(
  schema: SchemaDocument,
  operation: OperationOfType<"addEnum">,
): ApplyResult {
  const added = operation.enum;
  if (schema.enums[added.id] !== undefined) {
    return rejectOperation("id-already-exists", ["enum", "id"]);
  }
  return acceptOperation(
    { ...schema, enums: withEntry(schema.enums, added.id, added) },
    { type: "removeEnum", enumId: added.id },
  );
}

// Keys whose value is undefined count as not given, both when applying the
// changes and when recording the previous values in the inverse.
function updateEnum(
  schema: SchemaDocument,
  operation: OperationOfType<"updateEnum">,
): ApplyResult {
  const current = schema.enums[operation.enumId];
  if (current === undefined) {
    return rejectOperation("enum-not-found", ["enumId"]);
  }
  const { name, values } = operation.changes;
  const updated: Enum = {
    ...current,
    ...(name === undefined ? {} : { name }),
    ...(values === undefined ? {} : { values }),
  };
  const inverse: OperationOfType<"updateEnum"> = {
    type: "updateEnum",
    enumId: current.id,
    changes: {
      ...(name === undefined ? {} : { name: current.name }),
      ...(values === undefined ? {} : { values: current.values }),
    },
  };
  if (isJsonEqual(updated, current)) {
    return acceptOperation(schema, inverse);
  }
  return acceptOperation(
    { ...schema, enums: withEntry(schema.enums, current.id, updated) },
    inverse,
  );
}

function isEnumInUse(schema: SchemaDocument, enumId: EnumId): boolean {
  return Object.values(schema.columns).some(
    (column) => column.type.kind === "enum" && column.type.enumId === enumId,
  );
}

// An enum still used by a column is rejected rather than cascaded: no other
// type is a correct replacement for those columns.
function removeEnum(
  schema: SchemaDocument,
  operation: OperationOfType<"removeEnum">,
): ApplyResult {
  const current = schema.enums[operation.enumId];
  if (current === undefined) {
    return rejectOperation("enum-not-found", ["enumId"]);
  }
  if (isEnumInUse(schema, current.id)) {
    return rejectOperation("enum-in-use", ["enumId"]);
  }
  return acceptOperation(
    { ...schema, enums: withoutIds(schema.enums, [current.id]) },
    { type: "addEnum", enum: current },
  );
}

export function applyEnumOperation(
  schema: SchemaDocument,
  operation: EnumOperation,
): ApplyResult {
  switch (operation.type) {
    case "addEnum":
      return addEnum(schema, operation);
    case "updateEnum":
      return updateEnum(schema, operation);
    case "removeEnum":
      return removeEnum(schema, operation);
    default: {
      const unhandled: never = operation;
      throw new Error(`Unhandled enum operation: ${JSON.stringify(unhandled)}`);
    }
  }
}
