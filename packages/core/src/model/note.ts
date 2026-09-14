import { z } from "zod";

import { noteIdShape } from "./ids.js";
import { positionShape } from "./position.js";

export const noteFieldsShape = z.strictObject({
  id: noteIdShape,
  text: z.string(),
  position: positionShape,
});

export const noteShape = noteFieldsShape.readonly();

export type Note = z.infer<typeof noteShape>;
