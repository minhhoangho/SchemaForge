// DBML-only escaping: `generators/shared/` has no equivalent, and every user
// name or text in the DBML output goes through one of these two functions.
// `@dbml/core` rejects doubled quotes, so quotes are escaped with a backslash.

const LINE_BREAK_PATTERN = /[\r\n]/;

/** Double-quoted DBML identifier: `\` → `\\`, `"` → `\"`. */
export function quoteDbmlIdentifier(name: string): string {
  return `"${name.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/**
 * Single-quoted DBML string, or a `'''…'''` string when the text has a line
 * break. Inside triple quotes every `'` is escaped, not only `'''`: a text
 * ending in `'` would otherwise close the string one quote early.
 */
export function dbmlString(text: string): string {
  const escaped = text.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
  return LINE_BREAK_PATTERN.test(text) ? `'''${escaped}'''` : `'${escaped}'`;
}
