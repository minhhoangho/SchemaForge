import { z } from "zod";

import { columnIdShape, relationIdShape, tableIdShape } from "./ids.js";

export const relationKindShape = z.enum(["oneToOne", "oneToMany"]);

export const referentialActionShape = z.enum([
  "noAction",
  "restrict",
  "cascade",
  "setNull",
  "setDefault",
]);

export const columnPairShape = z
  .strictObject({ fromColumnId: columnIdShape, toColumnId: columnIdShape })
  .readonly();

export const relationFieldsShape = z.strictObject({
  id: relationIdShape,
  kind: relationKindShape,
  // The table holding the foreign key: the "many" side of a one-to-many relation.
  fromTableId: tableIdShape,
  toTableId: tableIdShape,
  columnPairs: z.array(columnPairShape).min(1).readonly(),
  onDelete: referentialActionShape,
  onUpdate: referentialActionShape,
});

export const relationShape = relationFieldsShape.readonly();

export type RelationKind = z.infer<typeof relationKindShape>;

export type ReferentialAction = z.infer<typeof referentialActionShape>;

export type ColumnPair = z.infer<typeof columnPairShape>;

export type Relation = z.infer<typeof relationShape>;
