import { z } from "zod";

import { subjectAreaIdShape } from "./ids.js";

// Membership lives on table.subjectAreaId, so a table belongs to at most one area.
export const subjectAreaFieldsShape = z.strictObject({
  id: subjectAreaIdShape,
  name: z.string(),
});

export const subjectAreaShape = subjectAreaFieldsShape.readonly();

export type SubjectArea = z.infer<typeof subjectAreaShape>;
