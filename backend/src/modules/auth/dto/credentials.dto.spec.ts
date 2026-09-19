import type { ArgumentMetadata } from "@nestjs/common";
import {
  EMAIL_MAX_LENGTH,
  type FieldError,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@schemaforge/api-contract";
import { describe, expect, it } from "vitest";

import { ApiException } from "../../../common/api.exception.js";
import { createValidationPipe } from "../../../common/validation.pipe.js";
import { LoginDto } from "./login.dto.js";
import { RegisterDto } from "./register.dto.js";

const VALID_EMAIL = "alice@example.com";
// Long enough for the DTO; never a real credential.
const VALID_PASSPHRASE = "fixture-passphrase";
const EMAIL_DOMAIN = "@example.com";

const DTO_CLASSES = [
  ["RegisterDto", RegisterDto],
  ["LoginDto", LoginDto],
] as const;

function bodyMetadata(
  metatype: ArgumentMetadata["metatype"],
): ArgumentMetadata {
  return { type: "body", metatype };
}

function transform(
  metatype: ArgumentMetadata["metatype"],
  body: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  return Promise.resolve(
    createValidationPipe().transform(body, bodyMetadata(metatype)),
  );
}

function fieldsOf(error: unknown): readonly FieldError[] {
  return error instanceof ApiException && "fields" in error.body
    ? error.body.fields
    : [];
}

describe.each(DTO_CLASSES)("%s", (_name, metatype) => {
  it("trims and lowercases the email", async () => {
    const dto = await transform(metatype, {
      email: "  Alice@Example.COM ",
      password: VALID_PASSPHRASE,
    });

    expect(dto).toEqual({ email: VALID_EMAIL, password: VALID_PASSPHRASE });
  });

  it("rejects an invalid email with isEmail", async () => {
    await expect(
      transform(metatype, {
        email: "not-an-email",
        password: VALID_PASSPHRASE,
      }),
    ).rejects.toMatchObject({
      body: {
        statusCode: 400,
        code: "validation-failed",
        fields: [{ path: "email", constraint: "isEmail" }],
      },
    });
  });

  it("rejects an email longer than EMAIL_MAX_LENGTH", async () => {
    const email = `${"a".repeat(EMAIL_MAX_LENGTH)}${EMAIL_DOMAIN}`;

    const error = await transform(metatype, {
      email,
      password: VALID_PASSPHRASE,
    }).catch((caught: unknown) => caught);

    expect(fieldsOf(error)).toContainEqual({
      path: "email",
      constraint: "maxLength",
    });
  });

  it("rejects a password shorter than PASSWORD_MIN_LENGTH", async () => {
    await expect(
      transform(metatype, {
        email: VALID_EMAIL,
        password: "p".repeat(PASSWORD_MIN_LENGTH - 1),
      }),
    ).rejects.toMatchObject({
      body: { fields: [{ path: "password", constraint: "minLength" }] },
    });
  });

  it("rejects a password longer than PASSWORD_MAX_LENGTH", async () => {
    await expect(
      transform(metatype, {
        email: VALID_EMAIL,
        password: "p".repeat(PASSWORD_MAX_LENGTH + 1),
      }),
    ).rejects.toMatchObject({
      body: { fields: [{ path: "password", constraint: "maxLength" }] },
    });
  });

  it("rejects a non-string password", async () => {
    const error = await transform(metatype, {
      email: VALID_EMAIL,
      password: 12_345_678,
    }).catch((caught: unknown) => caught);

    expect(fieldsOf(error)).toContainEqual({
      path: "password",
      constraint: "isString",
    });
  });

  it("rejects an unknown property", async () => {
    await expect(
      transform(metatype, {
        email: VALID_EMAIL,
        password: VALID_PASSPHRASE,
        isAdmin: true,
      }),
    ).rejects.toMatchObject({
      body: {
        fields: [{ path: "isAdmin", constraint: "whitelistValidation" }],
      },
    });
  });
});
