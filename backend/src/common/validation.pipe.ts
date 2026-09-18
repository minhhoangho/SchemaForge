import { ValidationPipe } from "@nestjs/common";
import { API_ERROR_STATUS, type FieldError } from "@schemaforge/api-contract";
import type { ValidationError } from "class-validator";

import { ApiException } from "./api.exception.js";

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

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
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
