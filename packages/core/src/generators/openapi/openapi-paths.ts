import type { EnumId } from "../../model/ids.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { createDiagnostic } from "../shared/diagnostics.js";
import type { GeneratorDiagnostic } from "../shared/generator-types.js";
import type { JsonValue } from "../shared/json-representation.js";
import { formatOpenApiPath } from "../shared/rest-resources.js";
import type { RestApiNames, RestResource } from "../shared/rest-resources.js";
import { buildPropertySchema, componentRef } from "./openapi-schemas.js";
import type { JsonObject } from "./openapi-schemas.js";

export type OpenApiPaths = {
  readonly paths: JsonObject;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

const JSON_MEDIA_TYPE = "application/json";
const OK = { description: "OK" };
const BAD_REQUEST = { description: "Bad Request" };
const NOT_FOUND = { description: "Not Found" };
const CONFLICT = { description: "Conflict" };

function jsonContent(schema: JsonObject): JsonObject {
  return { [JSON_MEDIA_TYPE]: { schema } };
}

function buildKeyParameters(
  resource: RestResource,
  schema: SchemaDocument,
  enumTypeNames: ReadonlyMap<EnumId, string>,
): readonly JsonObject[] {
  return resource.keyParameters.flatMap(({ columnId, name }) => {
    const column = schema.columns[columnId];
    if (column === undefined) {
      return [];
    }
    const keySchema = buildPropertySchema(
      { ...column, isNullable: false },
      enumTypeNames,
    );
    return [{ name, in: "path", required: true, schema: keySchema }];
  });
}

function buildCollectionPathItem(
  resource: RestResource,
  hasKey: boolean,
): JsonObject {
  const rowContent = jsonContent(componentRef(resource.typeName));
  return {
    get: {
      operationId: `list${resource.typeName}`,
      responses: {
        "200": {
          ...OK,
          content: jsonContent({
            type: "array",
            items: componentRef(resource.typeName),
          }),
        },
      },
    },
    post: {
      operationId: `create${resource.typeName}`,
      requestBody: { required: true, content: rowContent },
      responses: {
        "201": { description: "Created", content: rowContent },
        "400": BAD_REQUEST,
        ...(hasKey ? { "409": CONFLICT } : {}),
      },
    },
  };
}

function buildItemPathItem(
  resource: RestResource,
  parameters: readonly JsonObject[],
): JsonObject {
  const rowContent = jsonContent(componentRef(resource.typeName));
  return {
    parameters,
    get: {
      operationId: `get${resource.typeName}`,
      responses: { "200": { ...OK, content: rowContent }, "404": NOT_FOUND },
    },
    put: {
      operationId: `replace${resource.typeName}`,
      requestBody: { required: true, content: rowContent },
      responses: {
        "200": { ...OK, content: rowContent },
        "400": BAD_REQUEST,
        "404": NOT_FOUND,
      },
    },
    delete: {
      operationId: `delete${resource.typeName}`,
      responses: { "204": { description: "No Content" }, "404": NOT_FOUND },
    },
  };
}

/** The collection path, then the item path when the table has a primary key. */
export function buildPathItems(
  resource: RestResource,
  schema: SchemaDocument,
  enumTypeNames: ReadonlyMap<EnumId, string>,
): readonly (readonly [string, JsonValue])[] {
  const parameters = buildKeyParameters(resource, schema, enumTypeNames);
  const hasKey = parameters.length > 0;
  const collection = [
    formatOpenApiPath(resource, false),
    buildCollectionPathItem(resource, hasKey),
  ] as const;
  if (!hasKey) {
    return [collection];
  }
  return [
    collection,
    [
      formatOpenApiPath(resource, true),
      buildItemPathItem(resource, parameters),
    ],
  ];
}

export function buildPaths(
  schema: SchemaDocument,
  names: RestApiNames,
): OpenApiPaths {
  return {
    paths: Object.fromEntries(
      names.resources.flatMap((resource) =>
        buildPathItems(resource, schema, names.enumTypeNames),
      ),
    ),
    diagnostics: names.resources
      .filter((resource) => resource.keyParameters.length === 0)
      .map((resource) =>
        createDiagnostic("table-without-identifier", [
          "tables",
          resource.tableId,
        ]),
      ),
  };
}
