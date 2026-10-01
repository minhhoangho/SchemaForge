import type { ArgumentMetadata } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsInt,
  IsObject,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { describe, expect, it } from "vitest";

import { ApiException } from "./api.exception.js";
import { RawValue } from "./raw-value.decorator.js";
import { createValidationPipe } from "./validation.pipe.js";

class OwnerDto {
  @IsString()
  readonly name!: string;
}

class ProbeBodyDto {
  @IsEmail()
  @MinLength(10)
  readonly email!: string;

  @ValidateNested()
  @Type(() => OwnerDto)
  readonly owner!: OwnerDto;
}

class StrippedBodyDto {
  @IsObject()
  readonly document!: unknown;
}

class RawBodyDto {
  @IsObject()
  @RawValue()
  readonly document!: unknown;
}

class ChildRawBodyDto extends RawBodyDto {}

class ProbeQueryDto {
  @Type(() => Number)
  @IsInt()
  readonly limit!: number;
}

const BODY_METADATA: ArgumentMetadata = {
  type: "body",
  metatype: ProbeBodyDto,
};
const STRIPPED_METADATA: ArgumentMetadata = {
  type: "body",
  metatype: StrippedBodyDto,
};
const QUERY_METADATA: ArgumentMetadata = {
  type: "query",
  metatype: ProbeQueryDto,
};

/** `JSON.parse` is the only way to build an own `__proto__` key. */
function protoKeyDocument(): Record<string, unknown> {
  const document: unknown = JSON.parse('{"__proto__":{"polluted":true}}');
  return document !== null && typeof document === "object"
    ? { ...document }
    : {};
}

async function documentOf(
  value: unknown,
  metadata: ArgumentMetadata,
): Promise<object> {
  const dto: unknown = await createValidationPipe().transform(value, metadata);
  return dto !== null &&
    typeof dto === "object" &&
    "document" in dto &&
    typeof dto.document === "object" &&
    dto.document !== null
    ? dto.document
    : {};
}

async function rejectionOf(
  value: unknown,
  metadata: ArgumentMetadata,
): Promise<unknown> {
  try {
    await createValidationPipe().transform(value, metadata);
  } catch (error: unknown) {
    return error instanceof ApiException ? error.body : error;
  }
  throw new Error("expected the pipe to reject the value");
}

describe("createValidationPipe", () => {
  it("rejects an unknown property with validation-failed", async () => {
    const body = await rejectionOf(
      { email: "someone@example.com", owner: { name: "a" }, isAdmin: true },
      BODY_METADATA,
    );

    expect(body).toEqual({
      statusCode: 400,
      code: "validation-failed",
      fields: [{ path: "isAdmin", constraint: "whitelistValidation" }],
    });
  });

  it("lists one field error per failed constraint", async () => {
    const body = await rejectionOf(
      { email: "bad", owner: { name: "a" } },
      BODY_METADATA,
    );

    expect(body).toEqual({
      statusCode: 400,
      code: "validation-failed",
      fields: [
        { path: "email", constraint: "minLength" },
        { path: "email", constraint: "isEmail" },
      ],
    });
  });

  it("joins nested property paths with dots", async () => {
    const body = await rejectionOf(
      { email: "someone@example.com", owner: { name: 42 } },
      BODY_METADATA,
    );

    expect(body).toEqual({
      statusCode: 400,
      code: "validation-failed",
      fields: [{ path: "owner.name", constraint: "isString" }],
    });
  });

  it("keeps stripping a __proto__ key from a property that is not marked", async () => {
    const document = await documentOf(
      { document: protoKeyDocument() },
      STRIPPED_METADATA,
    );

    expect(Object.hasOwn(document, "__proto__")).toBe(false);
  });

  it("keeps a __proto__ key in a @RawValue() property", async () => {
    const document = await documentOf(
      { document: protoKeyDocument() },
      { type: "body", metatype: RawBodyDto },
    );

    expect(Object.hasOwn(document, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(document)).toBe(Object.prototype);
    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });

  it("keeps a __proto__ key in a property marked on a base DTO", async () => {
    const document = await documentOf(
      { document: protoKeyDocument() },
      { type: "body", metatype: ChildRawBodyDto },
    );

    expect(Object.hasOwn(document, "__proto__")).toBe(true);
  });

  it("falls back to the stripped value when the raw value cannot be cloned", async () => {
    const document = protoKeyDocument();
    document.notCloneable = (): number => 1;

    const result = await documentOf(
      { document },
      { type: "body", metatype: RawBodyDto },
    );

    expect(Object.hasOwn(result, "__proto__")).toBe(false);
  });

  it("rejects a body that is not an object even with a marked property", async () => {
    const body = await rejectionOf("not-a-body", {
      type: "body",
      metatype: RawBodyDto,
    });

    expect(body).toMatchObject({ code: "validation-failed" });
  });

  it("leaves a value without a metatype untouched", async () => {
    const value: unknown = await createValidationPipe().transform(
      { document: 1 },
      { type: "body", metatype: undefined },
    );

    expect(value).toEqual({ document: 1 });
  });

  it("transforms a numeric query string into a number", async () => {
    const query: unknown = await createValidationPipe().transform(
      { limit: "2" },
      QUERY_METADATA,
    );

    expect(query).toEqual({ limit: 2 });
    expect(query).toBeInstanceOf(ProbeQueryDto);
  });
});
