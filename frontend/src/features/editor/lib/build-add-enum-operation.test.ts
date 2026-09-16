import {
  applyOperation,
  createEmptySchema,
  validateSchema,
} from "@schemaforge/core";
import {
  buildSchema,
  createCounterIdGenerator,
  makeEnum,
  unwrapOk,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { buildAddEnumOperation } from "./build-add-enum-operation";

describe("buildAddEnumOperation", () => {
  it("builds an enum with one starter value", () => {
    const document = buildSchema({
      enums: [makeEnum({ id: "enum_9", name: "enum_1" })],
    });

    const result = buildAddEnumOperation(document, createCounterIdGenerator());

    expect(result).toStrictEqual({
      enumId: "enum_1",
      operation: {
        type: "addEnum",
        enum: { id: "enum_1", name: "enum_2", values: ["value_1"] },
      },
    });
  });

  it("applies without introducing any issue", () => {
    const document = createEmptySchema("test");

    const { operation } = buildAddEnumOperation(
      document,
      createCounterIdGenerator(),
    );
    const applied = unwrapOk(applyOperation(document, operation));

    expect(validateSchema(applied.schema)).toStrictEqual([]);
  });
});
