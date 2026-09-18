import type {
  ApiErrorCode,
  ParsedApiErrorBody,
} from "@schemaforge/api-contract";

export type ApiFailure =
  | {
      readonly kind: "http";
      readonly status: number;
      readonly body: ParsedApiErrorBody;
      readonly retryAfterSeconds: number | null;
    }
  | { readonly kind: "network" }
  | { readonly kind: "timeout" }
  | { readonly kind: "invalid-response" };

// Retry-After is a whole number of seconds in this API (never the HTTP-date
// form), so anything else is treated as absent rather than guessed at.
export function parseRetryAfterSeconds(header: string | null): number | null {
  if (header === null) {
    return null;
  }
  const seconds = Number(header);
  return Number.isInteger(seconds) && seconds > 0 ? seconds : null;
}

export function isApiErrorCode(
  failure: ApiFailure,
  code: ApiErrorCode,
): boolean {
  return failure.kind === "http" && failure.body.code === code;
}

export function toApiErrorMessageKey(
  failure: ApiFailure,
): ApiErrorCode | "network" | "timeout" | "invalid-response" {
  switch (failure.kind) {
    case "http":
      return failure.body.code;
    case "network":
      return "network";
    case "timeout":
      return "timeout";
    case "invalid-response":
      return "invalid-response";
    default: {
      const unhandledKind: never = failure;
      return unhandledKind;
    }
  }
}
