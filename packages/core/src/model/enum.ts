import { z } from "zod";

import { enumIdShape } from "./ids.js";

export const enumFieldsShape = z.strictObject({
  id: enumIdShape,
  name: z.string(),
  // An empty or duplicated value list is a semantic issue, not a shape error.
  values: z.array(z.string()).readonly(),
});

export const enumShape = enumFieldsShape.readonly();

export type Enum = z.infer<typeof enumShape>;
