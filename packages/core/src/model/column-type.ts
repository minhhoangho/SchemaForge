import { z } from "zod";

import { enumIdShape } from "./ids.js";

const MIN_LENGTH = 1;
const MIN_PRECISION = 1;
const MIN_SCALE = 0;

const lengthShape = z.int().min(MIN_LENGTH);

// ZodReadonly options cannot be discriminated, so readonly wraps the whole union.
export const columnTypeShape = z
  .discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("smallint") }),
    z.strictObject({ kind: z.literal("integer") }),
    z.strictObject({ kind: z.literal("bigint") }),
    // scale > precision is a semantic issue, not a shape error.
    z.strictObject({
      kind: z.literal("decimal"),
      precision: z.int().min(MIN_PRECISION),
      scale: z.int().min(MIN_SCALE),
    }),
    z.strictObject({ kind: z.literal("real") }),
    z.strictObject({ kind: z.literal("double") }),
    z.strictObject({ kind: z.literal("boolean") }),
    z.strictObject({ kind: z.literal("char"), length: lengthShape }),
    z.strictObject({ kind: z.literal("varchar"), length: lengthShape }),
    z.strictObject({ kind: z.literal("text") }),
    z.strictObject({ kind: z.literal("uuid") }),
    z.strictObject({ kind: z.literal("date") }),
    z.strictObject({ kind: z.literal("time") }),
    z.strictObject({ kind: z.literal("timestamp") }),
    z.strictObject({ kind: z.literal("timestamptz") }),
    z.strictObject({ kind: z.literal("json") }),
    z.strictObject({ kind: z.literal("binary") }),
    z.strictObject({ kind: z.literal("enum"), enumId: enumIdShape }),
    // The safe custom type syntax is a semantic issue, so any string has a valid shape.
    z.strictObject({ kind: z.literal("custom"), name: z.string() }),
  ])
  .readonly();

export type ColumnType = z.infer<typeof columnTypeShape>;
