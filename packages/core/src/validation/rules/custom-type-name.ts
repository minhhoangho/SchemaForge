import { MAX_NAME_BYTES, utf8ByteLength } from "../../model/name-limits.js";

// Letters, digits, underscore, space, comma, parentheses and square brackets:
// enough to write "geometry(Point, 4326)" or "text[]" but no quote, semicolon
// or comment marker that could inject SQL into generator output.
const CUSTOM_TYPE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_ ,()[\]]*$/;

/** The condition of `column-custom-type-invalid`, shared with the SQL generators. */
export function isSafeCustomTypeName(name: string): boolean {
  return (
    CUSTOM_TYPE_NAME_PATTERN.test(name) &&
    utf8ByteLength(name) <= MAX_NAME_BYTES
  );
}
