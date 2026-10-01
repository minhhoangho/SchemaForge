import { type ArgumentMetadata, ValidationPipe } from "@nestjs/common";
import { API_ERROR_STATUS, type FieldError } from "@schemaforge/api-contract";
import type { ValidationError } from "class-validator";

import { ApiException } from "./api.exception.js";
import { rawValueProperties } from "./raw-value.decorator.js";

const PATH_SEPARATOR = ".";

function collectFieldErrors(
  errors: readonly ValidationError[],
  parentPath: string | null,
): readonly FieldError[] {
  return errors.flatMap((error) => {
    const path =
      parentPath === null
        ? error.property
        : `${parentPath}${PATH_SEPARATOR}${error.property}`;
    const ownErrors = Object.keys(error.constraints ?? {}).map(
      (constraint): FieldError => ({ path, constraint }),
    );
    return [...ownErrors, ...collectFieldErrors(error.children ?? [], path)];
  });
}

export function toFieldErrors(
  errors: readonly ValidationError[],
): readonly FieldError[] {
  return collectFieldErrors(errors, null);
}

/**
 * A structured clone keeps own `__proto__`, `prototype`, and `constructor` keys
 * that `ValidationPipe.stripProtoKeys` deletes from the body in place, and
 * creates them as plain data properties. It recurses natively, so it throws
 * `RangeError` on a value nested about 2,200 levels deep and `DataCloneError`
 * on a value it cannot copy. Both mean no snapshot: the property then keeps the
 * value the built-in pipe produced, which core still answers with `422`,
 * instead of the `500` a thrown clone would produce.
 */
function cloneOrSkip(value: unknown): { readonly value: unknown } | null {
  try {
    return { value: structuredClone(value) };
  } catch {
    return null;
  }
}

function snapshotRawValues(
  value: unknown,
  metadata: ArgumentMetadata,
): ReadonlyMap<string, unknown> {
  const snapshot = new Map<string, unknown>();
  if (value === null || typeof value !== "object") {
    return snapshot;
  }
  for (const property of rawValueProperties(metadata.metatype)) {
    const cloned = Object.hasOwn(value, property)
      ? cloneOrSkip(Reflect.get(value, property))
      : null;
    if (cloned !== null) {
      snapshot.set(property, cloned.value);
    }
  }
  return snapshot;
}

function restoreRawValues(
  entity: unknown,
  snapshot: ReadonlyMap<string, unknown>,
): unknown {
  if (entity === null || typeof entity !== "object") {
    return entity;
  }
  for (const [property, value] of snapshot) {
    Object.defineProperty(entity, property, {
      value,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }
  return entity;
}

/** Restores `@RawValue()` properties after the built-in pipe has run. */
class RawValueAwareValidationPipe extends ValidationPipe {
  override async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    const snapshot = snapshotRawValues(value, metadata);
    const entity: unknown = await super.transform(value, metadata);
    return restoreRawValues(entity, snapshot);
  }
}

export function createValidationPipe(): ValidationPipe {
  return new RawValueAwareValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new ApiException({
        statusCode: API_ERROR_STATUS["validation-failed"],
        code: "validation-failed",
        fields: toFieldErrors(errors),
      }),
  });
}
