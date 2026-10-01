import type { ArgumentMetadata } from "@nestjs/common";

const RAW_VALUE_PROPERTIES = new WeakMap<object, Set<string>>();

/**
 * Marks a DTO property the `ValidationPipe` must hand over exactly as the
 * client sent it. Nest's pipe deletes own `__proto__`, `prototype`, and
 * `constructor` keys from the whole body before validation, so a schema
 * document reached the service without keys that `parseSchemaDocument` of
 * `@schemaforge/core` reports as `invalid-shape`: the backend silently accepted
 * and stored a document the same core code refuses in the browser.
 *
 * Content of a marked property is validated by core, never by
 * `class-validator`, so only constraints that key deletion cannot change (such
 * as `@IsObject`) may be combined with it.
 */
export function RawValue(): PropertyDecorator {
  return (target, property) => {
    if (typeof property !== "string") {
      return;
    }
    const properties = RAW_VALUE_PROPERTIES.get(target) ?? new Set<string>();
    properties.add(property);
    RAW_VALUE_PROPERTIES.set(target, properties);
  };
}

/** Walks the prototype chain so a DTO inherits the marks of its base class. */
export function rawValueProperties(
  metatype: ArgumentMetadata["metatype"],
): readonly string[] {
  const properties = new Set<string>();
  let prototype: unknown = metatype?.prototype;
  while (prototype !== null && typeof prototype === "object") {
    for (const property of RAW_VALUE_PROPERTIES.get(prototype) ?? []) {
      properties.add(property);
    }
    prototype = Object.getPrototypeOf(prototype);
  }
  return [...properties];
}
