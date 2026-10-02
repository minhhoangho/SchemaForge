import { type MySqlTableExtraConfigValue, bigint, boolean, char, customType, date, datetime, decimal, double, float, foreignKey, index, int, json, longtext, mysqlEnum, mysqlTable, primaryKey, smallint, time, timestamp, unique, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { relations, sql } from "drizzle-orm";

export const longblobType = customType<{ data: Uint8Array }>({
  dataType() {
    return "longblob";
  },
});

export const tsvectorType = customType<{ data: unknown }>({
  dataType() {
    return "tsvector";
  },
});

export const geometryPoint4326Type = customType<{ data: unknown }>({
  dataType() {
    return "geometry(Point, 4326)";
  },
});

export const inetType = customType<{ data: unknown }>({
  dataType() {
    return "inet";
  },
});

export const allTypes = mysqlTable(
  "all_types",
  {
    id: int("id").notNull(),
    smallintValue: smallint("smallint_value").notNull().default(-32768),
    integerValue: int("integer_value").notNull().default(42),
    bigintValue: bigint("bigint_value", { mode: "bigint" }).notNull().default(sql.raw("9223372036854775807")),
    decimalValue: decimal("decimal_value", { precision: 12, scale: 2 }).notNull().default("1234567890.12"),
    realValue: float("real_value").notNull().default(sql.raw("1.5e10")),
    doubleValue: double("double_value").notNull().default(sql.raw("-2.25")),
    booleanValue: boolean("boolean_value").notNull().default(true),
    charValue: char("char_value", { length: 3 }).notNull().default("abc"),
    varcharValue: varchar("varchar_value", { length: 20 }).notNull().default("it's"),
    textValue: longtext("text_value").notNull().default(sql.raw("('a\\\\b')")),
    uuidValue: char("uuid_value", { length: 36 }).notNull().default("123e4567-e89b-12d3-a456-426614174000"),
    dateValue: date("date_value").notNull().default(sql.raw("'2026-01-02'")),
    timeValue: time("time_value", { fsp: 6 }).notNull().default(sql.raw("'12:34:56.789'")),
    timestampValue: datetime("timestamp_value", { fsp: 6 }).notNull().default(sql.raw("'2026-01-02T03:04:05'")),
    timestamptzValue: timestamp("timestamptz_value", { fsp: 6 }).notNull().default(sql.raw("'2026-01-02T03:04:05.123+07:00'")),
    timestampNow: datetime("timestamp_now", { fsp: 6 }).notNull().default(sql.raw("CURRENT_TIMESTAMP(6)")),
    timestamptzNow: timestamp("timestamptz_now", { fsp: 6 }).notNull().default(sql.raw("CURRENT_TIMESTAMP(6)")),
    jsonValue: json("json_value").notNull().default(sql.raw("('{\"note\":\"it''s\"}')")),
    binaryValue: longblobType("binary_value"),
    enumValue: mysqlEnum("enum_value", ["active", "inactive"]).notNull().default("active"),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "all_types_pkey", columns: [table.id] }),
  ],
);

export const autoInteger = mysqlTable(
  "auto_integer",
  {
    id: int("id").notNull().autoincrement(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "auto_integer_pkey", columns: [table.id] }),
  ],
);

export const autoSmallint = mysqlTable(
  "auto_smallint",
  {
    id: smallint("id").notNull().autoincrement(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "auto_smallint_pkey", columns: [table.id] }),
  ],
);

export const autoTrailing = mysqlTable(
  "auto_trailing",
  {
    a: int("a").notNull(),
    id: bigint("id", { mode: "bigint" }).notNull().autoincrement(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "auto_trailing_pkey", columns: [table.a, table.id] }),
    index("auto_trailing_id_idx").on(table.id),
  ],
);

