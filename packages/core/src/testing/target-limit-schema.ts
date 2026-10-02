import type { Column } from "../model/column.js";
import type { ColumnType } from "../model/column-type.js";
import type { ColumnId, EnumId, GenerateId, TableId } from "../model/ids.js";
import {
  createColumnId,
  createEnumId,
  createIndexId,
  createRelationId,
  createTableId,
} from "../model/ids.js";
import type { ReferentialAction, Relation } from "../model/relation.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Index } from "../model/table-index.js";
import type { Table } from "../model/table.js";
import {
  buildSchema,
  createCounterIdGenerator,
  makeColumn,
  makeEnum,
  makeIndex,
  makeRelation,
  makeTable,
} from "./factories.js";

// The fixture is written as data that names tables and columns; ids only
// exist once generated, so an enum column names its enum too.
type ColumnTypeSpec =
  | Exclude<ColumnType, { readonly kind: "enum" }>
  | { readonly kind: "enum"; readonly enumName: string };

type ColumnSpec = Omit<Partial<Column>, "id" | "tableId" | "type"> & {
  readonly name: string;
  readonly type: ColumnTypeSpec;
};

type TableSpec = {
  readonly name: string;
  readonly comment?: string;
  readonly columns: readonly ColumnSpec[];
  readonly primaryKey?: readonly string[];
};

type RelationSpec = {
  readonly from: string;
  readonly to: string;
  readonly pairs: readonly (readonly [string, string])[];
  readonly onDelete: ReferentialAction;
};

type IndexSpec = {
  readonly name: string;
  readonly table: string;
  readonly columns: readonly string[];
  readonly isUnique: boolean;
};

const SCHEMA_NAME = "Target limits";
const STATUS_ENUM = { name: "flag_status", values: ["active", "inactive"] };
const TABLE_GRID_WIDTH = 8;
const TABLE_SPACING = 320;

// MySQL caps column comments at 1024 characters and table comments at 2048;
// SQL Server caps MS_Description at 3750 UTF-16 code units.
const MYSQL_COLUMN_COMMENT_LENGTH = 1025;
const MYSQL_TABLE_COMMENT_LENGTH = 2049;
const SQLSERVER_COMMENT_UNITS_BEFORE_PAIR = 3749;
// A surrogate pair at code units 3750-3751 (1-based) straddles the SQL Server limit.
const SURROGATE_PAIR_CHARACTER = "😀";

const INTEGER = { kind: "integer" } as const;
const BIGINT = { kind: "bigint" } as const;
const TEXT = { kind: "text" } as const;
const JSON_TYPE = { kind: "json" } as const;

const ID: ColumnSpec = { name: "id", type: INTEGER };

function integerColumn(name: string, isNullable = false): ColumnSpec {
  return { name, type: INTEGER, isNullable };
}

function varcharColumn(name: string, length: number): ColumnSpec {
  return { name, type: { kind: "varchar", length } };
}

function keyedTable(
  name: string,
  columns: readonly ColumnSpec[],
  comment?: string,
): TableSpec {
  return {
    name,
    columns: [ID, ...columns],
    primaryKey: ["id"],
    ...(comment === undefined ? {} : { comment }),
  };
}

// Cascade cycles, a second cascade path, a restrict edge closing a cycle,
// a set null self reference and a cycle of required foreign keys.
const CASCADE_TABLES: readonly TableSpec[] = [
  keyedTable("cycle_a", [integerColumn("b_id", true)]),
  keyedTable("cycle_b", [integerColumn("a_id", true)]),
  keyedTable("root", [integerColumn("leaf_id", true)]),
  keyedTable("left", [integerColumn("root_id")]),
  keyedTable("right", [integerColumn("root_id")]),
  keyedTable("leaf", [integerColumn("left_id"), integerColumn("right_id")]),
  keyedTable("tree_nodes", [integerColumn("parent_id", true)]),
  keyedTable("required_a", [integerColumn("b_id")]),
  keyedTable("required_b", [integerColumn("a_id")]),
  keyedTable("required_child", [integerColumn("a_id")]),
];

