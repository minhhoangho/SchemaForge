import { z } from "zod";

import { columnIdShape, subjectAreaIdShape, tableIdShape } from "./ids.js";
import { positionShape } from "./position.js";

export const tableFieldsShape = z.strictObject({
  id: tableIdShape,
  name: z.string(),
  comment: z.string(),
  position: positionShape,
  subjectAreaId: subjectAreaIdShape.nullable(),
  columnIds: z.array(columnIdShape).readonly(),
  // Primary key column order, which may differ from columnIds; empty means no primary key.
  primaryKeyColumnIds: z.array(columnIdShape).readonly(),
});

export const tableShape = tableFieldsShape.readonly();

export type Table = z.infer<typeof tableShape>;
