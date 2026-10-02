import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
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
import {
  generateTypeScript,
  renderJsonFieldTypeScript,
} from "./generate-typescript.js";

const ENUM_TYPE_NAMES: ReadonlyMap<EnumId, string> = new Map([
  ["enum_status", "OrderStatus"],
]);

function tableSchema(
  columns: readonly Column[],
  name = "users",
): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_users", name })],
    columns,
  });
}

function column(overrides: Partial<Column> & Pick<Column, "id">): Column {
  return makeColumn({ tableId: "tbl_users", ...overrides });
}

function generate(schema: SchemaDocument): string {
  return generateTypeScript(schema, {}).file.content;
}

describe("generateTypeScript", () => {
  it("names the file types.ts with language typescript", () => {
    const { file } = generateTypeScript(createEmptySchema("Empty"), {});

    expect({ fileName: file.fileName, language: file.language }).toStrictEqual({
      fileName: "types.ts",
      language: "typescript",
    });
  });

  it.each<[JsonFieldType, string]>([
    [{ kind: "smallint" }, "number"],
    [{ kind: "int32" }, "number"],
    [{ kind: "bigintString" }, "string"],
    [{ kind: "decimalString", precision: 10, scale: 2 }, "string"],
    [{ kind: "float" }, "number"],
    [{ kind: "double" }, "number"],
    [{ kind: "boolean" }, "boolean"],
    [{ kind: "string", maxLength: 20 }, "string"],
    [{ kind: "uuid" }, "string"],
    [{ kind: "date" }, "string"],
    [{ kind: "time" }, "string"],
    [{ kind: "localDateTime" }, "string"],
    [{ kind: "offsetDateTime" }, "string"],
    [{ kind: "json" }, "JsonValue"],
    [{ kind: "base64" }, "string"],
    [{ kind: "enum", enumId: "enum_status" }, "OrderStatus"],
    [{ kind: "unknown" }, "unknown"],
  ])(
    "maps every json field type to a typescript type (%o)",
    (fieldType, expected) => {
      expect(renderJsonFieldTypeScript(fieldType, ENUM_TYPE_NAMES)).toBe(
        expected,
      );
    },
  );

  it("maps an enum that is not found to string", () => {
    expect(
      renderJsonFieldTypeScript(
        { kind: "enum", enumId: "enum_missing" },
        ENUM_TYPE_NAMES,
      ),
    ).toBe("string");
  });

  it("declares JsonValue only when a json column exists", () => {
    const withJson = tableSchema([
      column({ id: "col_meta", type: { kind: "json" } }),
    ]);
    const withoutJson = tableSchema([column({ id: "col_id" })]);

    expect([generate(withJson), generate(withoutJson)]).toStrictEqual([
      [
        "export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };",
        "",
        "export type Users = {",
        "  meta: JsonValue;",
        "};",
        "",
      ].join("\n"),
      ["export type Users = {", "  id: number;", "};", ""].join("\n"),
    ]);
  });

  it("suffixes a table named JsonValue", () => {
    const schema = tableSchema(
      [column({ id: "col_meta", type: { kind: "json" } })],
      "JsonValue",
    );

    expect(generate(schema)).toContain(
      "export type JsonValue_ = {\n  meta: JsonValue;\n};",
    );
  });

  it("suffixes a table named Record so an empty table still uses the global Record", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_record", name: "Record" }),
        makeTable({ id: "tbl_empty", name: "empty" }),
      ],
    });

    expect(generate(schema)).toBe(
      [
        "export type Empty = Record<string, never>;",
        "",
        "export type Record_ = Record<string, never>;",
        "",
      ].join("\n"),
    );
  });

  it("writes an enum as a union of escaped string literals", () => {
    const schema = buildSchema({
      enums: [
        makeEnum({
          id: "enum_status",
          name: "order_status",
          values: ["pending", "đã giao", 'say "hi"\\'],
        }),
      ],
    });

    expect(generate(schema)).toBe(
      'export type OrderStatus = "pending" | "đã giao" | "say \\"hi\\"\\\\";\n',
    );
  });

  it("writes an empty enum as never", () => {
    const schema = buildSchema({
      enums: [makeEnum({ id: "enum_status", name: "status", values: [] })],
    });

    expect(generate(schema)).toBe("export type Status = never;\n");
  });

  it("writes properties in column order with original column names as keys", () => {
    const schema = tableSchema([
      column({ id: "col_b", name: "họ tên", type: { kind: "text" } }),
      column({ id: "col_a", name: "USER_ID" }),
      column({ id: "col_c", name: "__proto__", type: { kind: "boolean" } }),
    ]);

    expect(generate(schema)).toBe(
      [
        "export type Users = {",
        '  "họ tên": string;',
        "  USER_ID: number;",
        '  ["__proto__"]: boolean;',
        "};",
        "",
      ].join("\n"),
    );
  });

  it("appends | null to nullable columns", () => {
    const schema = tableSchema([
      column({ id: "col_name", type: { kind: "text" }, isNullable: true }),
      column({
        id: "col_extra",
        type: { kind: "custom", name: "geometry" },
        isNullable: true,
      }),
    ]);

    expect(generate(schema)).toContain(
      "  name: string | null;\n  extra: unknown | null;\n",
    );
  });

  it("writes unknown for a custom column and reports custom-type-unmapped", () => {
    const schema = tableSchema([
      column({ id: "col_shape", type: { kind: "custom", name: "geometry" } }),
    ]);

    const result = generateTypeScript(schema, {});

    expect([result.file.content, result.diagnostics]).toStrictEqual([
      "export type Users = {\n  shape: unknown;\n};\n",
      [
        {
          code: "custom-type-unmapped",
          path: ["columns", "col_shape", "type"],
        },
      ],
    ]);
  });

  it("reports nothing for a schema without custom columns", () => {
    const schema = tableSchema([
      column({ id: "col_id" }),
      column({ id: "col_meta", type: { kind: "json" }, isNullable: true }),
      column({ id: "col_photo", type: { kind: "binary" } }),
    ]);

    expect(generateTypeScript(schema, {}).diagnostics).toStrictEqual([]);
  });

  it("writes table and column comments as JSDoc and escapes a comment terminator", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_users", name: "users", comment: "Bảng */ users" }),
      ],
      columns: [column({ id: "col_id", comment: "line one\nline */ two" })],
    });

    expect(generate(schema)).toBe(
      [
        "/** Bảng *\\/ users */",
        "export type Users = {",
        "  /**",
        "   * line one",
        "   * line *\\/ two",
        "   */",
        "  id: number;",
        "};",
        "",
      ].join("\n"),
    );
  });

  it("names types with PascalCase and suffixes repeated names", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_a", name: "order items" }),
        makeTable({ id: "tbl_b", name: "order_items" }),
      ],
    });

    expect(generate(schema)).toBe(
      [
        "export type OrderItems = Record<string, never>;",
        "",
        "export type OrderItems2 = Record<string, never>;",
        "",
      ].join("\n"),
    );
  });

  it("writes enums before tables and references the enum type name", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      columns: [
        column({
          id: "col_status",
          name: "status",
          type: { kind: "enum", enumId: "enum_status" },
        }),
      ],
      enums: [
        makeEnum({ id: "enum_status", name: "status", values: ["active"] }),
      ],
    });

    expect(generate(schema)).toBe(
      [
        'export type Status = "active";',
        "",
        "export type Users = {",
        "  status: Status;",
        "};",
        "",
      ].join("\n"),
    );
  });

  it("writes a table without columns as Record<string, never>", () => {
    expect(generate(tableSchema([]))).toBe(
      "export type Users = Record<string, never>;\n",
    );
  });

  it("writes an empty schema as a single newline", () => {
    expect(generate(createEmptySchema("Empty"))).toBe("\n");
  });

  it("returns the same content when map keys were inserted in a different order", () => {
    const schema = createSampleSchema();
    const reordered: SchemaDocument = {
      ...schema,
      tables: Object.fromEntries(Object.entries(schema.tables).reverse()),
      columns: Object.fromEntries(Object.entries(schema.columns).reverse()),
      enums: Object.fromEntries(Object.entries(schema.enums).reverse()),
    };

    expect(generateTypeScript(reordered, {})).toStrictEqual(
      generateTypeScript(schema, {}),
    );
  });

  it.each<[string, () => SchemaDocument]>([
    ["sample", createSampleSchema],
    ["naming-edge", createNamingEdgeSchema],
    ["target-limit", createTargetLimitSchema],
    ["empty", () => createEmptySchema("Empty")],
  ])("matches the snapshot for %s", async (fixture, createSchema) => {
    const result = generateTypeScript(createSchema(), {});

    await expect(result.file.content).toMatchFileSnapshot(
      `../__snapshots__/typescript/${fixture}.ts`,
    );
    await expect(
      formatDiagnosticsSnapshot(result.diagnostics),
    ).toMatchFileSnapshot(
      `../__snapshots__/typescript/${fixture}.diagnostics.txt`,
    );
  });
});
