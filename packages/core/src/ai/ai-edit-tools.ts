import { z } from "zod";

import type { ColumnType } from "../model/column-type.js";
import { utf8ByteLength } from "../model/name-limits.js";
import {
  referentialActionShape,
  relationKindShape,
} from "../model/relation.js";
import {
  AI_MAX_COLUMN_NAME_LIST,
  AI_MAX_COMMENT_LENGTH,
  AI_MAX_CREATE_TABLE_COLUMNS,
  AI_MAX_DEFAULT_VALUE_LENGTH,
  AI_MAX_ENUM_VALUES,
  AI_MAX_FINDING_DETAIL_LENGTH,
  AI_MAX_FINDING_TITLE_LENGTH,
  AI_MAX_FINDINGS,
  AI_MAX_NAME_LENGTH,
  AI_MAX_SAMPLE_KEYS_PER_ROW,
  AI_MAX_SAMPLE_INPUT_BYTES,
  AI_MAX_SAMPLE_ROWS_PER_TABLE,
  AI_MAX_SAMPLE_STRING_LENGTH,
  AI_MAX_SAMPLE_TABLES,
} from "./ai-limits.js";

// Tool descriptions are prompt content and live in the backend, so these
// shapes carry no `.describe()`.

export const AI_COLUMN_TYPE_KINDS = [
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
  "binary",
  "enum",
  "custom",
] as const satisfies readonly ColumnType["kind"][];

const nameShape = z.string().min(1).max(AI_MAX_NAME_LENGTH);
const commentShape = z.string().max(AI_MAX_COMMENT_LENGTH);
const columnNamesShape = z.array(nameShape).min(1).max(AI_MAX_COLUMN_NAME_LIST);

// A flat object instead of core's union discriminated by kind: Gemini's
// function declarations accept only a subset of JSON Schema. The translator
// checks which parameters each kind needs (`column-type-invalid`).
const aiColumnTypeShape = z.strictObject({
  kind: z.enum(AI_COLUMN_TYPE_KINDS),
  length: z.int().min(1).optional(),
  precision: z.int().min(1).optional(),
  scale: z.int().min(0).optional(),
  enumName: nameShape.optional(),
  customName: nameShape.optional(),
});

// null removes the default; an absent field keeps it.
const aiDefaultValueShape = z
  .strictObject({
    kind: z.enum(["literal", "currentTimestamp", "generateUuid"]),
    value: z.string().max(AI_MAX_DEFAULT_VALUE_LENGTH).optional(),
  })
  .nullable()
  .optional();

export const aiColumnSpecShape = z.strictObject({
  name: nameShape,
  type: aiColumnTypeShape,
  isNullable: z.boolean(),
  isUnique: z.boolean().optional(),
  isAutoIncrement: z.boolean().optional(),
  defaultValue: aiDefaultValueShape,
  comment: commentShape.optional(),
});

const enumValuesShape = z.array(nameShape).min(1).max(AI_MAX_ENUM_VALUES);

// In the order of the spec's tool catalog.
export const AI_EDIT_TOOL_NAMES = [
  "renameSchema",
  "createTable",
  "updateTable",
  "removeTable",
  "addColumn",
  "updateColumn",
  "removeColumn",
  "setPrimaryKey",
  "addRelation",
  "updateRelation",
  "removeRelation",
  "addIndex",
  "removeIndex",
  "createEnum",
  "updateEnum",
  "removeEnum",
] as const;

export type AiEditToolName = (typeof AI_EDIT_TOOL_NAMES)[number];