export const autoWideKey = mysqlTable(
  "auto_wide_key",
  {
    id: bigint("id", { mode: "bigint" }).notNull().autoincrement(),
    codeA: varchar("code_a", { length: 700 }).notNull(),
    codeB: varchar("code_b", { length: 700 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    index("auto_wide_key_id_idx").on(table.id),
  ],
);

export const binaryKeys = mysqlTable(
  "binary_keys",
  {
    id: int("id").notNull(),
    hash: longblobType("hash").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "binary_keys_pkey", columns: [table.id] }),
  ],
);

export const charUnique = mysqlTable(
  "char_unique",
  {
    id: int("id").notNull(),
    code: varchar("code", { length: 300 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "char_unique_pkey", columns: [table.id] }),
    unique("char_unique_code_key").on(table.code),
  ],
);

export const customRequired = mysqlTable(
  "custom_required",
  {
    id: int("id").notNull(),
    payload: tsvectorType("payload").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "custom_required_pkey", columns: [table.id] }),
  ],
);

export const customValues = mysqlTable(
  "custom_values",
  {
    id: int("id").notNull(),
    shape: geometryPoint4326Type("shape"),
    address: inetType("address").notNull().default(sql.raw("'127.0.0.1'")),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "custom_values_pkey", columns: [table.id] }),
  ],
);

