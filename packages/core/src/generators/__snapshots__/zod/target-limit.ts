import { z } from "zod";

export const flagStatusSchema = z.enum(["active", "inactive"]);

export const allTypesSchema = z.object({
  id: z.int32(),
  smallint_value: z.int().min(-32768).max(32767),
  integer_value: z.int32(),
  bigint_value: z.string().regex(new RegExp("^-?(0|[1-9][0-9]*)$")),
  decimal_value: z.string().regex(new RegExp("^-?0*[0-9]{1,10}(\\.[0-9]{1,2})?$")),
  real_value: z.number(),
  double_value: z.number(),
  boolean_value: z.boolean(),
  char_value: z.string().max(3),
  varchar_value: z.string().max(20),
  text_value: z.string(),
  uuid_value: z.guid(),
  date_value: z.iso.date(),
  time_value: z.iso.time(),
  timestamp_value: z.iso.datetime({ local: true }),
  timestamptz_value: z.iso.datetime({ offset: true }),
  timestamp_now: z.iso.datetime({ local: true }),
  timestamptz_now: z.iso.datetime({ offset: true }),
  json_value: z.json(),
  binary_value: z.base64().nullable(),
  enum_value: flagStatusSchema,
});

export const autoIntegerSchema = z.object({
  id: z.int32(),
});

export const autoSmallintSchema = z.object({
  id: z.int().min(-32768).max(32767),
});

export const autoTrailingSchema = z.object({
  a: z.int32(),
  id: z.string().regex(new RegExp("^-?(0|[1-9][0-9]*)$")),
});

export const autoWideKeySchema = z.object({
  id: z.string().regex(new RegExp("^-?(0|[1-9][0-9]*)$")),
  code_a: z.string().max(700),
  code_b: z.string().max(700),
});

export const binaryKeysSchema = z.object({
  id: z.int32(),
  hash: z.base64(),
});

export const charUniqueSchema = z.object({
  id: z.int32(),
  code: z.string().max(300),
});

export const customRequiredSchema = z.object({
  id: z.int32(),
  payload: z.unknown(),
});

export const customValuesSchema = z.object({
  id: z.int32(),
  shape: z.unknown().nullable(),
  address: z.unknown(),
});

export const cycleASchema = z.object({
  id: z.int32(),
  b_id: z.int32().nullable(),
});

export const cycleBSchema = z.object({
  id: z.int32(),
  a_id: z.int32().nullable(),
});

export const defaultChildrenSchema = z.object({
  id: z.int32(),
  parent_id: z.int32(),
});

export const defaultParentsSchema = z.object({
  id: z.int32(),
});

export const fivePartKeysSchema = z.object({
  id: z.int32(),
  q1: z.string().max(700),
  q2: z.string().max(700),
  q3: z.string().max(700),
  q4: z.string().max(700),
  q5: z.string().max(700),
});

export const fivePartRefsSchema = z.object({
  id: z.int32(),
  q1: z.string().max(700),
  q2: z.string().max(700),
  q3: z.string().max(700),
  q4: z.string().max(700),
  q5: z.string().max(700),
});

export const fixedKeysSchema = z.object({
  code: z.string().max(500),
});

export const fixedRefsSchema = z.object({
  id: z.int32(),
  fixed_code: z.string().max(500),
});

export const fixedUniqueSchema = z.object({
  id: z.int32(),
  code: z.string().max(900),
});

export const flagsSchema = z.object({
  id: z.int32(),
  status: flagStatusSchema.nullable(),
  is_primary: z.boolean(),
});

export const fourPartKeysSchema = z.object({
  id: z.int32(),
  p1: z.string().max(192),
  p2: z.string().max(192),
  p3: z.string().max(192),
  p4: z.string().max(192),
});

export const fractionalTimesSchema = z.object({
  id: z.int32(),
  starts_at: z.iso.time(),
  created_at: z.iso.datetime({ local: true }),
});

export const jsonKeysSchema = z.object({
  doc: z.json(),
});

export const jsonRefsSchema = z.object({
  id: z.int32(),
  doc: z.json(),
});

export const jsonUniqueSchema = z.object({
  id: z.int32(),
  doc: z.json(),
});

export const leafSchema = z.object({
  id: z.int32(),
  left_id: z.int32(),
  right_id: z.int32(),
});

export const leftSchema = z.object({
  id: z.int32(),
  root_id: z.int32(),
});

/** ttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt */
export const longCommentsSchema = z.object({
  id: z.int32(),
  /** ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc */
  note: z.string(),
  /** sssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss😀 */
  surrogate_note: z.string(),
});

export const longUniqueSchema = z.object({
  id: z.int32(),
  code: z.string().max(1000),
});

export const noKeyRowsSchema = z.object({
  note: z.string(),
  value: z.int32(),
});

export const nullableUniqueSchema = z.object({
  id: z.int32(),
  code: z.string().max(20).nullable(),
  alt_code: z.string().max(20).nullable(),
});

export const nullableUniqueRefsSchema = z.object({
  id: z.int32(),
  code: z.string().max(20).nullable(),
});

export const oversizedTypesSchema = z.object({
  id: z.int32(),
  pg_varchar: z.string().max(10485761),
  mysql_char: z.string().max(256),
  mysql_varchar: z.string().max(16384),
  sqlserver_char: z.string().max(4001),
  sqlserver_varchar: z.string().max(4001),
  pg_decimal: z.string().regex(new RegExp("^-?0*[0-9]{1,999}(\\.[0-9]{1,2})?$")),
  mysql_decimal: z.string().regex(new RegExp("^-?0*[0-9]{1,9}(\\.[0-9]{1,31})?$")),
});

export const oversizedUniqueSchema = z.object({
  id: z.int32(),
  code: z.string().max(20000),
});

export const requiredASchema = z.object({
  id: z.int32(),
  b_id: z.int32(),
});

export const requiredBSchema = z.object({
  id: z.int32(),
  a_id: z.int32(),
});

export const requiredChildSchema = z.object({
  id: z.int32(),
  a_id: z.int32(),
});

export const rightSchema = z.object({
  id: z.int32(),
  root_id: z.int32(),
});

export const rootSchema = z.object({
  id: z.int32(),
  leaf_id: z.int32().nullable(),
});

export const textKeysSchema = z.object({
  code: z.string(),
  label: z.string(),
  tag: z.string(),
});

export const textRefsSchema = z.object({
  id: z.int32(),
  text_key_code: z.string(),
});

export const treeNodesSchema = z.object({
  id: z.int32(),
  parent_id: z.int32().nullable(),
});

export const uniqueOnlySchema = z.object({
  code: z.string().max(20),
  label: z.string(),
});

export const wideRowsSchema = z.object({
  id: z.int32(),
  v: z.string().max(16383),
});
