import type { Result } from "@schemaforge/core";
import { z } from "zod";

/** Keyset position of the last row of a page: `updatedAt` desc then `id` desc. */
export type SchemaListCursor = {
  readonly updatedAt: Date;
  readonly id: string;
};

const cursorShape = z.strictObject({
  updatedAt: z.iso.datetime(),
  id: z.uuid(),
});

export function encodeSchemaListCursor(cursor: SchemaListCursor): string {
  return Buffer.from(
    JSON.stringify({
      updatedAt: cursor.updatedAt.toISOString(),
      id: cursor.id,
    }),
    "utf8",
  ).toString("base64url");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * A cursor is client input, so every failure collapses into one error and the
 * caller answers `400 validation-failed`.
 */
export function decodeSchemaListCursor(
  value: string,
): Result<SchemaListCursor, "invalid-cursor"> {
  const decoded = parseJson(Buffer.from(value, "base64url").toString("utf8"));
  const parsed = cursorShape.safeParse(decoded);
  return parsed.success
    ? {
        isOk: true,
        value: {
          updatedAt: new Date(parsed.data.updatedAt),
          id: parsed.data.id,
        },
      }
    : { isOk: false, error: "invalid-cursor" };
}
