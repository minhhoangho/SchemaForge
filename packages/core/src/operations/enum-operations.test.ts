import { describe, expect, it } from "vitest";

import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeTable,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { applyEnumOperation } from "./enum-operations.js";
import type { EnumOperation } from "./operation.js";

describe("applyEnumOperation with addEnum", () => {
  it("adds an enum with no values", () => {
    const schema = buildSchema({});
    const status = makeEnum({ id: "enum_status", values: [] });

    const result = unwrapOk(
      applyEnumOperation(schema, { type: "addEnum", enum: status }),
    );

    expect(result.schema).toStrictEqual(buildSchema({ enums: [status] }));
  });

  it("returns removeEnum as the inverse of addEnum", () => {
    const schema = buildSchema({});
    const status = makeEnum({ id: "enum_status" });
    const expectedInverse: EnumOperation = {
      type: "removeEnum",
      enumId: "enum_status",
    };

    const result = unwrapOk(
      applyEnumOperation(schema, { type: "addEnum", enum: status }),
    );

    expect(result.inverse).toStrictEqual(expectedInverse);
    expect(
      unwrapOk(applyEnumOperation(result.schema, expectedInverse)).schema,
    ).toStrictEqual(schema);
  });

  it("rejects addEnum with id-already-exists", () => {
    const schema = buildSchema({ enums: [makeEnum({ id: "enum_status" })] });

    const error = unwrapError(
      applyEnumOperation(schema, {
        type: "addEnum",
        enum: makeEnum({ id: "enum_status", name: "other" }),
      }),
    );

    expect(error).toStrictEqual({
      code: "id-already-exists",
      path: ["enum", "id"],
    });
  });
});

describe("applyEnumOperation with updateEnum", () => {
  it("replaces all values of an enum", () => {
    const status = makeEnum({
      id: "enum_status",
      values: ["active", "inactive"],
    });
    const schema = buildSchema({ enums: [status] });

    const result = unwrapOk(
      applyEnumOperation(schema, {
        type: "updateEnum",
        enumId: "enum_status",
        changes: { values: ["pending", "active"] },
      }),
    );

    expect(result.schema).toStrictEqual(
      buildSchema({ enums: [{ ...status, values: ["pending", "active"] }] }),
    );
  });

  it("keeps other enums by reference when an enum is updated", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status" }), makeEnum({ id: "enum_role" })],
    });

    const result = unwrapOk(
      applyEnumOperation(schema, {
        type: "updateEnum",
        enumId: "enum_status",
        changes: { name: "state" },
      }),
    );

    expect(result.schema.enums.enum_role).toBe(schema.enums.enum_role);
  });

  it("returns updateEnum with previous values as the inverse", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: ["active", "inactive"] })],
    });
    const expectedInverse: EnumOperation = {
      type: "updateEnum",
      enumId: "enum_status",
      changes: { values: ["active", "inactive"] },
    };

    const result = unwrapOk(
      applyEnumOperation(schema, {
        type: "updateEnum",
        enumId: "enum_status",
        changes: { values: ["pending"] },
      }),
    );

    expect(result.inverse).toStrictEqual(expectedInverse);
    expect(
      unwrapOk(applyEnumOperation(result.schema, expectedInverse)).schema,
    ).toStrictEqual(schema);
  });

  it("ignores a change whose value is undefined", () => {
    const status = makeEnum({ id: "enum_status", name: "status" });
    const schema = buildSchema({ enums: [status] });

    const result = unwrapOk(
      applyEnumOperation(schema, {
        type: "updateEnum",
        enumId: "enum_status",
        changes: { name: "state", values: undefined },
      }),
    );

    expect(result.schema).toStrictEqual(
      buildSchema({ enums: [{ ...status, name: "state" }] }),
    );
  });

  it("leaves keys whose value is undefined out of the updateEnum inverse", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", name: "status" })],
    });

    const result = unwrapOk(
      applyEnumOperation(schema, {
        type: "updateEnum",
        enumId: "enum_status",
        changes: { name: "state", values: undefined },
      }),
    );

    expect(result.inverse).toStrictEqual({
      type: "updateEnum",
      enumId: "enum_status",
      changes: { name: "status" },
    });
  });

  it("rejects updateEnum with enum-not-found", () => {
    const schema = buildSchema({});

    const error = unwrapError(
      applyEnumOperation(schema, {
        type: "updateEnum",
        enumId: "enum_missing",
        changes: { name: "state" },
      }),
    );

    expect(error).toStrictEqual({ code: "enum-not-found", path: ["enumId"] });
  });

  it("leaves a column default pointing to a renamed value unchanged", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_status",
          tableId: "tbl_users",
          type: { kind: "enum", enumId: "enum_status" },
          defaultValue: { kind: "literal", value: "active" },
        }),
      ],
      enums: [makeEnum({ id: "enum_status", values: ["active", "inactive"] })],
    });

    const result = unwrapOk(
      applyEnumOperation(schema, {
        type: "updateEnum",
        enumId: "enum_status",
        changes: { values: ["enabled", "inactive"] },
      }),
    );

    expect(result.schema.columns).toBe(schema.columns);
  });

  it("returns the same schema reference when updateEnum sets the current values", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", values: ["active", "inactive"] })],
    });

    const result = unwrapOk(
      applyEnumOperation(schema, {
        type: "updateEnum",
        enumId: "enum_status",
        changes: { values: ["active", "inactive"] },
      }),
    );

    expect(result.schema).toBe(schema);
  });
});

describe("applyEnumOperation with removeEnum", () => {
  it("removes an unused enum and returns addEnum as the inverse", () => {
    const users = makeTable({ id: "tbl_users" });
    const id = makeColumn({ id: "col_id", tableId: "tbl_users" });
    const status = makeEnum({ id: "enum_status" });
    const schema = buildSchema({
      tables: [users],
      columns: [id],
      enums: [status],
    });
    const expectedInverse: EnumOperation = { type: "addEnum", enum: status };

    const result = unwrapOk(
      applyEnumOperation(schema, { type: "removeEnum", enumId: "enum_status" }),
    );

    expect(result.schema).toStrictEqual(
      buildSchema({ tables: [users], columns: [id] }),
    );
    expect(result.inverse).toStrictEqual(expectedInverse);
    expect(
      unwrapOk(applyEnumOperation(result.schema, expectedInverse)).schema,
    ).toStrictEqual(schema);
  });

  it("rejects removeEnum with enum-in-use when a column uses the enum", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_status",
          tableId: "tbl_users",
          type: { kind: "enum", enumId: "enum_status" },
        }),
      ],
      enums: [makeEnum({ id: "enum_status" })],
    });

    const error = unwrapError(
      applyEnumOperation(schema, { type: "removeEnum", enumId: "enum_status" }),
    );

    expect(error).toStrictEqual({ code: "enum-in-use", path: ["enumId"] });
  });

  it("rejects removeEnum with enum-not-found", () => {
    const schema = buildSchema({});

    const error = unwrapError(
      applyEnumOperation(schema, {
        type: "removeEnum",
        enumId: "enum_missing",
      }),
    );

    expect(error).toStrictEqual({ code: "enum-not-found", path: ["enumId"] });
  });
});
