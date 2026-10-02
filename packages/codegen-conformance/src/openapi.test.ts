import { validate } from "@readme/openapi-parser";
import { generateOpenApi } from "@schemaforge/core/generators/openapi";
import type { OpenAPIV3_1 } from "openapi-types";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { listConformanceFixtures } from "./support/fixtures.js";

// Only the shape check `validate()` needs; the parser checks the rest.
const openApiDocumentShape = z.custom<OpenAPIV3_1.Document>(
  (value) =>
    typeof value === "object" && value !== null && !Array.isArray(value),
);

describe.each(listConformanceFixtures())("openapi for $name", ({ schema }) => {
  it("is a valid openapi 3.1 document", async () => {
    const { file } = generateOpenApi(schema, {});
    const document = openApiDocumentShape.parse(JSON.parse(file.content));

    // On failure the diff shows the parser's errors.
    expect(await validate(document)).toStrictEqual({
      valid: true,
      warnings: [],
      specification: "OpenAPI",
    });
  });
});
