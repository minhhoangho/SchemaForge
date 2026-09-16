import { createEnumId } from "@schemaforge/core";
import type {
  EnumId,
  GenerateId,
  Operation,
  SchemaDocument,
} from "@schemaforge/core";

import { suggestEnumName, suggestEnumValue } from "./name-suggestions";

export type AddEnumResult = {
  readonly operation: Operation;
  readonly enumId: EnumId;
};

/**
 * Builds the "add enum" operation. The new enum starts with one value, so it
 * never introduces an `enum-values-empty` issue.
 */
export function buildAddEnumOperation(
  document: SchemaDocument,
  generateId: GenerateId,
): AddEnumResult {
  const enumId = createEnumId(generateId);

  return {
    operation: {
      type: "addEnum",
      enum: {
        id: enumId,
        name: suggestEnumName(document),
        values: [suggestEnumValue([])],
      },
    },
    enumId,
  };
}
