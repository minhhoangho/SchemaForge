// The shape of a value that has already gone through JSON.parse: a plain
// object, distinct from null and from an array.
export function isJsonObject(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
