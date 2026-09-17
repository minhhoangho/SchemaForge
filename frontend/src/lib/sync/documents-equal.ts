function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arraysEqual(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => documentsEqual(item, right[index]))
  );
}

function objectsEqual(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(right, key) && documentsEqual(left[key], right[key]),
    )
  );
}

/**
 * Deep-compares two schema documents without relying on key order or
 * `JSON.stringify`, because PostgreSQL JSONB re-sorts object keys on write.
 * A key explicitly set to `undefined` counts as present, unlike a missing key.
 */
export function documentsEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) && Array.isArray(right) && arraysEqual(left, right)
    );
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    return (
      isPlainObject(left) && isPlainObject(right) && objectsEqual(left, right)
    );
  }
  return Object.is(left, right);
}