export const aiEditToolInputShapes = {
  renameSchema: z.strictObject({ name: nameShape }),
  createTable: z.strictObject({
    name: nameShape,
    comment: commentShape.optional(),
    columns: z.array(aiColumnSpecShape).min(1).max(AI_MAX_CREATE_TABLE_COLUMNS),
    primaryKey: z.array(nameShape).max(AI_MAX_COLUMN_NAME_LIST),
  }),
  updateTable: z.strictObject({
    table: nameShape,
    newName: nameShape.optional(),
    comment: commentShape.optional(),
  }),
  removeTable: z.strictObject({ table: nameShape }),
  addColumn: z.strictObject({
    table: nameShape,
    column: aiColumnSpecShape,
    after: nameShape.optional(),
  }),
  updateColumn: z.strictObject({
    table: nameShape,
    column: nameShape,
    newName: nameShape.optional(),
    type: aiColumnTypeShape.optional(),
    isNullable: z.boolean().optional(),
    isUnique: z.boolean().optional(),
    isAutoIncrement: z.boolean().optional(),
    defaultValue: aiDefaultValueShape,
    comment: commentShape.optional(),
  }),
  removeColumn: z.strictObject({ table: nameShape, column: nameShape }),
  setPrimaryKey: z.strictObject({
    table: nameShape,
    columns: columnNamesShape,
  }),
  addRelation: z.strictObject({
    fromTable: nameShape,
    toTable: nameShape,
    kind: z.enum(["oneToOne", "oneToMany", "manyToMany"]),
    fromColumns: columnNamesShape.optional(),
    toColumns: columnNamesShape.optional(),
    junctionTable: nameShape.optional(),
    onDelete: referentialActionShape.optional(),
    onUpdate: referentialActionShape.optional(),
  }),
  updateRelation: z.strictObject({
    fromTable: nameShape,
    toTable: nameShape,
    fromColumns: columnNamesShape.optional(),
    kind: relationKindShape.optional(),
    onDelete: referentialActionShape.optional(),
    onUpdate: referentialActionShape.optional(),
  }),
  removeRelation: z.strictObject({
    fromTable: nameShape,
    toTable: nameShape,
    fromColumns: columnNamesShape.optional(),
  }),
  addIndex: z.strictObject({
    table: nameShape,
    columns: columnNamesShape,
    isUnique: z.boolean(),
    name: nameShape.optional(),
  }),
  removeIndex: z.strictObject({ table: nameShape, index: nameShape }),
  createEnum: z.strictObject({ name: nameShape, values: enumValuesShape }),
  updateEnum: z.strictObject({
    enum: nameShape,
    newName: nameShape.optional(),
    values: enumValuesShape.optional(),
  }),
  removeEnum: z.strictObject({ enum: nameShape }),
} as const satisfies Record<AiEditToolName, z.ZodType>;

const findingShape = z.strictObject({
  kind: z.enum(["suggestion", "issue"]),
  category: z.enum([
    "index",
    "normalization",
    "naming",
    "relation",
    "type",
    "other",
  ]),
  title: z.string().min(1).max(AI_MAX_FINDING_TITLE_LENGTH),
  detail: z.string().max(AI_MAX_FINDING_DETAIL_LENGTH),
  table: nameShape.optional(),
  columns: columnNamesShape.optional(),
});

export const reportFindingsInputShape = z.strictObject({
  findings: z.array(findingShape).min(1).max(AI_MAX_FINDINGS),
});

// A row is a list of column and value pairs, not an object keyed by column
// name: Zod's record drops a `__proto__` key, and a fixed shape with string
// values cannot nest. Values are text as in the seed JSON representation;
// null is SQL NULL.
const sampleCellShape = z.strictObject({
  column: nameShape,
  value: z.string().max(AI_MAX_SAMPLE_STRING_LENGTH).nullable(),
});

export const proposeSampleDataInputShape = z
  .strictObject({
    tables: z
      .array(
        z.strictObject({
          table: nameShape,
          rows: z
            .array(z.array(sampleCellShape).max(AI_MAX_SAMPLE_KEYS_PER_ROW))
            .max(AI_MAX_SAMPLE_ROWS_PER_TABLE),
        }),
      )
      .min(1)
      .max(AI_MAX_SAMPLE_TABLES),
  })
  .refine(
    (input) =>
      utf8ByteLength(JSON.stringify(input)) <= AI_MAX_SAMPLE_INPUT_BYTES,
    {
      message: `Sample data input is at most ${String(AI_MAX_SAMPLE_INPUT_BYTES)} bytes of JSON`,
    },
  );

export const AI_TOOL_NAMES = [
  ...AI_EDIT_TOOL_NAMES,
  "reportFindings",
  "proposeSampleData",
] as const;

export type AiToolName = (typeof AI_TOOL_NAMES)[number];

export type AiEditInput<K extends AiEditToolName> = z.infer<
  (typeof aiEditToolInputShapes)[K]
>;

export type AiEdit = {
  readonly [K in AiEditToolName]: {
    readonly tool: K;
    readonly input: AiEditInput<K>;
  };
}[AiEditToolName];

export type AiColumnSpec = z.infer<typeof aiColumnSpecShape>;

export type AiFindingsInput = z.infer<typeof reportFindingsInputShape>;

export type AiSampleDataInput = z.infer<typeof proposeSampleDataInputShape>;
