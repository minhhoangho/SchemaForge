// Zod schemas are created when this module loads. In the browser it must load
// after frontend/src/lib/zod-config.ts (Zod jitless), like the core package.
import type { StructuralError } from "@schemaforge/core";
import { z } from "zod";

export const API_ERROR_CODES = [
  "validation-failed",
  "password-too-common",
  "unauthenticated",
  "invalid-credentials",
  "session-expired",
  "origin-not-allowed",
  "schema-limit-reached",
  "not-found",
  "email-already-registered",
  "schema-id-unavailable",
  "revision-conflict",
  "payload-too-large",
  "document-invalid",
  "too-many-requests",
  "internal-error",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const API_ERROR_STATUS = {
  "validation-failed": 400,
  "password-too-common": 400,
  unauthenticated: 401,
  "invalid-credentials": 401,
  "session-expired": 401,
  "origin-not-allowed": 403,
  "schema-limit-reached": 403,
  "not-found": 404,
  "email-already-registered": 409,
  "schema-id-unavailable": 409,
  "revision-conflict": 409,
  "payload-too-large": 413,
  "document-invalid": 422,
  "too-many-requests": 429,
  "internal-error": 500,
} as const satisfies Record<ApiErrorCode, number>;

// Every code except the three whose body carries extra data.
export const SIMPLE_API_ERROR_CODES = [
  "password-too-common",
  "unauthenticated",
  "invalid-credentials",
  "session-expired",
  "origin-not-allowed",
  "schema-limit-reached",
  "not-found",
  "email-already-registered",
  "schema-id-unavailable",
  "payload-too-large",
  "too-many-requests",
  "internal-error",
] as const satisfies readonly ApiErrorCode[];

export type SimpleApiErrorCode = (typeof SIMPLE_API_ERROR_CODES)[number];

export type FieldError = {
  readonly path: string;
  readonly constraint: string;
};

type ErrorBodyWithDocumentErrors<DocumentError> =
  | {
      readonly statusCode: 400;
      readonly code: "validation-failed";
      readonly fields: readonly FieldError[];
    }
  | {
      readonly statusCode: 409;
      readonly code: "revision-conflict";
      readonly currentRevision: number;
    }
  | {
      readonly statusCode: 422;
      readonly code: "document-invalid";
      readonly documentErrors: readonly DocumentError[];
    }
  | { readonly statusCode: number; readonly code: SimpleApiErrorCode };

export type ApiErrorBody = ErrorBodyWithDocumentErrors<StructuralError>;

// The main entry of core exports no list of structural error codes, so a parsed
// body accepts any string code; callers compare codes they know about.
export type ParsedApiErrorBody = ErrorBodyWithDocumentErrors<{
  readonly code: string;
  readonly path: StructuralError["path"];
}>;

const MIN_ERROR_STATUS = 400;
const MAX_ERROR_STATUS = 599;

const apiErrorBodySchema = z.discriminatedUnion("code", [
  z.object({
    statusCode: z.literal(API_ERROR_STATUS["validation-failed"]),
    code: z.literal("validation-failed"),
    fields: z.array(z.object({ path: z.string(), constraint: z.string() })),
  }),
  z.object({
    statusCode: z.literal(API_ERROR_STATUS["revision-conflict"]),
    code: z.literal("revision-conflict"),
    currentRevision: z.int().positive(),
  }),
  z.object({
    statusCode: z.literal(API_ERROR_STATUS["document-invalid"]),
    code: z.literal("document-invalid"),
    documentErrors: z.array(
      z.object({
        code: z.string(),
        path: z.array(z.union([z.string(), z.number()])),
      }),
    ),
  }),
  z.object({
    statusCode: z.int().min(MIN_ERROR_STATUS).max(MAX_ERROR_STATUS),
    code: z.enum(SIMPLE_API_ERROR_CODES),
  }),
]);

export function parseApiErrorBody(value: unknown): ParsedApiErrorBody | null {
  const result = apiErrorBodySchema.safeParse(value);
  return result.success ? result.data : null;
}