// Key columns of types MySQL or SQL Server cannot index as they are.
const KEY_TYPE_TABLES: readonly TableSpec[] = [
  {
    name: "text_keys",
    columns: [
      { name: "code", type: TEXT },
      { name: "label", type: TEXT, isUnique: true },
      { name: "tag", type: TEXT },
    ],
    primaryKey: ["code"],
  },
  keyedTable("text_refs", [{ name: "text_key_code", type: TEXT }]),
  {
    name: "json_keys",
    columns: [{ name: "doc", type: JSON_TYPE }],
    primaryKey: ["doc"],
  },
  keyedTable("json_unique", [{ name: "doc", type: JSON_TYPE, isUnique: true }]),
  keyedTable("json_refs", [{ name: "doc", type: JSON_TYPE }]),
  keyedTable("binary_keys", [{ name: "hash", type: { kind: "binary" } }]),
];

const FIVE_PART_COLUMNS = ["q1", "q2", "q3", "q4", "q5"];

// Key lengths beyond MySQL's 3072 bytes and SQL Server's 900 and 1700 bytes.
const KEY_LENGTH_TABLES: readonly TableSpec[] = [
  {
    name: "auto_wide_key",
    columns: [
      { name: "id", type: BIGINT, isAutoIncrement: true },
      varcharColumn("code_a", 700),
      varcharColumn("code_b", 700),
    ],
    primaryKey: ["id", "code_a", "code_b"],
  },
  {
    name: "auto_trailing",
    columns: [
      { name: "a", type: INTEGER },
      { name: "id", type: BIGINT, isAutoIncrement: true },
    ],
    primaryKey: ["a", "id"],
  },
  keyedTable("long_unique", [
    { name: "code", type: { kind: "varchar", length: 1000 }, isUnique: true },
  ]),
  keyedTable(
    "four_part_keys",
    ["p1", "p2", "p3", "p4"].map((name) => varcharColumn(name, 192)),
  ),
  keyedTable(
    "five_part_keys",
    FIVE_PART_COLUMNS.map((name) => varcharColumn(name, 700)),
  ),
  keyedTable(
    "five_part_refs",
    FIVE_PART_COLUMNS.map((name) => varcharColumn(name, 700)),
  ),
  {
    name: "fixed_keys",
    columns: [{ name: "code", type: { kind: "char", length: 500 } }],
    primaryKey: ["code"],
  },
  keyedTable("fixed_refs", [
    { name: "fixed_code", type: { kind: "char", length: 500 } },
  ]),
  keyedTable("fixed_unique", [
    { name: "code", type: { kind: "char", length: 900 }, isUnique: true },
  ]),
  keyedTable("char_unique", [
    { name: "code", type: { kind: "char", length: 300 }, isUnique: true },
  ]),
  // Beyond every dialect's varchar limit and in a key (spec R2).
  keyedTable("oversized_unique", [
    { ...varcharColumn("code", 20_000), isUnique: true },
  ]),
];

// Type parameters, rows and comments beyond the limits of some dialect.
const SIZE_TABLES: readonly TableSpec[] = [
  keyedTable("wide_rows", [varcharColumn("v", 16_383)]),
  keyedTable("oversized_types", [
    varcharColumn("pg_varchar", 10_485_761),
    { name: "mysql_char", type: { kind: "char", length: 256 } },
    varcharColumn("mysql_varchar", 16_384),
    { name: "sqlserver_char", type: { kind: "char", length: 4001 } },
    varcharColumn("sqlserver_varchar", 4001),
    {
      name: "pg_decimal",
      type: { kind: "decimal", precision: 1001, scale: 2 },
    },
    {
      name: "mysql_decimal",
      type: { kind: "decimal", precision: 40, scale: 31 },
    },
  ]),
  keyedTable(
    "long_comments",
    [
      {
        name: "note",
        type: TEXT,
        comment: "c".repeat(MYSQL_COLUMN_COMMENT_LENGTH),
      },
      {
        name: "surrogate_note",
        type: TEXT,
        comment:
          "s".repeat(SQLSERVER_COMMENT_UNITS_BEFORE_PAIR) +
          SURROGATE_PAIR_CHARACTER,
      },
    ],
    "t".repeat(MYSQL_TABLE_COMMENT_LENGTH),
  ),
];

