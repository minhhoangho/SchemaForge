import { describe, expect, it } from "vitest";

import { createEmptySchema } from "../../model/create-empty-schema.js";
import type { EnumId } from "../../model/ids.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeTable,
} from "../../testing/factories.js";
import { formatDiagnosticsSnapshot } from "../../testing/generator-snapshot.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import type { JsonFieldType } from "../shared/json-representation.js";
import { decimalStringPattern } from "../shared/json-representation.js";
import { generateZod, renderJsonFieldZod } from "./generate-zod.js";

const STATUS_ENUM_ID: EnumId = "enum_status";
const ENUM_SCHEMA_NAMES: ReadonlyMap<EnumId, string> = new Map([
  [STATUS_ENUM_ID, "orderStatusSchema"],
]);

function generateContent(schema: SchemaDocument): string {
  return generateZod(schema, {}).file.content;
}

describe("generateZod", () => {
  it("names the file schemas.ts with language typescript", () => {
    const { file } = generateZod(createSampleSchema(), {});

    expect([file.fileName, file.language]).toStrictEqual([
      "schemas.ts",
      "typescript",
    ]);
  });

  it("imports z from zod once", () => {
    const content = generateContent(createSampleSchema());

    expect(content.startsWith('import { z } from "zod";\n\n')).toBe(true);
    expect(content.split('import { z } from "zod";')).toHaveLength(2);
  });

  it.each<readonly [JsonFieldType, string]>([
    [{ kind: "smallint" }, "z.int().min(-32768).max(32767)"],
    [{ kind: "int32" }, "z.int32()"],
    [
      { kind: "bigintString" },
      'z.string().regex(new RegExp("^-?(0|[1-9][0-9]*)$"))',
    ],
    [
      { kind: "decimalString", precision: 10, scale: 2 },
      'z.string().regex(new RegExp("^-?0*[0-9]{1,8}(\\\\.[0-9]{1,2})?$"))',
    ],
    [{ kind: "float" }, "z.number()"],
    [{ kind: "double" }, "z.number()"],
    [{ kind: "boolean" }, "z.boolean()"],
    [{ kind: "string", maxLength: 255 }, "z.string().max(255)"],
    [{ kind: "uuid" }, "z.guid()"],
    [{ kind: "date" }, "z.iso.date()"],
    [{ kind: "time" }, "z.iso.time()"],
    [{ kind: "localDateTime" }, "z.iso.datetime({ local: true })"],
    [{ kind: "offsetDateTime" }, "z.iso.datetime({ offset: true })"],
    [{ kind: "json" }, "z.json()"],
    [{ kind: "base64" }, "z.base64()"],
    [{ kind: "enum", enumId: STATUS_ENUM_ID }, "orderStatusSchema"],
    [{ kind: "unknown" }, "z.unknown()"],
  ])("maps every json field type to a zod 4 schema: %j", (fieldType, zod) => {
    expect(renderJsonFieldZod(fieldType, ENUM_SCHEMA_NAMES)).toBe(zod);
  });

  it("writes an unbounded string as z.string()", () => {
    expect(
      renderJsonFieldZod({ kind: "string", maxLength: null }, new Map()),
    ).toBe("z.string()");
  });

  it("writes a missing enum as z.string()", () => {
    expect(
      renderJsonFieldZod({ kind: "enum", enumId: STATUS_ENUM_ID }, new Map()),
    ).toBe("z.string()");
  });

  it("writes bigint and decimal patterns through new RegExp with a json string", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_amounts" })],
      columns: [
        makeColumn({
          id: "col_big",
          tableId: "tbl_amounts",
          type: { kind: "bigint" },
        }),
        makeColumn({
          id: "col_price",
          tableId: "tbl_amounts",
          type: { kind: "decimal", precision: 5, scale: 5 },
        }),
      ],
    });

    expect(generateContent(schema)).toContain(
      [
        "export const amountsSchema = z.object({",
        '  big: z.string().regex(new RegExp("^-?(0|[1-9][0-9]*)$")),',
        '  price: z.string().regex(new RegExp("^-?0+(\\\\.[0-9]{1,5})?$")),',
        "});",
      ].join("\n"),
    );
  });

  it("writes the decimal pattern of decimalStringPattern for the column precision and scale", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_amounts" })],
      columns: [
        makeColumn({
          id: "col_price",
          tableId: "tbl_amounts",
          type: { kind: "decimal", precision: 12, scale: 0 },
        }),
      ],
    });

    expect(generateContent(schema)).toContain(
      `  price: z.string().regex(new RegExp(${JSON.stringify(decimalStringPattern(12, 0))})),`,
    );
  });

  it("writes an enum schema with escaped values before table schemas", () => {
    const schema = buildSchema({
      enums: [
        makeEnum({
          id: STATUS_ENUM_ID,
          name: "order_status",
          values: ["pending", 'say "hi"', "đã giao"],
        }),
      ],
      tables: [makeTable({ id: "tbl_orders" })],
      columns: [
        makeColumn({
          id: "col_status",
          tableId: "tbl_orders",
          type: { kind: "enum", enumId: STATUS_ENUM_ID },
        }),
      ],
    });

    expect(generateContent(schema)).toBe(
      [
        'import { z } from "zod";',
        "",
        'export const orderStatusSchema = z.enum(["pending", "say \\"hi\\"", "đã giao"]);',
        "",
        "export const ordersSchema = z.object({",
        "  status: orderStatusSchema,",
        "});",
        "",
      ].join("\n"),
    );
  });

  it("writes an empty enum as z.never()", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: STATUS_ENUM_ID, name: "status", values: [] })],
    });

    expect(generateContent(schema)).toBe(
      [
        'import { z } from "zod";',
        "",
        "export const statusSchema = z.never();",
        "",
      ].join("\n"),
    );
  });

  it("writes object keys with original column names in column order", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "người dùng" })],
      columns: [
        makeColumn({ id: "col_name", tableId: "tbl_users", name: "họ tên" }),
        makeColumn({ id: "col_id", tableId: "tbl_users", name: "USER_ID" }),
        makeColumn({
          id: "col_proto",
          tableId: "tbl_users",
          name: "__proto__",
        }),
      ],
    });

    expect(generateContent(schema)).toContain(
      [
        "export const nguoiDungSchema = z.object({",
        '  "họ tên": z.int32(),',
        "  USER_ID: z.int32(),",
        '  ["__proto__"]: z.int32(),',
        "});",
      ].join("\n"),
    );
  });

  it("appends .nullable() to nullable columns", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: STATUS_ENUM_ID, name: "status" })],
      tables: [makeTable({ id: "tbl_users" })],
      columns: [
        makeColumn({
          id: "col_note",
          tableId: "tbl_users",
          type: { kind: "text" },
          isNullable: true,
        }),
        makeColumn({
          id: "col_status",
          tableId: "tbl_users",
          type: { kind: "enum", enumId: STATUS_ENUM_ID },
          isNullable: true,
        }),
      ],
    });

    expect(generateContent(schema)).toContain(
      [
        "  note: z.string().nullable(),",
        "  status: statusSchema.nullable(),",
      ].join("\n"),
    );
  });

  it("writes z.unknown() for a custom column and reports custom-type-unmapped", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_places" })],
      columns: [
        makeColumn({
          id: "col_point",
          tableId: "tbl_places",
          type: { kind: "custom", name: "geometry(Point, 4326)" },
        }),
      ],
    });

    const result = generateZod(schema, {});

    expect(result.file.content).toContain("  point: z.unknown(),");
    expect(result.diagnostics).toStrictEqual([
      { code: "custom-type-unmapped", path: ["columns", "col_point", "type"] },
    ]);
  });

  it("reports nothing for a schema without custom columns", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users" })],
      columns: [makeColumn({ id: "col_id", tableId: "tbl_users" })],
    });

    expect(generateZod(schema, {}).diagnostics).toStrictEqual([]);
  });

  it("writes comments as JSDoc and escapes a comment terminator", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", comment: "People */ here" })],
      columns: [
        makeColumn({
          id: "col_id",
          tableId: "tbl_users",
          comment: "First line\nSecond */ line",
        }),
      ],
    });

    expect(generateContent(schema)).toContain(
      [
        "/** People *\\/ here */",
        "export const usersSchema = z.object({",
        "  /**",
        "   * First line",
        "   * Second *\\/ line",
        "   */",
        "  id: z.int32(),",
        "});",
      ].join("\n"),
    );
  });

  it("suffixes repeated schema names with 2", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_a", name: "order items" }),
        makeTable({ id: "tbl_b", name: "order_items" }),
      ],
    });

    expect(generateContent(schema)).toContain(
      [
        "export const orderItemsSchema = z.object({});",
        "",
        "export const orderItemsSchema2 = z.object({});",
      ].join("\n"),
    );
  });

  it("names a table without latin letters tableSchema", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "用户" })],
    });

    expect(generateContent(schema)).toContain(
      "export const tableSchema = z.object({});",
    );
  });

  it("writes a table without columns as z.object({})", () => {
    const schema = buildSchema({ tables: [makeTable({ id: "tbl_users" })] });

    expect(generateContent(schema)).toBe(
      [
        'import { z } from "zod";',
        "",
        "export const usersSchema = z.object({});",
        "",
      ].join("\n"),
    );
  });

  it("writes an empty schema as a single newline", () => {
    const result = generateZod(createEmptySchema("Empty"), {});

    expect(result).toStrictEqual({
      file: { fileName: "schemas.ts", language: "typescript", content: "\n" },
      diagnostics: [],
    });
  });

  it("returns the same content when map keys were inserted in a different order", () => {
    const enums = [
      makeEnum({ id: "enum_a", name: "alpha" }),
      makeEnum({ id: "enum_b", name: "beta" }),
    ];
    const tables = [
      makeTable({ id: "tbl_a", name: "accounts" }),
      makeTable({ id: "tbl_b", name: "books" }),
    ];
    const columns = [
      makeColumn({ id: "col_a", tableId: "tbl_a" }),
      makeColumn({ id: "col_b", tableId: "tbl_b" }),
    ];

    const forward = buildSchema({ enums, tables, columns });
    const reversed = buildSchema({
      enums: [...enums].reverse(),
      tables: [...tables].reverse(),
      columns,
    });

    expect(generateContent(reversed)).toBe(generateContent(forward));
  });

  it.each<readonly [string, () => SchemaDocument]>([
    ["sample", createSampleSchema],
    ["naming-edge", createNamingEdgeSchema],
    ["target-limit", createTargetLimitSchema],
    ["empty", () => createEmptySchema("Empty")],
  ])("matches the snapshot for %s", async (fixture, createSchema) => {
    const result = generateZod(createSchema(), {});

    await expect(result.file.content).toMatchFileSnapshot(
      `../__snapshots__/zod/${fixture}.ts`,
    );
    await expect(
      formatDiagnosticsSnapshot(result.diagnostics),
    ).toMatchFileSnapshot(`../__snapshots__/zod/${fixture}.diagnostics.txt`);
  });
});
