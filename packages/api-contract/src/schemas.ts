// Zod schemas are created when this module loads. In the browser it must load
// after frontend/src/lib/zod-config.ts (Zod jitless), like the core package.
import { z } from "zod";

export const schemaSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  revision: z.int().positive(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// The document stays opaque on the wire; the frontend always passes it through
// parseSchemaDocument. Zod still requires the key to be present.
export const schemaDetailSchema = schemaSummarySchema.extend({
  document: z.unknown(),
});

export const schemaListSchema = z.object({
  items: z.array(schemaSummarySchema),
  nextCursor: z.string().nullable(),
});

export type SchemaSummary = Readonly<z.infer<typeof schemaSummarySchema>>;

export type SchemaDetail = Readonly<z.infer<typeof schemaDetailSchema>>;

export type SchemaList = Readonly<z.infer<typeof schemaListSchema>>;

export type ListSchemasQuery = {
  readonly limit?: number;
  readonly cursor?: string;
};

export type CreateSchemaRequest = {
  readonly id: string;
  readonly document: unknown;
};

export type UpdateSchemaRequest = {
  readonly document: unknown;
  readonly expectedRevision: number;
};
