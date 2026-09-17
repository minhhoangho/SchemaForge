import { z } from "zod";

import { isSchemaId } from "./schema-id";

export const SYNC_STATUSES = [
  "synced",
  "pending",
  "conflict",
  "deleted-in-cloud",
] as const;

export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SESSION_KEY = "current";

// These schemas are created when the module loads, and Zod reads its jitless
// setting at creation time. In the browser this module must therefore load
// after zod-config.ts, which AppProviders imports first.
const schemaIdSchema = z.string().refine(isSchemaId);
const timestampSchema = z.number().int().nonnegative();

const schemaRecordBaseSchema = z.object({
  id: schemaIdSchema,
  name: z.string(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

const localSchemaRecordSchema = schemaRecordBaseSchema.extend({
  ownerId: z.null(),
  cloudRevision: z.null(),
  syncStatus: z.null(),
});

// A null cloudRevision means the schema has not been created in the cloud yet.
const cloudSchemaRecordSchema = schemaRecordBaseSchema.extend({
  ownerId: z.uuid(),
  cloudRevision: z.number().int().positive().nullable(),
  syncStatus: z.enum(SYNC_STATUSES),
});

export const schemaRecordSchema = z.union([
  localSchemaRecordSchema,
  cloudSchemaRecordSchema,
]);

// z.number() rejects NaN and infinite values in Zod 4.
export const viewportRecordSchema = z.object({
  schemaId: schemaIdSchema,
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
});

export const sessionRecordSchema = z.object({
  key: z.literal(SESSION_KEY),
  userId: z.uuid(),
  email: z.string(),
});

export type LocalSchemaRecord = Readonly<
  z.infer<typeof localSchemaRecordSchema>
>;

export type CloudSchemaRecord = Readonly<
  z.infer<typeof cloudSchemaRecordSchema>
>;

export type SchemaRecord = LocalSchemaRecord | CloudSchemaRecord;

export type ViewportRecord = Readonly<z.infer<typeof viewportRecordSchema>>;

export type SessionRecord = Readonly<z.infer<typeof sessionRecordSchema>>;

// The document stays unknown until parseSchemaDocument from core validates it.
export type DocumentRecord = {
  readonly schemaId: string;
  readonly document: unknown;
};

export function isCloudSchemaRecord(
  record: SchemaRecord,
): record is CloudSchemaRecord {
  return record.ownerId !== null;
}

export function parseSchemaRecord(value: unknown): SchemaRecord | null {
  const result = schemaRecordSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseViewportRecord(value: unknown): ViewportRecord | null {
  const result = viewportRecordSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseSessionRecord(value: unknown): SessionRecord | null {
  const result = sessionRecordSchema.safeParse(value);
  return result.success ? result.data : null;
}
