import { describe, expect, it } from "vitest";

import { Prisma } from "../generated/prisma/client.js";
import { toPrismaErrorBody } from "./prisma-errors.js";

const CLIENT_VERSION = "7.10.0";

type UniqueConstraint =
  { readonly index: string } | { readonly fields: readonly string[] };

// Mirrors the meta that @prisma/client 7.10.0 builds from an @prisma/adapter-pg
// unique violation: no `target`, the constraint sits on the adapter error cause.
function uniqueViolation(
  table: string,
  constraint: UniqueConstraint,
): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: CLIENT_VERSION,
    meta: {
      table,
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          kind: "UniqueConstraintViolation",
          originalCode: "23505",
          constraint,
          table,
        },
      },
    },
  });
}

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Request failed", {
    code,
    clientVersion: CLIENT_VERSION,
  });
}

describe("toPrismaErrorBody", () => {
  it("maps a unique violation on users_email_key to email-already-registered", () => {
    const error = uniqueViolation("users", { index: "users_email_key" });

    expect(toPrismaErrorBody(error)).toEqual({
      statusCode: 409,
      code: "email-already-registered",
    });
  });

  it("maps a unique violation on schemas_pkey to schema-id-unavailable", () => {
    const error = uniqueViolation("schemas", { index: "schemas_pkey" });

    expect(toPrismaErrorBody(error)).toEqual({
      statusCode: 409,
      code: "schema-id-unavailable",
    });
  });

  it("maps a unique violation reported by fields to the matching code", () => {
    const error = uniqueViolation("users", { fields: ["email"] });

    expect(toPrismaErrorBody(error)).toEqual({
      statusCode: 409,
      code: "email-already-registered",
    });
  });

  it("returns null for a unique violation on an unknown constraint", () => {
    const error = uniqueViolation("refresh_tokens", {
      index: "refresh_tokens_token_hash_key",
    });

    expect(toPrismaErrorBody(error)).toBeNull();
  });

  it("returns null for a unique violation whose fields belong to another table", () => {
    const error = uniqueViolation("schemas", { fields: ["email"] });

    expect(toPrismaErrorBody(error)).toBeNull();
  });

  it("returns null for a unique violation without adapter metadata", () => {
    expect(toPrismaErrorBody(knownRequestError("P2002"))).toBeNull();
  });

  it("maps P2025 to not-found", () => {
    expect(toPrismaErrorBody(knownRequestError("P2025"))).toEqual({
      statusCode: 404,
      code: "not-found",
    });
  });

  it("returns null for another error code", () => {
    expect(toPrismaErrorBody(knownRequestError("P2003"))).toBeNull();
  });
});
