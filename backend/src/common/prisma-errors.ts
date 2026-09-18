import { API_ERROR_STATUS, type ApiErrorBody } from "@schemaforge/api-contract";
import { z } from "zod";

import type { Prisma } from "../generated/prisma/client.js";

type UniqueConstraintError = {
  readonly model: string;
  readonly table: string;
  readonly fields: readonly string[];
  readonly constraint: string;
  readonly code: "email-already-registered" | "schema-id-unavailable";
};

/**
 * The only place that maps a unique violation to an api error. `constraint` is
 * the PostgreSQL name created by the migration `init_auth_and_schemas`.
 */
const UNIQUE_CONSTRAINT_ERRORS: readonly UniqueConstraintError[] = [
  {
    model: "User",
    table: "users",
    fields: ["email"],
    constraint: "users_email_key",
    code: "email-already-registered",
  },
  {
    model: "Schema",
    table: "schemas",
    fields: ["id"],
    constraint: "schemas_pkey",
    code: "schema-id-unavailable",
  },
];

// With @prisma/adapter-pg 7.10.0, P2002 carries no `meta.target`: the adapter
// error cause holds the constraint name, or the column list when the name is missing.
const uniqueViolationMetaSchema = z.object({
  table: z.string().optional(),
  driverAdapterError: z.object({
    cause: z.object({
      table: z.string().optional(),
      constraint: z
        .union([
          z.object({ index: z.string() }),
          z.object({ fields: z.array(z.string()) }),
        ])
        .optional(),
    }),
  }),
});

function hasSameFields(
  expected: readonly string[],
  actual: readonly string[],
): boolean {
  return (
    expected.length === actual.length &&
    expected.every((field, index) => actual[index] === field)
  );
}

function findUniqueConstraintError(
  meta: unknown,
): UniqueConstraintError | undefined {
  const parsed = uniqueViolationMetaSchema.safeParse(meta);
  if (!parsed.success) {
    return undefined;
  }
  const { cause } = parsed.data.driverAdapterError;
  const constraint = cause.constraint;
  if (constraint === undefined) {
    return undefined;
  }
  if ("index" in constraint) {
    return UNIQUE_CONSTRAINT_ERRORS.find(
      (row) => row.constraint === constraint.index,
    );
  }
  const table = parsed.data.table ?? cause.table;
  return UNIQUE_CONSTRAINT_ERRORS.find(
    (row) =>
      row.table === table && hasSameFields(row.fields, constraint.fields),
  );
}

/** Returns null when the error has no api translation; the filter then answers 500. */
export function toPrismaErrorBody(
  error: Prisma.PrismaClientKnownRequestError,
): ApiErrorBody | null {
  switch (error.code) {
    case "P2025":
      return { statusCode: API_ERROR_STATUS["not-found"], code: "not-found" };
    case "P2002": {
      const match = findUniqueConstraintError(error.meta);
      return match === undefined
        ? null
        : { statusCode: API_ERROR_STATUS[match.code], code: match.code };
    }
    default:
      return null;
  }
}
