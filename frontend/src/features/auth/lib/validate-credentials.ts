import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@schemaforge/api-contract";

export type CredentialsFieldError =
  | {
      readonly field: "email";
      readonly code: "required" | "invalid" | "too-long";
    }
  | { readonly field: "password"; readonly code: "too-short" | "too-long" };

// Only the minimal `local@domain` shape: the backend is the final check, so
// the form merely catches obvious typos before a round trip.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+$/u;

function validateEmail(email: string): CredentialsFieldError | null {
  const trimmed = email.trim();
  if (trimmed === "") {
    return { field: "email", code: "required" };
  }
  if (trimmed.length > EMAIL_MAX_LENGTH) {
    return { field: "email", code: "too-long" };
  }
  return EMAIL_SHAPE.test(trimmed) ? null : { field: "email", code: "invalid" };
}

// The backend normalizes with NFKC and counts code points (spec section 2),
// so the form counts the same way.
function validatePassword(password: string): CredentialsFieldError | null {
  // Array.from iterates code points, not graphemes or UTF-16 units.
  const length = Array.from(password.normalize("NFKC")).length;
  if (length < PASSWORD_MIN_LENGTH) {
    return { field: "password", code: "too-short" };
  }
  return length > PASSWORD_MAX_LENGTH
    ? { field: "password", code: "too-long" }
    : null;
}

/** Client-side checks against the contract's limits, email first. */
export function validateCredentials(input: {
  readonly email: string;
  readonly password: string;
}): readonly CredentialsFieldError[] {
  return [validateEmail(input.email), validatePassword(input.password)].filter(
    (error) => error !== null,
  );
}
