import { z } from "zod";

import { isSchemaId } from "./schema-id";

// These schemas are created when the module loads, and Zod reads its jitless
// setting at creation time. In the browser this module must therefore load
// after zod-config.ts, which AppProviders imports first.
const schemaIdSchema = z.string().refine(isSchemaId);
const timestampSchema = z.number().int().nonnegative();

export const schemaRecordSchema = z.object({
  id: schemaIdSchema,
  name: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// z.number() rejects NaN and infinite values in Zod 4.
export const viewportRecordSchema = z.object({
  schemaId: schemaIdSchema,
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
});

export type SchemaRecord = Readonly<z.infer<typeof schemaRecordSchema>>;

export type ViewportRecord = Readonly<z.infer<typeof viewportRecordSchema>>;

// The document stays unknown until parseSchemaDocument from core validates it.
export type DocumentRecord = {
  readonly schemaId: string;
  readonly document: unknown;
};

export function parseSchemaRecord(value: unknown): SchemaRecord | null {
  const result = schemaRecordSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseViewportRecord(value: unknown): ViewportRecord | null {
  const result = viewportRecordSchema.safeParse(value);
  return result.success ? result.data : null;
}
