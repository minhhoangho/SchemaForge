import { describe, expect, it } from "vitest";

import { buildSchema } from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { acceptOperation, rejectOperation } from "./apply-result.js";

describe("acceptOperation", () => {
  it("accepts with the new schema and the inverse", () => {
    const schema = buildSchema({});
    const inverse = { type: "renameSchema", name: "previous" } as const;

    const result = unwrapOk(acceptOperation(schema, inverse));

    expect(result).toStrictEqual({ schema, inverse });
  });
});

describe("rejectOperation", () => {
  it("rejects with the error code and path", () => {
    const result = unwrapError(rejectOperation("table-not-found", ["tableId"]));

    expect(result).toStrictEqual({
      code: "table-not-found",
      path: ["tableId"],
    });
  });
});
