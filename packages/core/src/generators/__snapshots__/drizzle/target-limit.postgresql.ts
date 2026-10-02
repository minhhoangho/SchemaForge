import { type PgTableExtraConfigValue, bigint, boolean, char, customType, date, doublePrecision, foreignKey, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, real, smallint, text, time, timestamp, unique, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const flagStatusEnum = pgEnum("flag_status", ["active", "inactive"]);

export const byteaType = customType<{ data: Uint8Array }>({
  dataType() {
    return "bytea";
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

export const allTypes = pgTable(
  "all_types",
  {
    id: integer("id").notNull(),
    smallintValue: smallint("smallint_value").notNull().default(-32768),
    integerValue: integer("integer_value").notNull().default(42),
    bigintValue: bigint("bigint_value", { mode: "bigint" }).notNull().default(sql.raw("9223372036854775807")),
    decimalValue: numeric("decimal_value", { precision: 12, scale: 2 }).notNull().default("1234567890.12"),
    realValue: real("real_value").notNull().default(sql.raw("1.5e10")),
    doubleValue: doublePrecision("double_value").notNull().default(sql.raw("-2.25")),
    booleanValue: boolean("boolean_value").notNull().default(true),
    charValue: char("char_value", { length: 3 }).notNull().default("abc"),
    varcharValue: varchar("varchar_value", { length: 20 }).notNull().default("it's"),
    textValue: text("text_value").notNull().default("a\\b"),
    uuidValue: uuid("uuid_value").notNull().default("123e4567-e89b-12d3-a456-426614174000"),
    dateValue: date("date_value").notNull().default(sql.raw("'2026-01-02'")),
    timeValue: time("time_value", { precision: 6 }).notNull().default(sql.raw("'12:34:56.789'")),
    timestampValue: timestamp("timestamp_value", { precision: 6 }).notNull().default(sql.raw("'2026-01-02T03:04:05'")),
    timestamptzValue: timestamp("timestamptz_value", { precision: 6, withTimezone: true }).notNull().default(sql.raw("'2026-01-02T03:04:05.123+07:00'")),
    timestampNow: timestamp("timestamp_now", { precision: 6 }).notNull().defaultNow(),
    timestamptzNow: timestamp("timestamptz_now", { precision: 6, withTimezone: true }).notNull().defaultNow(),
    jsonValue: jsonb("json_value").notNull().default(sql.raw("'{\"note\":\"it''s\"}'")),
    binaryValue: byteaType("binary_value"),
    enumValue: flagStatusEnum("enum_value").notNull().default("active"),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "all_types_pkey", columns: [table.id] }),
  ],
);

export const autoInteger = pgTable(
  "auto_integer",
  {
    id: integer("id").notNull().generatedByDefaultAsIdentity(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "auto_integer_pkey", columns: [table.id] }),
  ],
);

export const autoSmallint = pgTable(
  "auto_smallint",
  {
    id: smallint("id").notNull().generatedByDefaultAsIdentity(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "auto_smallint_pkey", columns: [table.id] }),
  ],
);

export const autoTrailing = pgTable(
  "auto_trailing",
  {
    a: integer("a").notNull(),
    id: bigint("id", { mode: "bigint" }).notNull().generatedByDefaultAsIdentity(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "auto_trailing_pkey", columns: [table.a, table.id] }),
  ],
);

export const autoWideKey = pgTable(
  "auto_wide_key",
  {
    id: bigint("id", { mode: "bigint" }).notNull().generatedByDefaultAsIdentity(),
    codeA: varchar("code_a", { length: 700 }).notNull(),
    codeB: varchar("code_b", { length: 700 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "auto_wide_key_pkey", columns: [table.id, table.codeA, table.codeB] }),
  ],
);

export const binaryKeys = pgTable(
  "binary_keys",
  {
    id: integer("id").notNull(),
    hash: byteaType("hash").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "binary_keys_pkey", columns: [table.id] }),
    uniqueIndex("binary_keys_hash_ux").on(table.hash),
  ],
);

export const charUnique = pgTable(
  "char_unique",
  {
    id: integer("id").notNull(),
    code: char("code", { length: 300 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "char_unique_pkey", columns: [table.id] }),
    unique("char_unique_code_key").on(table.code),
  ],
);

export const customRequired = pgTable(
  "custom_required",
  {
    id: integer("id").notNull(),
    payload: tsvectorType("payload").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "custom_required_pkey", columns: [table.id] }),
  ],
);

