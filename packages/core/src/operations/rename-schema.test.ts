import { describe, expect, it } from "vitest";

import { buildSchema } from "../testing/factories.js";
import { unwrapOk } from "../testing/unwrap-result.js";
import type { OperationOfType } from "./operation.js";
import { applyRenameSchema } from "./rename-schema.js";

describe("applyRenameSchema", () => {
  it("renames the schema and returns the previous name as the inverse", () => {
    const schema = buildSchema({ name: "shop" });
    const expectedInverse: OperationOfType<"renameSchema"> = {
      type: "renameSchema",
      name: "shop",
    };

    const result = unwrapOk(
      applyRenameSchema(schema, { type: "renameSchema", name: "store" }),
    );

    expect(result.schema).toStrictEqual(buildSchema({ name: "store" }));
    expect(result.inverse).toStrictEqual(expectedInverse);
    expect(
      unwrapOk(applyRenameSchema(result.schema, expectedInverse)).schema,
    ).toStrictEqual(schema);
  });

  it("accepts an empty name because that is a semantic issue", () => {
    const schema = buildSchema({ name: "shop" });

    const result = unwrapOk(
      applyRenameSchema(schema, { type: "renameSchema", name: "" }),
    );

    expect(result.schema).toStrictEqual(buildSchema({ name: "" }));
  });

  it("returns the same schema reference when the name is unchanged", () => {
    const schema = buildSchema({ name: "shop" });

    const result = unwrapOk(
      applyRenameSchema(schema, { type: "renameSchema", name: "shop" }),
    );

    expect(result.schema).toBe(schema);
  });

  it("keeps every element map by reference when the schema is renamed", () => {
    const schema = buildSchema({ name: "shop" });

    const result = unwrapOk(
      applyRenameSchema(schema, { type: "renameSchema", name: "store" }),
    );

    expect(result.schema.tables).toBe(schema.tables);
    expect(result.schema.notes).toBe(schema.notes);
  });
});