export const cycleA = mysqlTable(
  "cycle_a",
  {
    id: int("id").notNull(),
    bId: int("b_id"),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "cycle_a_pkey", columns: [table.id] }),
    foreignKey({ name: "cycle_a_b_id_fkey", columns: [table.bId], foreignColumns: [cycleB.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const cycleB = mysqlTable(
  "cycle_b",
  {
    id: int("id").notNull(),
    aId: int("a_id"),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "cycle_b_pkey", columns: [table.id] }),
    foreignKey({ name: "cycle_b_a_id_fkey", columns: [table.aId], foreignColumns: [cycleA.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const defaultChildren = mysqlTable(
  "default_children",
  {
    id: int("id").notNull(),
    parentId: int("parent_id").notNull().default(0),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "default_children_pkey", columns: [table.id] }),
    foreignKey({ name: "default_children_parent_id_fkey", columns: [table.parentId], foreignColumns: [defaultParents.id] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const defaultParents = mysqlTable(
  "default_parents",
  {
    id: int("id").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "default_parents_pkey", columns: [table.id] }),
  ],
);

export const fivePartKeys = mysqlTable(
  "five_part_keys",
  {
    id: int("id").notNull(),
    q1: varchar("q1", { length: 700 }).notNull(),
    q2: varchar("q2", { length: 700 }).notNull(),
    q3: varchar("q3", { length: 700 }).notNull(),
    q4: varchar("q4", { length: 700 }).notNull(),
    q5: varchar("q5", { length: 700 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "five_part_keys_pkey", columns: [table.id] }),
  ],
);

export const fivePartRefs = mysqlTable(
  "five_part_refs",
  {
    id: int("id").notNull(),
    q1: varchar("q1", { length: 700 }).notNull(),
    q2: varchar("q2", { length: 700 }).notNull(),
    q3: varchar("q3", { length: 700 }).notNull(),
    q4: varchar("q4", { length: 700 }).notNull(),
    q5: varchar("q5", { length: 700 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "five_part_refs_pkey", columns: [table.id] }),
  ],
);

export const fixedKeys = mysqlTable(
  "fixed_keys",
  {
    code: varchar("code", { length: 500 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "fixed_keys_pkey", columns: [table.code] }),
  ],
);

export const fixedRefs = mysqlTable(
  "fixed_refs",
  {
    id: int("id").notNull(),
    fixedCode: varchar("fixed_code", { length: 500 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "fixed_refs_pkey", columns: [table.id] }),
    foreignKey({ name: "fixed_refs_fixed_code_fkey", columns: [table.fixedCode], foreignColumns: [fixedKeys.code] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const fixedUnique = mysqlTable(
  "fixed_unique",
  {
    id: int("id").notNull(),
    code: varchar("code", { length: 768 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "fixed_unique_pkey", columns: [table.id] }),
    unique("fixed_unique_code_key").on(table.code),
  ],
);

export const flags = mysqlTable(
  "flags",
  {
    id: int("id").notNull(),
    status: mysqlEnum("status", ["active", "inactive"]),
    isPrimary: boolean("is_primary").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "flags_pkey", columns: [table.id] }),
    unique("flags_is_primary_key").on(table.isPrimary),
  ],
);

export const fourPartKeys = mysqlTable(
  "four_part_keys",
  {
    id: int("id").notNull(),
    p1: varchar("p1", { length: 192 }).notNull(),
    p2: varchar("p2", { length: 192 }).notNull(),
    p3: varchar("p3", { length: 192 }).notNull(),
    p4: varchar("p4", { length: 192 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "four_part_keys_pkey", columns: [table.id] }),
    uniqueIndex("four_part_keys_ux").on(table.p1, table.p2, table.p3, table.p4),
  ],
);

export const fractionalTimes = mysqlTable(
  "fractional_times",
  {
    id: int("id").notNull(),
    startsAt: time("starts_at", { fsp: 6 }).notNull().default(sql.raw("'12:34:56.123456'")),
    createdAt: datetime("created_at", { fsp: 6 }).notNull().default(sql.raw("'2026-01-02T03:04:05.123456'")),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "fractional_times_pkey", columns: [table.id] }),
  ],
);

export const jsonKeys = mysqlTable(
  "json_keys",
  {
    doc: json("doc").notNull(),
  },
);

export const jsonRefs = mysqlTable(
  "json_refs",
  {
    id: int("id").notNull(),
    doc: json("doc").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "json_refs_pkey", columns: [table.id] }),
  ],
);

export const jsonUnique = mysqlTable(
  "json_unique",
  {
    id: int("id").notNull(),
    doc: json("doc").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "json_unique_pkey", columns: [table.id] }),
  ],
);

export const leaf = mysqlTable(
  "leaf",
  {
    id: int("id").notNull(),
    leftId: int("left_id").notNull(),
    rightId: int("right_id").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "leaf_pkey", columns: [table.id] }),
    foreignKey({ name: "leaf_left_id_fkey", columns: [table.leftId], foreignColumns: [left.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
    foreignKey({ name: "leaf_right_id_fkey", columns: [table.rightId], foreignColumns: [right.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const left = mysqlTable(
  "left",
  {
    id: int("id").notNull(),
    rootId: int("root_id").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "left_pkey", columns: [table.id] }),
    foreignKey({ name: "left_root_id_fkey", columns: [table.rootId], foreignColumns: [root.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

/** ttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt */
export const longComments = mysqlTable(
  "long_comments",
  {
    id: int("id").notNull(),
    /** ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc */
    note: longtext("note").notNull(),
    /** sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss😀 */
    surrogateNote: longtext("surrogate_note").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "long_comments_pkey", columns: [table.id] }),
  ],
);

export const longUnique = mysqlTable(
  "long_unique",
  {
    id: int("id").notNull(),
    code: varchar("code", { length: 768 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "long_unique_pkey", columns: [table.id] }),
    unique("long_unique_code_key").on(table.code),
  ],
);

export const noKeyRows = mysqlTable(
  "no_key_rows",
  {
    note: longtext("note").notNull(),
    value: int("value").notNull(),
  },
);

export const nullableUnique = mysqlTable(
  "nullable_unique",
  {
    id: int("id").notNull(),
    code: varchar("code", { length: 20 }),
    altCode: varchar("alt_code", { length: 20 }),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "nullable_unique_pkey", columns: [table.id] }),
    unique("nullable_unique_code_key").on(table.code),
    uniqueIndex("nullable_unique_alt_code_ux").on(table.altCode),
  ],
);

export const nullableUniqueRefs = mysqlTable(
  "nullable_unique_refs",
  {
    id: int("id").notNull(),
    code: varchar("code", { length: 20 }),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "nullable_unique_refs_pkey", columns: [table.id] }),
    foreignKey({ name: "nullable_unique_refs_code_fkey", columns: [table.code], foreignColumns: [nullableUnique.code] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const oversizedTypes = mysqlTable(
  "oversized_types",
  {
    id: int("id").notNull(),
    pgVarchar: longtext("pg_varchar").notNull(),
    mysqlChar: varchar("mysql_char", { length: 256 }).notNull(),
    mysqlVarchar: longtext("mysql_varchar").notNull(),
    sqlserverChar: varchar("sqlserver_char", { length: 4001 }).notNull(),
    sqlserverVarchar: varchar("sqlserver_varchar", { length: 4001 }).notNull(),
    pgDecimal: decimal("pg_decimal", { precision: 65, scale: 2 }).notNull(),
    mysqlDecimal: decimal("mysql_decimal", { precision: 40, scale: 30 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "oversized_types_pkey", columns: [table.id] }),
  ],
);

export const oversizedUnique = mysqlTable(
  "oversized_unique",
  {
    id: int("id").notNull(),
    code: varchar("code", { length: 768 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "oversized_unique_pkey", columns: [table.id] }),
    unique("oversized_unique_code_key").on(table.code),
  ],
);

export const requiredA = mysqlTable(
  "required_a",
  {
    id: int("id").notNull(),
    bId: int("b_id").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "required_a_pkey", columns: [table.id] }),
    foreignKey({ name: "required_a_b_id_fkey", columns: [table.bId], foreignColumns: [requiredB.id] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const requiredB = mysqlTable(
  "required_b",
  {
    id: int("id").notNull(),
    aId: int("a_id").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "required_b_pkey", columns: [table.id] }),
    foreignKey({ name: "required_b_a_id_fkey", columns: [table.aId], foreignColumns: [requiredA.id] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const requiredChild = mysqlTable(
  "required_child",
  {
    id: int("id").notNull(),
    aId: int("a_id").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "required_child_pkey", columns: [table.id] }),
    foreignKey({ name: "required_child_a_id_fkey", columns: [table.aId], foreignColumns: [requiredA.id] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const right = mysqlTable(
  "right",
  {
    id: int("id").notNull(),
    rootId: int("root_id").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "right_pkey", columns: [table.id] }),
    foreignKey({ name: "right_root_id_fkey", columns: [table.rootId], foreignColumns: [root.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const root = mysqlTable(
  "root",
  {
    id: int("id").notNull(),
    leafId: int("leaf_id"),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "root_pkey", columns: [table.id] }),
    foreignKey({ name: "root_leaf_id_fkey", columns: [table.leafId], foreignColumns: [leaf.id] })
      .onDelete("restrict")
      .onUpdate("no action"),
  ],
);

export const textKeys = mysqlTable(
  "text_keys",
  {
    code: varchar("code", { length: 255 }).notNull(),
    label: varchar("label", { length: 255 }).notNull(),
    tag: varchar("tag", { length: 255 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "text_keys_pkey", columns: [table.code] }),
    unique("text_keys_label_key").on(table.label),
    index("text_keys_tag_ix").on(table.tag),
  ],
);

export const textRefs = mysqlTable(
  "text_refs",
  {
    id: int("id").notNull(),
    textKeyCode: varchar("text_key_code", { length: 255 }).notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "text_refs_pkey", columns: [table.id] }),
    foreignKey({ name: "text_refs_text_key_code_fkey", columns: [table.textKeyCode], foreignColumns: [textKeys.code] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const treeNodes = mysqlTable(
  "tree_nodes",
  {
    id: int("id").notNull(),
    parentId: int("parent_id"),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "tree_nodes_pkey", columns: [table.id] }),
    foreignKey({ name: "tree_nodes_parent_id_fkey", columns: [table.parentId], foreignColumns: [table.id] })
      .onDelete("set null")
      .onUpdate("no action"),
  ],
);

export const uniqueOnly = mysqlTable(
  "unique_only",
  {
    code: varchar("code", { length: 20 }).notNull(),
    label: longtext("label").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    unique("unique_only_code_key").on(table.code),
  ],
);

export const wideRows = mysqlTable(
  "wide_rows",
  {
    id: int("id").notNull(),
    v: longtext("v").notNull(),
  },
  (table): MySqlTableExtraConfigValue[] => [
    primaryKey({ name: "wide_rows_pkey", columns: [table.id] }),
  ],
);

export const cycleARelations = relations(cycleA, ({ one, many }) => ({
  b: one(cycleB, { fields: [cycleA.bId], references: [cycleB.id], relationName: "cycleA_b" }),
  cycleB: many(cycleB, { relationName: "cycleB_a" }),
}));

export const cycleBRelations = relations(cycleB, ({ one, many }) => ({
  a: one(cycleA, { fields: [cycleB.aId], references: [cycleA.id], relationName: "cycleB_a" }),
  cycleA: many(cycleA, { relationName: "cycleA_b" }),
}));

export const defaultChildrenRelations = relations(defaultChildren, ({ one }) => ({
  parent: one(defaultParents, { fields: [defaultChildren.parentId], references: [defaultParents.id] }),
}));

export const defaultParentsRelations = relations(defaultParents, ({ many }) => ({
  defaultChildren: many(defaultChildren),
}));

export const fixedKeysRelations = relations(fixedKeys, ({ many }) => ({
  fixedRefs: many(fixedRefs),
}));

export const fixedRefsRelations = relations(fixedRefs, ({ one }) => ({
  fixedKeys: one(fixedKeys, { fields: [fixedRefs.fixedCode], references: [fixedKeys.code] }),
}));

export const leafRelations = relations(leaf, ({ one, many }) => ({
  left: one(left, { fields: [leaf.leftId], references: [left.id] }),
  right: one(right, { fields: [leaf.rightId], references: [right.id] }),
  root: many(root),
}));

export const leftRelations = relations(left, ({ one, many }) => ({
  root: one(root, { fields: [left.rootId], references: [root.id] }),
  leaf: many(leaf),
}));

export const nullableUniqueRelations = relations(nullableUnique, ({ many }) => ({
  nullableUniqueRefs: many(nullableUniqueRefs),
}));

export const nullableUniqueRefsRelations = relations(nullableUniqueRefs, ({ one }) => ({
  nullableUnique: one(nullableUnique, { fields: [nullableUniqueRefs.code], references: [nullableUnique.code] }),
}));

export const requiredARelations = relations(requiredA, ({ one, many }) => ({
  b: one(requiredB, { fields: [requiredA.bId], references: [requiredB.id], relationName: "requiredA_b" }),
  requiredB: many(requiredB, { relationName: "requiredB_a" }),
  requiredChild: many(requiredChild),
}));

export const requiredBRelations = relations(requiredB, ({ one, many }) => ({
  a: one(requiredA, { fields: [requiredB.aId], references: [requiredA.id], relationName: "requiredB_a" }),
  requiredA: many(requiredA, { relationName: "requiredA_b" }),
}));

export const requiredChildRelations = relations(requiredChild, ({ one }) => ({
  a: one(requiredA, { fields: [requiredChild.aId], references: [requiredA.id] }),
}));

export const rightRelations = relations(right, ({ one, many }) => ({
  root: one(root, { fields: [right.rootId], references: [root.id] }),
  leaf: many(leaf),
}));

export const rootRelations = relations(root, ({ one, many }) => ({
  leaf: one(leaf, { fields: [root.leafId], references: [leaf.id] }),
  left: many(left),
  right: many(right),
}));

export const textKeysRelations = relations(textKeys, ({ many }) => ({
  textRefs: many(textRefs),
}));

export const textRefsRelations = relations(textRefs, ({ one }) => ({
  textKeys: one(textKeys, { fields: [textRefs.textKeyCode], references: [textKeys.code] }),
}));

export const treeNodesRelations = relations(treeNodes, ({ one, many }) => ({
  parent: one(treeNodes, { fields: [treeNodes.parentId], references: [treeNodes.id], relationName: "treeNodes_parent" }),
  treeNodes: many(treeNodes, { relationName: "treeNodes_parent" }),
}));
