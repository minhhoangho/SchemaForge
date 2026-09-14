import { describe, expect, it } from "vitest";

import { createEmptySchema } from "./create-empty-schema.js";
import {
  CURRENT_SCHEMA_VERSION,
  schemaDocumentShape,
} from "./schema-document.js";

describe("createEmptySchema", () => {
  it("creates a document with the current version, the given name and empty maps", () => {
    expect(createEmptySchema("Blog")).toStrictEqual({
      version: CURRENT_SCHEMA_VERSION,
      name: "Blog",
      tables: {},
      columns: {},
      relations: {},
      indexes: {},
      enums: {},
      subjectAreas: {},
      notes: {},
    });
  });

  it("creates a document that passes schemaDocumentShape", () => {
    expect(
      schemaDocumentShape.safeParse(createEmptySchema("Cửa hàng")).success,
    ).toBe(true);
  });
});
