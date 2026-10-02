import { formatPropertyKey } from "../shared/identifiers.js";
import type { JsonValue } from "../shared/json-representation.js";

/**
 * A JSON value as a JavaScript expression. Objects are not written with
 * `JSON.stringify`: in an object literal, a `"__proto__"` key sets the
 * prototype instead of creating a property (Vấn đề 5).
 */
export function renderJsValue(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(renderJsValue).join(", ")}]`;
  }
  if (typeof value !== "object" || value === null) {
    return JSON.stringify(value);
  }
  const properties = Object.entries(value).map(
    ([key, property]) =>
      `${formatPropertyKey(key)}: ${renderJsValue(property)}`,
  );
  return properties.length === 0 ? "{}" : `{ ${properties.join(", ")} }`;
}
