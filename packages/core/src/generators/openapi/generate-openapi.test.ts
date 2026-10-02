import { describe, expect, it } from "vitest";

import { createEmptySchema } from "../../model/create-empty-schema.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { buildSchema, makeColumn, makeTable } from "../../testing/factories.js";
import { formatDiagnosticsSnapshot } from "../../testing/generator-snapshot.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { generateOpenApi } from "./generate-openapi.js";

function parseDocument(schema: SchemaDocument): object {
  const document: unknown = JSON.parse(
    generateOpenApi(schema, {}).file.content,
  );
  if (typeof document !== "object" || document === null) {
    throw new Error("openapi.json is not a JSON object");
  }
  return document;
}

// Follows own properties only, so "__proto__" never resolves to the prototype.
function ownProperty(value: unknown, key: string): unknown {
  if (
    typeof value !== "object" ||
    value === null ||
    !Object.hasOwn(value, key)
  ) {
    return undefined;
  }
  const property: unknown = Reflect.get(value, key);
  return property;
}

describe("generateOpenApi", () => {
  it("names the file openapi.json with language json", () => {
    const { file } = generateOpenApi(createEmptySchema("Empty"), {});

    expect({ fileName: file.fileName, language: file.language }).toStrictEqual({
      fileName: "openapi.json",
      language: "json",
    });
  });

  it("writes openapi 3.1.1, info with the schema name and version 1.0.0, and servers /api", () => {
    expect(parseDocument(createEmptySchema('Shop "Bán hàng"'))).toMatchObject({
      openapi: "3.1.1",
      info: { title: 'Shop "Bán hàng"', version: "1.0.0" },
      servers: [{ url: "/api" }],
    });
  });

  it("orders top-level keys as openapi, info, servers, paths, components", () => {
    expect(Object.keys(parseDocument(createSampleSchema()))).toStrictEqual([
      "openapi",
      "info",
      "servers",
      "paths",
      "components",
    ]);
  });

  it("keeps a __proto__ column as a property in the parsed document", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_users", name: "users" })],
      columns: [
        makeColumn({
          id: "col_proto",
          tableId: "tbl_users",
          name: "__proto__",
        }),
      ],
    });
    const properties = ["components", "schemas", "Users", "properties"].reduce(
      ownProperty,
      parseDocument(schema),
    );

    expect(ownProperty(properties, "__proto__")).toStrictEqual({
      type: "integer",
      format: "int32",
    });
  });

  it("writes an empty schema with empty paths and schemas", () => {
    const result = generateOpenApi(createEmptySchema("Empty"), {});

    expect([result.file.content, result.diagnostics]).toStrictEqual([
      `${JSON.stringify(
        {
          openapi: "3.1.1",
          info: { title: "Empty", version: "1.0.0" },
          servers: [{ url: "/api" }],
          paths: {},
          components: { schemas: {} },
        },
        null,
        2,
      )}\n`,
      [],
    ]);
  });

  it("returns the same content when map keys were inserted in a different order", () => {
    const schema = createSampleSchema();
    const reordered: SchemaDocument = {
      ...schema,
      tables: Object.fromEntries(Object.entries(schema.tables).reverse()),
      columns: Object.fromEntries(Object.entries(schema.columns).reverse()),
      enums: Object.fromEntries(Object.entries(schema.enums).reverse()),
    };

    expect(generateOpenApi(reordered, {})).toStrictEqual(
      generateOpenApi(schema, {}),
    );
  });

  it.each<[string, () => SchemaDocument]>([
    ["sample", createSampleSchema],
    ["naming-edge", createNamingEdgeSchema],
    ["target-limit", createTargetLimitSchema],
    ["empty", () => createEmptySchema("Empty")],
  ])("matches the snapshot for %s", async (fixture, createSchema) => {
    const result = generateOpenApi(createSchema(), {});

    await expect(result.file.content).toMatchFileSnapshot(
      `../__snapshots__/openapi/${fixture}.json`,
    );
    await expect(
      formatDiagnosticsSnapshot(result.diagnostics),
    ).toMatchFileSnapshot(
      `../__snapshots__/openapi/${fixture}.diagnostics.txt`,
    );
  });
});
