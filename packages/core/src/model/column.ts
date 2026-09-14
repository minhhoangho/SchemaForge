import { z } from "zod";

import { columnDefaultShape } from "./column-default.js";
import { columnTypeShape } from "./column-type.js";
import { columnIdShape, tableIdShape } from "./ids.js";

export const columnFieldsShape = z.strictObject({
  id: columnIdShape,
  tableId: tableIdShape,
  name: z.string(),
  type: columnTypeShape,
  isNullable: z.boolean(),
  defaultValue: columnDefaultShape.nullable(),
  isUnique: z.boolean(),
  isAutoIncrement: z.boolean(),
  comment: z.string(),
});

export const columnShape = columnFieldsShape.readonly();

export type Column = z.infer<typeof columnShape>;
