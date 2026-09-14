import { z } from "zod";

export const columnDefaultShape = z
  .discriminatedUnion("kind", [
    // A string literal keeps bigint and decimal values exact; it is read by the column type.
    z.strictObject({ kind: z.literal("literal"), value: z.string() }),
    z.strictObject({ kind: z.literal("currentTimestamp") }),
    z.strictObject({ kind: z.literal("generateUuid") }),
  ])
  .readonly();

export type ColumnDefault = z.infer<typeof columnDefaultShape>;
