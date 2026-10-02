import { describe, expect, it } from "vitest";

import type { ColumnType } from "../../model/column-type.js";
import type { Column } from "../../model/column.js";
import type { EnumId } from "../../model/ids.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeTable,
} from "../../testing/factories.js";
import type { JsonValue } from "../shared/json-representation.js";
import {
  BIGINT_STRING_PATTERN,
  LOCAL_DATE_TIME_PATTERN,
  SMALLINT_MAXIMUM,
  SMALLINT_MINIMUM,
  TIME_PATTERN,
  decimalStringPattern,
} from "../shared/json-representation.js";
import { buildRestApiNames } from "../shared/rest-resources.js";
import {
  buildComponentSchemas,
  buildPropertySchema,
} from "./openapi-schemas.js";

const ENUM_TYPE_NAMES: ReadonlyMap<EnumId, string> = new Map([
  ["enum_status", "OrderStatus"],
]);
const STATUS_REF = "#/components/schemas/OrderStatus";

function column(overrides: Partial<Column> & Pick<Column, "id">): Column {
  return makeColumn({ tableId: "tbl_users", ...overrides });
}

function propertySchema(overrides: Partial<Column>): JsonValue {
  return buildPropertySchema(
    column({ id: "col_value", ...overrides }),
    ENUM_TYPE_NAMES,
  );
}

describe("buildPropertySchema", () => {
  it.each<[ColumnType, JsonValue]>([
    [
      { kind: "smallint" },
      {
        type: "integer",
        minimum: SMALLINT_MINIMUM,
        maximum: SMALLINT_MAXIMUM,
      },
    ],
    [{ kind: "integer" }, { type: "integer", format: "int32" }],
    [{ kind: "bigint" }, { type: "string", pattern: BIGINT_STRING_PATTERN }],
    [
      { kind: "decimal", precision: 10, scale: 2 },
      { type: "string", pattern: decimalStringPattern(10, 2) },
    ],
    [{ kind: "real" }, { type: "number", format: "float" }],
    [{ kind: "double" }, { type: "number", format: "double" }],
    [{ kind: "boolean" }, { type: "boolean" }],
    [
      { kind: "varchar", length: 20 },
      { type: "string", maxLength: 20 },
    ],
    [{ kind: "text" }, { type: "string" }],
    [{ kind: "uuid" }, { type: "string", format: "uuid" }],
    [{ kind: "date" }, { type: "string", format: "date" }],
    [{ kind: "time" }, { type: "string", pattern: TIME_PATTERN }],
    [
      { kind: "timestamp" },
      { type: "string", pattern: LOCAL_DATE_TIME_PATTERN },
    ],
    [{ kind: "timestamptz" }, { type: "string", format: "date-time" }],
    [{ kind: "json" }, {}],
    [{ kind: "binary" }, { type: "string", contentEncoding: "base64" }],
    [{ kind: "enum", enumId: "enum_status" }, { $ref: STATUS_REF }],
    [{ kind: "custom", name: "geometry" }, {}],
  ])(
    "maps every json field type to an openapi 3.1 schema (%o)",
    (type, expected) => {
      expect(propertySchema({ type })).toStrictEqual(expected);
    },
  );

  it("maps an enum that is not found to a string", () => {
    expect(
      propertySchema({ type: { kind: "enum", enumId: "enum_missing" } }),
    ).toStrictEqual({ type: "string" });
  });

  it("writes nullable types as a type array", () => {
    expect(
      propertySchema({
        type: { kind: "varchar", length: 5 },
        isNullable: true,
      }),
    ).toStrictEqual({ type: ["string", "null"], maxLength: 5 });
  });

  it("wraps a nullable enum reference in anyOf with null", () => {
    expect(
      propertySchema({
        type: { kind: "enum", enumId: "enum_status" },
        isNullable: true,
      }),
    ).toStrictEqual({ anyOf: [{ $ref: STATUS_REF }, { type: "null" }] });
  });

  it("keeps an empty schema for nullable json", () => {
    expect(
      propertySchema({ type: { kind: "json" }, isNullable: true }),
    ).toStrictEqual({});
  });

  it("adds a column comment as description", () => {
    expect([
      propertySchema({ comment: 'Mã "đơn"\nhàng' }),
      propertySchema({
        type: { kind: "enum", enumId: "enum_status" },
        comment: "status",
      }),
    ]).toStrictEqual([
      { type: "integer", format: "int32", description: 'Mã "đơn"\nhàng' },
      { $ref: STATUS_REF, description: "status" },
    ]);
  });
});

describe("buildComponentSchemas", () => {
  it("reports custom-type-unmapped for a custom column", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      columns: [
        column({ id: "col_shape", type: { kind: "custom", name: "geometry" } }),
      ],
    });

    expect(
      buildComponentSchemas(schema, buildRestApiNames(schema)).diagnostics,
    ).toStrictEqual([
      { code: "custom-type-unmapped", path: ["columns", "col_shape", "type"] },
    ]);
  });

  it("writes required with every column in column order", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_users", name: "users", comment: "Người dùng" }),
      ],
      columns: [
        column({ id: "col_b", name: "họ tên", type: { kind: "text" } }),
        column({ id: "col_a", name: "id" }),
        column({ id: "col_c", name: "note", isNullable: true }),
      ],
    });

    expect(
      buildComponentSchemas(schema, buildRestApiNames(schema)).schemas,
    ).toStrictEqual({
      Users: {
        type: "object",
        description: "Người dùng",
        properties: {
          "họ tên": { type: "string" },
          id: { type: "integer", format: "int32" },
          note: { type: ["integer", "null"], format: "int32" },
        },
        required: ["họ tên", "id", "note"],
      },
    });
  });

  it("writes an enum component with its values", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      enums: [
        makeEnum({
          id: "enum_status",
          name: "status",
          values: ["pending", "đã giao"],
        }),
      ],
    });

    expect(
      Object.entries(
        buildComponentSchemas(schema, buildRestApiNames(schema)).schemas,
      ),
    ).toStrictEqual([
      ["Status", { type: "string", enum: ["pending", "đã giao"] }],
      ["Users", { type: "object", properties: {}, required: [] }],
    ]);
  });
});
