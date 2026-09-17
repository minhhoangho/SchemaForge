import type { ApiErrorCode } from "@schemaforge/api-contract";

// The three failure kinds the API client itself detects, before a response
// body with a known ApiErrorCode is even reached (see src/lib/api/, Task 20).
type ClientFailureKind = "network" | "timeout" | "invalid-response";

export const enApiErrors = {
  "validation-failed": "What you entered is not valid. Check it and try again.",
  "password-too-common": "This password is too common. Choose a different one.",
  unauthenticated: "You need to sign in to continue.",
  "invalid-credentials": "The email or password is incorrect.",
  "session-expired": "Your sign-in session has expired. Sign in again.",
  "origin-not-allowed": "This request was not allowed. Reload the page.",
  "schema-limit-reached": "You have reached the limit of schemas in the cloud.",
  "not-found": "Not found.",
  "email-already-registered": "An account already exists for this email.",
  "schema-id-unavailable": "This schema could not be saved. Try again.",
  "revision-conflict": "This schema was changed somewhere else.",
  "payload-too-large": "This schema is too large to save to the cloud.",
  "document-invalid": "The schema data is not valid.",
  "too-many-requests": "You tried too many times. Wait a moment and try again.",
  "internal-error": "Something went wrong on the server. Try again later.",
  network: "You lost your network connection.",
  timeout: "The request took too long.",
  "invalid-response": "The server returned data that could not be read.",
} as const satisfies Record<ApiErrorCode | ClientFailureKind, string>;