// Uniqueness and nullability combinations each target treats differently.
const UNIQUENESS_TABLES: readonly TableSpec[] = [
  keyedTable("nullable_unique", [
    { ...varcharColumn("code", 20), isNullable: true, isUnique: true },
    { ...varcharColumn("alt_code", 20), isNullable: true },
  ]),
  keyedTable("nullable_unique_refs", [
    { ...varcharColumn("code", 20), isNullable: true },
  ]),
  {
    name: "no_key_rows",
    columns: [{ name: "note", type: TEXT }, integerColumn("value")],
  },
  {
    name: "unique_only",
    columns: [
      { ...varcharColumn("code", 20), isUnique: true },
      { name: "label", type: TEXT },
    ],
  },
  keyedTable("flags", [
    {
      name: "status",
      type: { kind: "enum", enumName: STATUS_ENUM.name },
      isNullable: true,
    },
    { name: "is_primary", type: { kind: "boolean" }, isUnique: true },
  ]),
];

function literal(value: string): Column["defaultValue"] {
  return { kind: "literal", value };
}

// Defaults, custom types and auto-increment types.
const VALUE_TABLES: readonly TableSpec[] = [
  keyedTable("custom_values", [
    {
      name: "shape",
      type: { kind: "custom", name: "geometry(Point, 4326)" },
      isNullable: true,
    },
    {
      name: "address",
      type: { kind: "custom", name: "inet" },
      defaultValue: literal("127.0.0.1"),
    },
  ]),
  // Seed skips a table with a required custom column, so it stands alone.
  keyedTable("custom_required", [
    { name: "payload", type: { kind: "custom", name: "tsvector" } },
  ]),
  keyedTable("default_parents", []),
  keyedTable("default_children", [
    { ...integerColumn("parent_id"), defaultValue: literal("0") },
  ]),
  keyedTable("fractional_times", [
    {
      name: "starts_at",
      type: { kind: "time" },
      defaultValue: literal("12:34:56.123456789"),
    },
    {
      name: "created_at",
      type: { kind: "timestamp" },
      defaultValue: literal("2026-01-02T03:04:05.12345678"),
    },
  ]),
  {
    name: "auto_smallint",
    columns: [
      { name: "id", type: { kind: "smallint" }, isAutoIncrement: true },
    ],
    primaryKey: ["id"],
  },
  {
    name: "auto_integer",
    columns: [{ name: "id", type: INTEGER, isAutoIncrement: true }],
    primaryKey: ["id"],
  },
];

// Every column type except custom, with a literal default wherever one is accepted.
const ALL_TYPES_TABLE: TableSpec = keyedTable("all_types", [
  {
    name: "smallint_value",
    type: { kind: "smallint" },
    defaultValue: literal("-32768"),
  },
  { name: "integer_value", type: INTEGER, defaultValue: literal("42") },
  {
    name: "bigint_value",
    type: BIGINT,
    defaultValue: literal("9223372036854775807"),
  },
  {
    name: "decimal_value",
    type: { kind: "decimal", precision: 12, scale: 2 },
    defaultValue: literal("1234567890.12"),
  },
  {
    name: "real_value",
    type: { kind: "real" },
    defaultValue: literal("1.5e10"),
  },
  {
    name: "double_value",
    type: { kind: "double" },
    defaultValue: literal("-2.25"),
  },
  {
    name: "boolean_value",
    type: { kind: "boolean" },
    defaultValue: literal("true"),
  },
  {
    name: "char_value",
    type: { kind: "char", length: 3 },
    defaultValue: literal("abc"),
  },
  {
    name: "varchar_value",
    type: { kind: "varchar", length: 20 },
    defaultValue: literal("it's"),
  },
  { name: "text_value", type: TEXT, defaultValue: literal("a\\b") },
  {
    name: "uuid_value",
    type: { kind: "uuid" },
    defaultValue: literal("123e4567-e89b-12d3-a456-426614174000"),
  },
  {
    name: "date_value",
    type: { kind: "date" },
    defaultValue: literal("2026-01-02"),
  },
  {
    name: "time_value",
    type: { kind: "time" },
    defaultValue: literal("12:34:56.789"),
  },
  {
    name: "timestamp_value",
    type: { kind: "timestamp" },
    defaultValue: literal("2026-01-02T03:04:05"),
  },
  {
    name: "timestamptz_value",
    type: { kind: "timestamptz" },
    defaultValue: literal("2026-01-02T03:04:05.123+07:00"),
  },
  {
    name: "timestamp_now",
    type: { kind: "timestamp" },
    defaultValue: { kind: "currentTimestamp" },
  },
  {
    name: "timestamptz_now",
    type: { kind: "timestamptz" },
    defaultValue: { kind: "currentTimestamp" },
  },
  {
    name: "json_value",
    type: JSON_TYPE,
    defaultValue: literal(`{"note":"it's"}`),
  },
  { name: "binary_value", type: { kind: "binary" }, isNullable: true },
  {
    name: "enum_value",
    type: { kind: "enum", enumName: STATUS_ENUM.name },
    defaultValue: literal("active"),
  },
]);

