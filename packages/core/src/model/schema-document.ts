import { z } from "zod";

import { columnShape } from "./column.js";
import { enumShape } from "./enum.js";
import {
  columnIdShape,
  enumIdShape,
  indexIdShape,
  noteIdShape,
  relationIdShape,
  subjectAreaIdShape,
  tableIdShape,
} from "./ids.js";
import { noteShape } from "./note.js";
import { relationShape } from "./relation.js";
import { subjectAreaShape } from "./subject-area.js";
import { indexShape } from "./table-index.js";
import { tableShape } from "./table.js";

export const CURRENT_SCHEMA_VERSION = 1;

export type IdMap<K extends string, V> = Readonly<Record<K, V>>;

// Maps carry no storage order: meaningful order lives in arrays on the elements.
export const schemaDocumentShape = z
  .strictObject({
    version: z.literal(CURRENT_SCHEMA_VERSION),
    name: z.string(),
    tables: z.record(tableIdShape, tableShape).readonly(),
    columns: z.record(columnIdShape, columnShape).readonly(),
    relations: z.record(relationIdShape, relationShape).readonly(),
    indexes: z.record(indexIdShape, indexShape).readonly(),
    enums: z.record(enumIdShape, enumShape).readonly(),
    subjectAreas: z.record(subjectAreaIdShape, subjectAreaShape).readonly(),
    notes: z.record(noteIdShape, noteShape).readonly(),
  })
  .readonly();

export type SchemaDocument = z.infer<typeof schemaDocumentShape>;
