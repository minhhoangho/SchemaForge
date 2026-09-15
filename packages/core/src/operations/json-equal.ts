function isPlainObject(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function isJsonArrayEqual(
  left: readonly unknown[],
  right: readonly unknown[],
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => isJsonEqual(item, right[index]))
  );
}

function isJsonObjectEqual(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>,
): boolean {
  const leftKeys = Object.keys(left);
  return (
    leftKeys.length === Object.keys(right).length &&
    leftKeys.every(
      (key) => Object.hasOwn(right, key) && isJsonEqual(left[key], right[key]),
    )
  );
}

/**
 * Deep-equals two JSON-shaped values: primitives by `===`, arrays by index
 * order, objects by key set regardless of key order.
 */
export function isJsonEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    return isJsonArrayEqual(left, right);
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return false;
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    return isJsonObjectEqual(left, right);
  }
  return left === right;
}