const TABLES: readonly TableSpec[] = [
  ...CASCADE_TABLES,
  ...KEY_TYPE_TABLES,
  ...KEY_LENGTH_TABLES,
  ...SIZE_TABLES,
  ...UNIQUENESS_TABLES,
  ...VALUE_TABLES,
  ALL_TYPES_TABLE,
];

function singleColumnRelation(
  from: string,
  to: string,
  onDelete: ReferentialAction,
): RelationSpec {
  const [fromTable = "", fromColumn = ""] = from.split(".");
  const [toTable = "", toColumn = ""] = to.split(".");
  return {
    from: fromTable,
    to: toTable,
    pairs: [[fromColumn, toColumn]],
    onDelete,
  };
}

const RELATIONS: readonly RelationSpec[] = [
  singleColumnRelation("cycle_a.b_id", "cycle_b.id", "cascade"),
  singleColumnRelation("cycle_b.a_id", "cycle_a.id", "cascade"),
  singleColumnRelation("left.root_id", "root.id", "cascade"),
  singleColumnRelation("right.root_id", "root.id", "cascade"),
  singleColumnRelation("leaf.left_id", "left.id", "cascade"),
  singleColumnRelation("leaf.right_id", "right.id", "cascade"),
  singleColumnRelation("root.leaf_id", "leaf.id", "restrict"),
  singleColumnRelation("tree_nodes.parent_id", "tree_nodes.id", "setNull"),
  singleColumnRelation("required_a.b_id", "required_b.id", "noAction"),
  singleColumnRelation("required_b.a_id", "required_a.id", "noAction"),
  singleColumnRelation("required_child.a_id", "required_a.id", "noAction"),
  singleColumnRelation("text_refs.text_key_code", "text_keys.code", "noAction"),
  singleColumnRelation("json_refs.doc", "json_unique.doc", "noAction"),
  singleColumnRelation("fixed_refs.fixed_code", "fixed_keys.code", "noAction"),
  singleColumnRelation(
    "nullable_unique_refs.code",
    "nullable_unique.code",
    "noAction",
  ),
  singleColumnRelation(
    "default_children.parent_id",
    "default_parents.id",
    "setDefault",
  ),
  {
    from: "five_part_refs",
    to: "five_part_keys",
    pairs: FIVE_PART_COLUMNS.map((name) => [name, name] as const),
    onDelete: "noAction",
  },
];

const INDEXES: readonly IndexSpec[] = [
  {
    name: "text_keys_tag_ix",
    table: "text_keys",
    columns: ["tag"],
    isUnique: false,
  },
  {
    name: "binary_keys_hash_ux",
    table: "binary_keys",
    columns: ["hash"],
    isUnique: true,
  },
  {
    name: "nullable_unique_alt_code_ux",
    table: "nullable_unique",
    columns: ["alt_code"],
    isUnique: true,
  },
  {
    name: "four_part_keys_ux",
    table: "four_part_keys",
    columns: ["p1", "p2", "p3", "p4"],
    isUnique: true,
  },
  {
    name: "five_part_keys_ux",
    table: "five_part_keys",
    columns: FIVE_PART_COLUMNS,
    isUnique: true,
  },
];

