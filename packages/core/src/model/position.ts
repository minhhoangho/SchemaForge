import { z } from "zod";

// z.number() already rejects Infinity and NaN, so coordinates are always finite.
export const positionShape = z
  .strictObject({ x: z.number(), y: z.number() })
  .readonly();

export type Position = z.infer<typeof positionShape>;
