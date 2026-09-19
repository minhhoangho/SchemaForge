import type { ArgumentMetadata } from "@nestjs/common";
import {
  type FieldError,
  SCHEMA_LIST_DEFAULT_LIMIT,
  SCHEMA_LIST_MAX_LIMIT,
} from "@schemaforge/api-contract";
import { buildSchema, makeTable } from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { ApiException } from "../../../common/api.exception.js";
import { createValidationPipe } from "../../../common/validation.pipe.js";
import { CreateSchemaDto } from "./create-schema.dto.js";
import { ListSchemasQueryDto } from "./list-schemas-query.dto.js";
import { UpdateSchemaDto } from "./update-schema.dto.js";

const SCHEMA_ID = "0190f3a0-0000-7000-8000-000000000001";
const DOCUMENT = buildSchema({
  name: "orders",
  tables: [makeTable({ id: "tbl_orders" })],
});

function transform(
  type: ArgumentMetadata["type"],
  metatype: ArgumentMetadata["metatype"],
  value: unknown,
): Promise<unknown> {
  return Promise.resolve(
    createValidationPipe().transform(value, { type, metatype }),
  );
}

function transformBody(
  metatype: ArgumentMetadata["metatype"],
  value: unknown,
): Promise<unknown> {
  return transform("body", metatype, value);
}

function transformQuery(value: unknown): Promise<unknown> {
  return transform("query", ListSchemasQueryDto, value);
}

function fieldsOf(error: unknown): readonly FieldError[] {
  return error instanceof ApiException && "fields" in error.body
    ? error.body.fields
    : [];
}

describe("CreateSchemaDto", () => {
  it("rejects a non-uuid id", async () => {
    const error = await transformBody(CreateSchemaDto, {
      id: "not-a-uuid",
      document: DOCUMENT,
    }).catch((caught: unknown) => caught);

    expect(fieldsOf(error)).toContainEqual({
      path: "id",
      constraint: "isUuid",
    });
  });

  it.each([
    ["a string", "document"],
    ["an array", []],
    ["null", null],
  ])("rejects a document that is %s", async (_name, document) => {
    const error = await transformBody(CreateSchemaDto, {
      id: SCHEMA_ID,
      document,
    }).catch((caught: unknown) => caught);

    expect(fieldsOf(error)).toContainEqual({
      path: "document",
      constraint: "isObject",
    });
  });

  it("keeps the document deep-equal after the pipe", async () => {
    const dto = await transformBody(CreateSchemaDto, {
      id: SCHEMA_ID,
      document: DOCUMENT,
    });

    expect(dto).toEqual({ id: SCHEMA_ID, document: DOCUMENT });
  });

  it("keeps a __proto__ key as own data without changing the prototype", async () => {
    const document: unknown = JSON.parse(
      '{"version":1,"__proto__":{"polluted":true}}',
    );

    const dto = await transformBody(CreateSchemaDto, {
      id: SCHEMA_ID,
      document,
    });

    expect(Object.hasOwn(documentOf(dto), "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(documentOf(dto))).toBe(Object.prototype);
  });
});

describe("UpdateSchemaDto", () => {
  it.each([
    ["below 1", 0],
    ["not an integer", 1.5],
  ])("rejects expectedRevision %s", async (_name, expectedRevision) => {
    const error = await transformBody(UpdateSchemaDto, {
      document: DOCUMENT,
      expectedRevision,
    }).catch((caught: unknown) => caught);

    expect(fieldsOf(error).map((field) => field.path)).toContain(
      "expectedRevision",
    );
  });

  it("accepts a document and a revision", async () => {
    const dto = await transformBody(UpdateSchemaDto, {
      document: DOCUMENT,
      expectedRevision: 2,
    });

    expect(dto).toEqual({ document: DOCUMENT, expectedRevision: 2 });
  });
});

describe("ListSchemasQueryDto", () => {
  it("defaults limit to 50", async () => {
    const dto = await transformQuery({});

    expect(dto).toEqual({ limit: SCHEMA_LIST_DEFAULT_LIMIT });
  });

  it("converts a limit query string to a number", async () => {
    const dto = await transformQuery({ limit: "25" });

    expect(dto).toEqual({ limit: 25 });
  });

  it("rejects limit 101", async () => {
    const error = await transformQuery({
      limit: String(SCHEMA_LIST_MAX_LIMIT + 1),
    }).catch((caught: unknown) => caught);

    expect(fieldsOf(error)).toContainEqual({
      path: "limit",
      constraint: "max",
    });
  });

  it("rejects a cursor longer than 200 characters", async () => {
    const error = await transformQuery({ cursor: "c".repeat(201) }).catch(
      (caught: unknown) => caught,
    );

    expect(fieldsOf(error)).toContainEqual({
      path: "cursor",
      constraint: "maxLength",
    });
  });
});

function documentOf(dto: unknown): object {
  return dto !== null &&
    typeof dto === "object" &&
    "document" in dto &&
    typeof dto.document === "object" &&
    dto.document !== null
    ? dto.document
    : {};
}
