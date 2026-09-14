import { z } from "zod";

import { columnIdShape, indexIdShape, tableIdShape } from "./ids.js";

export const indexFieldsShape = z.strictObject({
  id: indexIdShape,
  tableId: tableIdShape,
  name: z.string(),
  columnIds: z.array(columnIdShape).min(1).readonly(),
  isUnique: z.boolean(),
});

export const indexShape = indexFieldsShape.readonly();

export type Index = z.infer<typeof indexShape>;