type ResolvedTables = {
  readonly tables: readonly Table[];
  readonly columns: readonly Column[];
  readonly tableIds: ReadonlyMap<string, TableId>;
  readonly columnIds: ReadonlyMap<string, ColumnId>;
};

function lookup<Id>(ids: ReadonlyMap<string, Id>, key: string): Id {
  const id = ids.get(key);
  if (id === undefined) {
    throw new Error(`The target limit schema has no element named ${key}`);
  }
  return id;
}

function resolveType(type: ColumnTypeSpec, enumId: EnumId): ColumnType {
  return type.kind === "enum" ? { kind: "enum", enumId } : type;
}

function resolveTables(generateId: GenerateId, enumId: EnumId): ResolvedTables {
  const tableIds = new Map<string, TableId>();
  const columnIds = new Map<string, ColumnId>();
  const columns: Column[] = [];
  const tables = TABLES.map((spec, index): Table => {
    const tableId = createTableId(generateId);
    tableIds.set(spec.name, tableId);
    for (const columnSpec of spec.columns) {
      const column = makeColumn({
        ...columnSpec,
        id: createColumnId(generateId),
        tableId,
        type: resolveType(columnSpec.type, enumId),
      });
      columnIds.set(`${spec.name}.${column.name}`, column.id);
      columns.push(column);
    }
    return makeTable({
      id: tableId,
      name: spec.name,
      comment: spec.comment ?? "",
      position: {
        x: (index % TABLE_GRID_WIDTH) * TABLE_SPACING,
        y: Math.floor(index / TABLE_GRID_WIDTH) * TABLE_SPACING,
      },
      primaryKeyColumnIds: (spec.primaryKey ?? []).map((name) =>
        lookup(columnIds, `${spec.name}.${name}`),
      ),
    });
  });
  return { tables, columns, tableIds, columnIds };
}

function resolveRelation(
  generateId: GenerateId,
  resolved: ResolvedTables,
  spec: RelationSpec,
): Relation {
  return makeRelation({
    id: createRelationId(generateId),
    fromTableId: lookup(resolved.tableIds, spec.from),
    toTableId: lookup(resolved.tableIds, spec.to),
    columnPairs: spec.pairs.map(([fromColumn, toColumn]) => ({
      fromColumnId: lookup(resolved.columnIds, `${spec.from}.${fromColumn}`),
      toColumnId: lookup(resolved.columnIds, `${spec.to}.${toColumn}`),
    })),
    onDelete: spec.onDelete,
  });
}

function resolveIndex(
  generateId: GenerateId,
  resolved: ResolvedTables,
  spec: IndexSpec,
): Index {
  return makeIndex({
    id: createIndexId(generateId),
    tableId: lookup(resolved.tableIds, spec.table),
    name: spec.name,
    columnIds: spec.columns.map((name) =>
      lookup(resolved.columnIds, `${spec.table}.${name}`),
    ),
    isUnique: spec.isUnique,
  });
}

/**
 * Returns a semantically valid schema that holds every case of the target
 * limits matrix (code generators spec, section 4), one group of tables per
 * case. Every call returns an equal schema.
 */
export function createTargetLimitSchema(): SchemaDocument {
  const generateId = createCounterIdGenerator();
  const statusEnum = makeEnum({ id: createEnumId(generateId), ...STATUS_ENUM });
  const resolved = resolveTables(generateId, statusEnum.id);
  return buildSchema({
    name: SCHEMA_NAME,
    tables: resolved.tables,
    columns: resolved.columns,
    relations: RELATIONS.map((spec) =>
      resolveRelation(generateId, resolved, spec),
    ),
    indexes: INDEXES.map((spec) => resolveIndex(generateId, resolved, spec)),
    enums: [statusEnum],
  });
}
