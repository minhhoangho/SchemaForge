import { describe, expect, it } from "vitest";

import {
  buildSchema,
  createCounterIdGenerator,
  makeEnum,
} from "../testing/factories.js";
import { unwrapError, unwrapOk } from "../testing/unwrap-result.js";
import { toColumn, toColumnDefault, toColumnType } from "./ai-column-spec.js";

const AT = "tables.users.columns.status";
const STATUS = makeEnum({ id: "enum_status", name: "order_status" });
const SCHEMA = buildSchema({ enums: [STATUS] });

describe("toColumnType", () => {
  it("builds a varchar type with its length", () => {
    const result = toColumnType(SCHEMA, { kind: "varchar", length: 255 }, AT);

    expect(unwrapOk(result)).toStrictEqual({ kind: "varchar", length: 255 });
  });

  it("builds a decimal type with its precision and scale", () => {
    const result = toColumnType(
      SCHEMA,
      { kind: "decimal", precision: 10, scale: 2 },
      AT,
    );

    expect(unwrapOk(result)).toStrictEqual({
      kind: "decimal",
      precision: 10,
      scale: 2,
    });
  });

  it("builds a type without parameters", () => {
    const result = toColumnType(SCHEMA, { kind: "timestamptz" }, AT);

    expect(unwrapOk(result)).toStrictEqual({ kind: "timestamptz" });
  });

  it.each([
    { kind: "varchar", path: ["length"] },
    { kind: "char", path: ["length"] },
    { kind: "decimal", path: ["precision"] },
    { kind: "enum", path: ["enumName"] },
    { kind: "custom", path: ["customName"] },
  ] as const)("rejects a $kind without $path", ({ kind, path }) => {
    const result = toColumnType(SCHEMA, { kind }, AT);

    expect(unwrapError(result)).toStrictEqual({
      code: "column-type-invalid",
      path,
      at: AT,
    });
  });

  it("rejects a decimal without scale", () => {
    const result = toColumnType(SCHEMA, { kind: "decimal", precision: 10 }, AT);

    expect(unwrapError(result)).toStrictEqual({
      code: "column-type-invalid",
      path: ["scale"],
      at: AT,
    });
  });

  it("rejects a length on an integer", () => {
    const result = toColumnType(SCHEMA, { kind: "integer", length: 10 }, AT);

    expect(unwrapError(result)).toStrictEqual({
      code: "column-type-invalid",
      path: ["length"],
      at: AT,
    });
  });

  it("rejects an enum name on a varchar", () => {
    const result = toColumnType(
      SCHEMA,
      { kind: "varchar", length: 10, enumName: "order_status" },
      AT,
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "column-type-invalid",
      path: ["enumName"],
      at: AT,
    });
  });

  it("resolves an enum type by enum name", () => {
    const result = toColumnType(
      SCHEMA,
      { kind: "enum", enumName: "Order_Status" },
      AT,
    );

    expect(unwrapOk(result)).toStrictEqual({
      kind: "enum",
      enumId: "enum_status",
    });
  });

  it("returns enum-name-not-found for an unknown enum", () => {
    const result = toColumnType(
      SCHEMA,
      { kind: "enum", enumName: "order state" },
      AT,
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "enum-name-not-found",
      path: ["enumName"],
      at: 'enums."order state"',
    });
  });

  it("builds a custom type from customName", () => {
    const result = toColumnType(
      SCHEMA,
      { kind: "custom", customName: "citext" },
      AT,
    );

    expect(unwrapOk(result)).toStrictEqual({ kind: "custom", name: "citext" });
  });
});

describe("toColumnDefault", () => {
  it("builds a literal default", () => {
    const result = toColumnDefault({ kind: "literal", value: "0" }, AT);

    expect(unwrapOk(result)).toStrictEqual({ kind: "literal", value: "0" });
  });

  it.each(["currentTimestamp", "generateUuid"] as const)(
    "builds a %s default",
    (kind) => {
      const result = toColumnDefault({ kind }, AT);

      expect(unwrapOk(result)).toStrictEqual({ kind });
    },
  );

  it.each([undefined, null])("turns a %s default into null", (spec) => {
    const result = toColumnDefault(spec, AT);

    expect(unwrapOk(result)).toBeNull();
  });

  it("rejects a literal default without value", () => {
    const result = toColumnDefault({ kind: "literal" }, AT);

    expect(unwrapError(result)).toStrictEqual({
      code: "default-value-invalid",
      path: ["value"],
      at: AT,
    });
  });

  it("rejects a value on currentTimestamp", () => {
    const result = toColumnDefault(
      { kind: "currentTimestamp", value: "now()" },
      AT,
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "default-value-invalid",
      path: ["value"],
      at: AT,
    });
  });
});

describe("toColumn", () => {
  const TABLE = { id: "tbl_users", name: "users" } as const;

  it("builds a column with explicit values for omitted fields", () => {
    const result = toColumn(
      SCHEMA,
      { name: "age", type: { kind: "integer" }, isNullable: true },
      TABLE,
      createCounterIdGenerator(),
    );

    expect(unwrapOk(result)).toStrictEqual({
      id: "col_1",
      tableId: "tbl_users",
      name: "age",
      type: { kind: "integer" },
      isNullable: true,
      defaultValue: null,
      isUnique: false,
      isAutoIncrement: false,
      comment: "",
    });
  });

  it("locates a type error under the type field", () => {
    const result = toColumn(
      SCHEMA,
      { name: "code", type: { kind: "char" }, isNullable: false },
      TABLE,
      createCounterIdGenerator(),
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "column-type-invalid",
      path: ["type", "length"],
      at: "tables.users.columns.code",
    });
  });

  it("locates a default value error under the defaultValue field", () => {
    const result = toColumn(
      SCHEMA,
      {
        name: "created_at",
        type: { kind: "timestamptz" },
        isNullable: false,
        defaultValue: { kind: "generateUuid", value: "x" },
      },
      TABLE,
      createCounterIdGenerator(),
    );

    expect(unwrapError(result)).toStrictEqual({
      code: "default-value-invalid",
      path: ["defaultValue", "value"],
      at: "tables.users.columns.created_at",
    });
  });
});
