import type { ArgumentMetadata } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsInt,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { describe, expect, it } from "vitest";

import { ApiException } from "./api.exception.js";
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

class ProbeQueryDto {
  @Type(() => Number)
  @IsInt()
  readonly limit!: number;
}

const BODY_METADATA: ArgumentMetadata = {
  type: "body",
  metatype: ProbeBodyDto,
};
const QUERY_METADATA: ArgumentMetadata = {
  type: "query",
  metatype: ProbeQueryDto,
};

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

  it("transforms a numeric query string into a number", async () => {
    const query: unknown = await createValidationPipe().transform(
      { limit: "2" },
      QUERY_METADATA,
    );

    expect(query).toEqual({ limit: 2 });
    expect(query).toBeInstanceOf(ProbeQueryDto);
  });
});
