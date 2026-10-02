import { describe, expect, it } from "vitest";

import type { Column } from "../model/column.js";
import type { ColumnType } from "../model/column-type.js";
import type { ColumnId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import { validateSchema } from "../validation/validate-schema.js";
import { createTargetLimitSchema } from "./target-limit-schema.js";

const SURROGATE_PAIR_START = 3749;
const GRINNING_FACE = 0x1f600;

function findTable(schema: SchemaDocument, name: string): Table {
  const table = Object.values(schema.tables).find(
    (candidate) => candidate.name === name,
  );
  if (table === undefined) {
    throw new Error(`No table named ${name}`);
  }
  return table;
}

function findColumn(
  schema: SchemaDocument,
  tableName: string,
  columnName: string,
): Column {
  const table = findTable(schema, tableName);
  const column = Object.values(schema.columns).find(
    (candidate) =>
      candidate.tableId === table.id && candidate.name === columnName,
  );
  if (column === undefined) {
    throw new Error(`Table ${tableName} has no column named ${columnName}`);
  }
  return column;
}

function columnName(schema: SchemaDocument, columnId: ColumnId): string {
  return schema.columns[columnId]?.name ?? columnId;
}

function columnNames(
  schema: SchemaDocument,
  columnIds: readonly ColumnId[],
): string {
  return columnIds.map((columnId) => columnName(schema, columnId)).join(",");
}

function tableName(schema: SchemaDocument, tableId: string): string {
  return (
    Object.values(schema.tables).find((table) => table.id === tableId)?.name ??
    tableId
  );
}

// "from(columns) -> to(columns) onDelete", so a test reads like the schema.
function describeRelations(schema: SchemaDocument): readonly string[] {
  return Object.values(schema.relations).map((relation) => {
    const from = columnNames(
      schema,
      relation.columnPairs.map((pair) => pair.fromColumnId),
    );
    const to = columnNames(
      schema,
      relation.columnPairs.map((pair) => pair.toColumnId),
    );
    return `${tableName(schema, relation.fromTableId)}(${from}) -> ${tableName(schema, relation.toTableId)}(${to}) ${relation.onDelete}`;
  });
}

// "table(columns) unique|plain" for every index.
function describeIndexes(schema: SchemaDocument): readonly string[] {
  return Object.values(schema.indexes).map(
    (index) =>
      `${tableName(schema, index.tableId)}(${columnNames(schema, index.columnIds)}) ${index.isUnique ? "unique" : "plain"}`,
  );
}

function describePrimaryKey(schema: SchemaDocument, name: string): string {
  return columnNames(schema, findTable(schema, name).primaryKeyColumnIds);
}

function listColumnTypes(
  schema: SchemaDocument,
  name: string,
): readonly ColumnType[] {
  const table = findTable(schema, name);
  return table.columnIds.flatMap((columnId) => {
    const column = schema.columns[columnId];
    return column === undefined ? [] : [column.type];
  });
}

describe("createTargetLimitSchema", () => {
  it("has no semantic issues", () => {
    expect(validateSchema(createTargetLimitSchema())).toStrictEqual([]);
  });

  it("returns structurally equal schemas on every call", () => {
    expect(createTargetLimitSchema()).toStrictEqual(createTargetLimitSchema());
  });

  it("contains a cascade cycle and a second cascade path", () => {
    expect(describeRelations(createTargetLimitSchema())).toEqual(
      expect.arrayContaining([
        "cycle_a(b_id) -> cycle_b(id) cascade",
        "cycle_b(a_id) -> cycle_a(id) cascade",
        "left(root_id) -> root(id) cascade",
        "right(root_id) -> root(id) cascade",
        "leaf(left_id) -> left(id) cascade",
        "leaf(right_id) -> right(id) cascade",
        "root(leaf_id) -> leaf(id) restrict",
        "tree_nodes(parent_id) -> tree_nodes(id) setNull",
      ]),
    );
  });

  it("contains a cycle of required foreign keys", () => {
    const schema = createTargetLimitSchema();

    expect(describeRelations(schema)).toEqual(
      expect.arrayContaining([
        "required_a(b_id) -> required_b(id) noAction",
        "required_b(a_id) -> required_a(id) noAction",
        "required_child(a_id) -> required_a(id) noAction",
      ]),
    );
    expect([
      findColumn(schema, "required_a", "b_id").isNullable,
      findColumn(schema, "required_b", "a_id").isNullable,
    ]).toStrictEqual([false, false]);
  });

  it("contains text, json and binary columns in keys", () => {
    const schema = createTargetLimitSchema();

    expect({
      textPrimaryKey: findColumn(schema, "text_keys", "code").type,
      textUnique: findColumn(schema, "text_keys", "label").isUnique,
      textIndex: findColumn(schema, "text_keys", "tag").type,
      jsonPrimaryKey: findColumn(schema, "json_keys", "doc").type,
      jsonUnique: findColumn(schema, "json_unique", "doc").isUnique,
      binaryIndex: findColumn(schema, "binary_keys", "hash").type,
      primaryKeys: [
        describePrimaryKey(schema, "text_keys"),
        describePrimaryKey(schema, "json_keys"),
      ],
    }).toStrictEqual({
      textPrimaryKey: { kind: "text" },
      textUnique: true,
      textIndex: { kind: "text" },
      jsonPrimaryKey: { kind: "json" },
      jsonUnique: true,
      binaryIndex: { kind: "binary" },
      primaryKeys: ["code", "doc"],
    });
    expect(describeIndexes(schema)).toEqual(
      expect.arrayContaining([
        "text_keys(tag) plain",
        "binary_keys(hash) unique",
      ]),
    );
    expect(describeRelations(schema)).toEqual(
      expect.arrayContaining([
        "text_refs(text_key_code) -> text_keys(code) noAction",
        "json_refs(doc) -> json_unique(doc) noAction",
      ]),
    );
  });

  it("contains type parameters beyond every dialect limit", () => {
    expect(
      listColumnTypes(createTargetLimitSchema(), "oversized_types"),
    ).toStrictEqual([
      { kind: "integer" },
      { kind: "varchar", length: 10_485_761 },
      { kind: "char", length: 256 },
      { kind: "varchar", length: 16_384 },
      { kind: "char", length: 4001 },
      { kind: "varchar", length: 4001 },
      { kind: "decimal", precision: 1001, scale: 2 },
      { kind: "decimal", precision: 40, scale: 31 },
    ]);
  });

  it("contains a nullable unique column referenced by a foreign key", () => {
    const schema = createTargetLimitSchema();
    const code = findColumn(schema, "nullable_unique", "code");

    expect([code.isNullable, code.isUnique]).toStrictEqual([true, true]);
    expect(describeRelations(schema)).toContain(
      "nullable_unique_refs(code) -> nullable_unique(code) noAction",
    );
  });

  it("contains a unique index on a nullable column that no foreign key references", () => {
    const schema = createTargetLimitSchema();

    expect(findColumn(schema, "nullable_unique", "alt_code").isNullable).toBe(
      true,
    );
    expect(describeIndexes(schema)).toContain(
      "nullable_unique(alt_code) unique",
    );
  });

  it("contains tables without a primary key", () => {
    const schema = createTargetLimitSchema();

    expect({
      noKeyRows: describePrimaryKey(schema, "no_key_rows"),
      uniqueOnly: describePrimaryKey(schema, "unique_only"),
      uniqueOnlyCode: findColumn(schema, "unique_only", "code"),
    }).toMatchObject({
      noKeyRows: "",
      uniqueOnly: "",
      uniqueOnlyCode: { isNullable: false, isUnique: true },
    });
  });

  it("contains custom types with and without defaults", () => {
    const schema = createTargetLimitSchema();

    expect({
      nullable: findColumn(schema, "custom_values", "shape"),
      withDefault: findColumn(schema, "custom_values", "address"),
      required: findColumn(schema, "custom_required", "payload"),
      requiredTableColumns: listColumnTypes(schema, "custom_required").length,
    }).toMatchObject({
      nullable: { isNullable: true, defaultValue: null },
      withDefault: {
        isNullable: false,
        defaultValue: { kind: "literal", value: "127.0.0.1" },
      },
      required: { isNullable: false, defaultValue: null },
      requiredTableColumns: 2,
    });
  });

  it("contains a set default relation", () => {
    const schema = createTargetLimitSchema();

    expect(describeRelations(schema)).toContain(
      "default_children(parent_id) -> default_parents(id) setDefault",
    );
    expect(
      findColumn(schema, "default_children", "parent_id").defaultValue,
    ).toStrictEqual({ kind: "literal", value: "0" });
  });

  it("contains a default literal for every type that accepts one", () => {
    const literalDefaultKinds = Object.values(
      createTargetLimitSchema().columns,
    ).flatMap((column) =>
      column.defaultValue?.kind === "literal" ? [column.type.kind] : [],
    );

    expect(new Set(literalDefaultKinds)).toStrictEqual(
      new Set([
        "smallint",
        "integer",
        "bigint",
        "decimal",
        "real",
        "double",
        "boolean",
        "char",
        "varchar",
        "text",
        "uuid",
        "date",
        "time",
        "timestamp",
        "timestamptz",
        "json",
        "enum",
        "custom",
      ]),
    );
  });

  it("contains every non-custom column type in the all_types table", () => {
    const kinds = listColumnTypes(createTargetLimitSchema(), "all_types").map(
      (type) => type.kind,
    );

    expect(new Set(kinds).size).toBe(18);
  });

  it("contains current timestamp defaults on timestamp and timestamptz columns", () => {
    const schema = createTargetLimitSchema();

    expect([
      findColumn(schema, "all_types", "timestamp_now").defaultValue,
      findColumn(schema, "all_types", "timestamptz_now").defaultValue,
    ]).toStrictEqual([
      { kind: "currentTimestamp" },
      { kind: "currentTimestamp" },
    ]);
  });

  it("contains auto-increment primary keys of every integer type", () => {
    const schema = createTargetLimitSchema();

    expect([
      findColumn(schema, "auto_smallint", "id"),
      findColumn(schema, "auto_integer", "id"),
      findColumn(schema, "auto_wide_key", "id"),
    ]).toMatchObject([
      { type: { kind: "smallint" }, isAutoIncrement: true },
      { type: { kind: "integer" }, isAutoIncrement: true },
      { type: { kind: "bigint" }, isAutoIncrement: true },
    ]);
  });

  it("contains key columns beyond the MySQL key length limits", () => {
    const schema = createTargetLimitSchema();

    expect(findColumn(schema, "long_unique", "code")).toMatchObject({
      type: { kind: "varchar", length: 1000 },
      isUnique: true,
    });
    expect(findColumn(schema, "char_unique", "code")).toMatchObject({
      type: { kind: "char", length: 300 },
      isUnique: true,
    });
    expect(listColumnTypes(schema, "four_part_keys")).toContainEqual({
      kind: "varchar",
      length: 192,
    });
    expect(listColumnTypes(schema, "five_part_keys")).toContainEqual({
      kind: "varchar",
      length: 700,
    });
    expect(describeIndexes(schema)).toEqual(
      expect.arrayContaining([
        "four_part_keys(p1,p2,p3,p4) unique",
        "five_part_keys(q1,q2,q3,q4,q5) unique",
      ]),
    );
    expect(describeRelations(schema)).toContain(
      "five_part_refs(q1,q2,q3,q4,q5) -> five_part_keys(q1,q2,q3,q4,q5) noAction",
    );
  });

  it("contains a unique column beyond every dialect's varchar limit that no foreign key references", () => {
    const schema = createTargetLimitSchema();

    expect(findColumn(schema, "oversized_unique", "code")).toMatchObject({
      type: { kind: "varchar", length: 20_000 },
      isUnique: true,
    });
    expect(describeRelations(schema)).not.toContainEqual(
      expect.stringContaining("oversized_unique"),
    );
  });

  it("contains fixed-length keys beyond the SQL Server limits and a foreign key paired with one", () => {
    const schema = createTargetLimitSchema();

    expect({
      primaryKey: describePrimaryKey(schema, "fixed_keys"),
      primaryKeyType: findColumn(schema, "fixed_keys", "code").type,
      foreignKeyType: findColumn(schema, "fixed_refs", "fixed_code").type,
      unique: findColumn(schema, "fixed_unique", "code"),
    }).toMatchObject({
      primaryKey: "code",
      primaryKeyType: { kind: "char", length: 500 },
      foreignKeyType: { kind: "char", length: 500 },
      unique: { type: { kind: "char", length: 900 }, isUnique: true },
    });
    expect(describeRelations(schema)).toContain(
      "fixed_refs(fixed_code) -> fixed_keys(code) noAction",
    );
  });

  it("contains auto-increment columns that lead no MySQL index", () => {
    const schema = createTargetLimitSchema();

    expect({
      wideKey: describePrimaryKey(schema, "auto_wide_key"),
      wideKeyTypes: listColumnTypes(schema, "auto_wide_key"),
      trailingKey: describePrimaryKey(schema, "auto_trailing"),
      trailingId: findColumn(schema, "auto_trailing", "id").isAutoIncrement,
    }).toStrictEqual({
      wideKey: "id,code_a,code_b",
      wideKeyTypes: [
        { kind: "bigint" },
        { kind: "varchar", length: 700 },
        { kind: "varchar", length: 700 },
      ],
      trailingKey: "a,id",
      trailingId: true,
    });
  });

  it("contains a table row beyond the MySQL row size limit", () => {
    const schema = createTargetLimitSchema();

    expect({
      types: listColumnTypes(schema, "wide_rows"),
      primaryKey: describePrimaryKey(schema, "wide_rows"),
    }).toStrictEqual({
      types: [{ kind: "integer" }, { kind: "varchar", length: 16_383 }],
      primaryKey: "id",
    });
  });

  it("contains comments beyond the MySQL and SQL Server limits", () => {
    const schema = createTargetLimitSchema();
    const surrogateComment = findColumn(
      schema,
      "long_comments",
      "surrogate_note",
    ).comment;

    expect({
      table: findTable(schema, "long_comments").comment.length,
      column: findColumn(schema, "long_comments", "note").comment.length,
      surrogate: surrogateComment.length,
      straddlingCodePoint: surrogateComment.codePointAt(SURROGATE_PAIR_START),
    }).toStrictEqual({
      table: 2049,
      column: 1025,
      surrogate: 3751,
      straddlingCodePoint: GRINNING_FACE,
    });
  });

  it("contains time defaults with more than seven fractional digits", () => {
    const schema = createTargetLimitSchema();

    expect([
      findColumn(schema, "fractional_times", "starts_at").defaultValue,
      findColumn(schema, "fractional_times", "created_at").defaultValue,
    ]).toStrictEqual([
      { kind: "literal", value: "12:34:56.123456789" },
      { kind: "literal", value: "2026-01-02T03:04:05.12345678" },
    ]);
  });

  it("contains a nullable enum column and a unique boolean column", () => {
    const schema = createTargetLimitSchema();

    expect([
      findColumn(schema, "flags", "status"),
      findColumn(schema, "flags", "is_primary"),
    ]).toMatchObject([
      { type: { kind: "enum" }, isNullable: true },
      { type: { kind: "boolean" }, isUnique: true },
    ]);
  });
});