export const customValues = pgTable(
  "custom_values",
  {
    id: integer("id").notNull(),
    shape: geometryPoint4326Type("shape"),
    address: inetType("address").notNull().default(sql.raw("'127.0.0.1'")),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "custom_values_pkey", columns: [table.id] }),
  ],
);

export const cycleA = pgTable(
  "cycle_a",
  {
    id: integer("id").notNull(),
    bId: integer("b_id"),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "cycle_a_pkey", columns: [table.id] }),
    foreignKey({ name: "cycle_a_b_id_fkey", columns: [table.bId], foreignColumns: [cycleB.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const cycleB = pgTable(
  "cycle_b",
  {
    id: integer("id").notNull(),
    aId: integer("a_id"),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "cycle_b_pkey", columns: [table.id] }),
    foreignKey({ name: "cycle_b_a_id_fkey", columns: [table.aId], foreignColumns: [cycleA.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const defaultChildren = pgTable(
  "default_children",
  {
    id: integer("id").notNull(),
    parentId: integer("parent_id").notNull().default(0),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "default_children_pkey", columns: [table.id] }),
    foreignKey({ name: "default_children_parent_id_fkey", columns: [table.parentId], foreignColumns: [defaultParents.id] })
      .onDelete("set default")
      .onUpdate("no action"),
  ],
);

export const defaultParents = pgTable(
  "default_parents",
  {
    id: integer("id").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "default_parents_pkey", columns: [table.id] }),
  ],
);

export const fivePartKeys = pgTable(
  "five_part_keys",
  {
    id: integer("id").notNull(),
    q1: varchar("q1", { length: 700 }).notNull(),
    q2: varchar("q2", { length: 700 }).notNull(),
    q3: varchar("q3", { length: 700 }).notNull(),
    q4: varchar("q4", { length: 700 }).notNull(),
    q5: varchar("q5", { length: 700 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "five_part_keys_pkey", columns: [table.id] }),
    uniqueIndex("five_part_keys_ux").on(table.q1, table.q2, table.q3, table.q4, table.q5),
  ],
);

export const fivePartRefs = pgTable(
  "five_part_refs",
  {
    id: integer("id").notNull(),
    q1: varchar("q1", { length: 700 }).notNull(),
    q2: varchar("q2", { length: 700 }).notNull(),
    q3: varchar("q3", { length: 700 }).notNull(),
    q4: varchar("q4", { length: 700 }).notNull(),
    q5: varchar("q5", { length: 700 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "five_part_refs_pkey", columns: [table.id] }),
    foreignKey({ name: "five_part_refs_q1_q2_q3_q4_q5_fkey", columns: [table.q1, table.q2, table.q3, table.q4, table.q5], foreignColumns: [fivePartKeys.q1, fivePartKeys.q2, fivePartKeys.q3, fivePartKeys.q4, fivePartKeys.q5] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const fixedKeys = pgTable(
  "fixed_keys",
  {
    code: char("code", { length: 500 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "fixed_keys_pkey", columns: [table.code] }),
  ],
);

export const fixedRefs = pgTable(
  "fixed_refs",
  {
    id: integer("id").notNull(),
    fixedCode: char("fixed_code", { length: 500 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "fixed_refs_pkey", columns: [table.id] }),
    foreignKey({ name: "fixed_refs_fixed_code_fkey", columns: [table.fixedCode], foreignColumns: [fixedKeys.code] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const fixedUnique = pgTable(
  "fixed_unique",
  {
    id: integer("id").notNull(),
    code: char("code", { length: 900 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "fixed_unique_pkey", columns: [table.id] }),
    unique("fixed_unique_code_key").on(table.code),
  ],
);

export const flags = pgTable(
  "flags",
  {
    id: integer("id").notNull(),
    status: flagStatusEnum("status"),
    isPrimary: boolean("is_primary").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "flags_pkey", columns: [table.id] }),
    unique("flags_is_primary_key").on(table.isPrimary),
  ],
);

export const fourPartKeys = pgTable(
  "four_part_keys",
  {
    id: integer("id").notNull(),
    p1: varchar("p1", { length: 192 }).notNull(),
    p2: varchar("p2", { length: 192 }).notNull(),
    p3: varchar("p3", { length: 192 }).notNull(),
    p4: varchar("p4", { length: 192 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "four_part_keys_pkey", columns: [table.id] }),
    uniqueIndex("four_part_keys_ux").on(table.p1, table.p2, table.p3, table.p4),
  ],
);

export const fractionalTimes = pgTable(
  "fractional_times",
  {
    id: integer("id").notNull(),
    startsAt: time("starts_at", { precision: 6 }).notNull().default(sql.raw("'12:34:56.123456789'")),
    createdAt: timestamp("created_at", { precision: 6 }).notNull().default(sql.raw("'2026-01-02T03:04:05.12345678'")),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "fractional_times_pkey", columns: [table.id] }),
  ],
);

export const jsonKeys = pgTable(
  "json_keys",
  {
    doc: jsonb("doc").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "json_keys_pkey", columns: [table.doc] }),
  ],
);

export const jsonRefs = pgTable(
  "json_refs",
  {
    id: integer("id").notNull(),
    doc: jsonb("doc").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "json_refs_pkey", columns: [table.id] }),
    foreignKey({ name: "json_refs_doc_fkey", columns: [table.doc], foreignColumns: [jsonUnique.doc] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const jsonUnique = pgTable(
  "json_unique",
  {
    id: integer("id").notNull(),
    doc: jsonb("doc").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "json_unique_pkey", columns: [table.id] }),
    unique("json_unique_doc_key").on(table.doc),
  ],
);

export const leaf = pgTable(
  "leaf",
  {
    id: integer("id").notNull(),
    leftId: integer("left_id").notNull(),
    rightId: integer("right_id").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "leaf_pkey", columns: [table.id] }),
    foreignKey({ name: "leaf_left_id_fkey", columns: [table.leftId], foreignColumns: [left.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
    foreignKey({ name: "leaf_right_id_fkey", columns: [table.rightId], foreignColumns: [right.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const left = pgTable(
  "left",
  {
    id: integer("id").notNull(),
    rootId: integer("root_id").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "left_pkey", columns: [table.id] }),
    foreignKey({ name: "left_root_id_fkey", columns: [table.rootId], foreignColumns: [root.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

/** ttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt */
export const longComments = pgTable(
  "long_comments",
  {
    id: integer("id").notNull(),
    /** ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc */
    note: text("note").notNull(),
    /** sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss😀 */
    surrogateNote: text("surrogate_note").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "long_comments_pkey", columns: [table.id] }),
  ],
);

export const longUnique = pgTable(
  "long_unique",
  {
    id: integer("id").notNull(),
    code: varchar("code", { length: 1000 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "long_unique_pkey", columns: [table.id] }),
    unique("long_unique_code_key").on(table.code),
  ],
);

export const noKeyRows = pgTable(
  "no_key_rows",
  {
    note: text("note").notNull(),
    value: integer("value").notNull(),
  },
);

export const nullableUnique = pgTable(
  "nullable_unique",
  {
    id: integer("id").notNull(),
    code: varchar("code", { length: 20 }),
    altCode: varchar("alt_code", { length: 20 }),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "nullable_unique_pkey", columns: [table.id] }),
    unique("nullable_unique_code_key").on(table.code),
    uniqueIndex("nullable_unique_alt_code_ux").on(table.altCode),
  ],
);

export const nullableUniqueRefs = pgTable(
  "nullable_unique_refs",
  {
    id: integer("id").notNull(),
    code: varchar("code", { length: 20 }),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "nullable_unique_refs_pkey", columns: [table.id] }),
    foreignKey({ name: "nullable_unique_refs_code_fkey", columns: [table.code], foreignColumns: [nullableUnique.code] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const oversizedTypes = pgTable(
  "oversized_types",
  {
    id: integer("id").notNull(),
    pgVarchar: text("pg_varchar").notNull(),
    mysqlChar: char("mysql_char", { length: 256 }).notNull(),
    mysqlVarchar: varchar("mysql_varchar", { length: 16384 }).notNull(),
    sqlserverChar: char("sqlserver_char", { length: 4001 }).notNull(),
    sqlserverVarchar: varchar("sqlserver_varchar", { length: 4001 }).notNull(),
    pgDecimal: numeric("pg_decimal", { precision: 1000, scale: 2 }).notNull(),
    mysqlDecimal: numeric("mysql_decimal", { precision: 40, scale: 31 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "oversized_types_pkey", columns: [table.id] }),
  ],
);

export const oversizedUnique = pgTable(
  "oversized_unique",
  {
    id: integer("id").notNull(),
    code: varchar("code", { length: 20000 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "oversized_unique_pkey", columns: [table.id] }),
    unique("oversized_unique_code_key").on(table.code),
  ],
);

export const requiredA = pgTable(
  "required_a",
  {
    id: integer("id").notNull(),
    bId: integer("b_id").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "required_a_pkey", columns: [table.id] }),
    foreignKey({ name: "required_a_b_id_fkey", columns: [table.bId], foreignColumns: [requiredB.id] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const requiredB = pgTable(
  "required_b",
  {
    id: integer("id").notNull(),
    aId: integer("a_id").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "required_b_pkey", columns: [table.id] }),
    foreignKey({ name: "required_b_a_id_fkey", columns: [table.aId], foreignColumns: [requiredA.id] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const requiredChild = pgTable(
  "required_child",
  {
    id: integer("id").notNull(),
    aId: integer("a_id").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "required_child_pkey", columns: [table.id] }),
    foreignKey({ name: "required_child_a_id_fkey", columns: [table.aId], foreignColumns: [requiredA.id] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const right = pgTable(
  "right",
  {
    id: integer("id").notNull(),
    rootId: integer("root_id").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "right_pkey", columns: [table.id] }),
    foreignKey({ name: "right_root_id_fkey", columns: [table.rootId], foreignColumns: [root.id] })
      .onDelete("cascade")
      .onUpdate("no action"),
  ],
);

export const root = pgTable(
  "root",
  {
    id: integer("id").notNull(),
    leafId: integer("leaf_id"),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "root_pkey", columns: [table.id] }),
    foreignKey({ name: "root_leaf_id_fkey", columns: [table.leafId], foreignColumns: [leaf.id] })
      .onDelete("restrict")
      .onUpdate("no action"),
  ],
);

export const textKeys = pgTable(
  "text_keys",
  {
    code: text("code").notNull(),
    label: text("label").notNull(),
    tag: text("tag").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "text_keys_pkey", columns: [table.code] }),
    unique("text_keys_label_key").on(table.label),
    index("text_keys_tag_ix").on(table.tag),
  ],
);

export const textRefs = pgTable(
  "text_refs",
  {
    id: integer("id").notNull(),
    textKeyCode: text("text_key_code").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "text_refs_pkey", columns: [table.id] }),
    foreignKey({ name: "text_refs_text_key_code_fkey", columns: [table.textKeyCode], foreignColumns: [textKeys.code] })
      .onDelete("no action")
      .onUpdate("no action"),
  ],
);

export const treeNodes = pgTable(
  "tree_nodes",
  {
    id: integer("id").notNull(),
    parentId: integer("parent_id"),
  },
  (table): PgTableExtraConfigValue[] => [
    primaryKey({ name: "tree_nodes_pkey", columns: [table.id] }),
    foreignKey({ name: "tree_nodes_parent_id_fkey", columns: [table.parentId], foreignColumns: [table.id] })
      .onDelete("set null")
      .onUpdate("no action"),
  ],
);

export const uniqueOnly = pgTable(
  "unique_only",
  {
    code: varchar("code", { length: 20 }).notNull(),
    label: text("label").notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
    unique("unique_only_code_key").on(table.code),
  ],
);

export const wideRows = pgTable(
  "wide_rows",
  {
    id: integer("id").notNull(),
    v: varchar("v", { length: 16383 }).notNull(),
  },
  (table): PgTableExtraConfigValue[] => [
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

export const fivePartKeysRelations = relations(fivePartKeys, ({ many }) => ({
  fivePartRefs: many(fivePartRefs),
}));

export const fivePartRefsRelations = relations(fivePartRefs, ({ one }) => ({
  fivePartKeys: one(fivePartKeys, { fields: [fivePartRefs.q1, fivePartRefs.q2, fivePartRefs.q3, fivePartRefs.q4, fivePartRefs.q5], references: [fivePartKeys.q1, fivePartKeys.q2, fivePartKeys.q3, fivePartKeys.q4, fivePartKeys.q5] }),
}));

export const fixedKeysRelations = relations(fixedKeys, ({ many }) => ({
  fixedRefs: many(fixedRefs),
}));

export const fixedRefsRelations = relations(fixedRefs, ({ one }) => ({
  fixedKeys: one(fixedKeys, { fields: [fixedRefs.fixedCode], references: [fixedKeys.code] }),
}));

export const jsonRefsRelations = relations(jsonRefs, ({ one }) => ({
  jsonUnique: one(jsonUnique, { fields: [jsonRefs.doc], references: [jsonUnique.doc] }),
}));

export const jsonUniqueRelations = relations(jsonUnique, ({ many }) => ({
  jsonRefs: many(jsonRefs),
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
