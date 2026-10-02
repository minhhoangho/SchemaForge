import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import { buildSchema, makeColumn, makeTable } from "../../testing/factories.js";
import type { JsonValue } from "../shared/json-representation.js";
import { buildRestApiNames } from "../shared/rest-resources.js";
import { buildPathItems, buildPaths } from "./openapi-paths.js";

const USERS_REF = { $ref: "#/components/schemas/Users" };
const USERS_CONTENT = { "application/json": { schema: USERS_REF } };

function column(overrides: Partial<Column> & Pick<Column, "id">): Column {
  return makeColumn({ tableId: "tbl_users", ...overrides });
}

function usersSchema(
  table: Partial<Table>,
  columns: readonly Column[],
): SchemaDocument {
  return buildSchema({
    tables: [makeTable({ id: "tbl_users", name: "users", ...table })],
    columns,
  });
}

function pathItems(
  schema: SchemaDocument,
): readonly (readonly [string, JsonValue])[] {
  const names = buildRestApiNames(schema);
  const [resource] = names.resources;
  return resource === undefined
    ? []
    : buildPathItems(resource, schema, names.enumTypeNames);
}

const SINGLE_KEY_SCHEMA = usersSchema({ primaryKeyColumnIds: ["col_id"] }, [
  column({ id: "col_id", name: "id" }),
]);
const KEYLESS_SCHEMA = usersSchema({}, [column({ id: "col_id", name: "id" })]);

describe("buildPathItems", () => {
  it("writes list and create operations on the collection path", () => {
    expect(pathItems(SINGLE_KEY_SCHEMA)[0]).toStrictEqual([
      "/users",
      {
        get: {
          operationId: "listUsers",
          responses: {
            "200": {
              description: "OK",
              content: {
                "application/json": {
                  schema: { type: "array", items: USERS_REF },
                },
              },
            },
          },
        },
        post: {
          operationId: "createUsers",
          requestBody: { required: true, content: USERS_CONTENT },
          responses: {
            "201": { description: "Created", content: USERS_CONTENT },
            "400": { description: "Bad Request" },
            "409": { description: "Conflict" },
          },
        },
      },
    ]);
  });

  it("writes get, replace and delete operations with path parameters on the item path", () => {
    expect(pathItems(SINGLE_KEY_SCHEMA)[1]).toStrictEqual([
      "/users/{id}",
      {
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", format: "int32" },
          },
        ],
        get: {
          operationId: "getUsers",
          responses: {
            "200": { description: "OK", content: USERS_CONTENT },
            "404": { description: "Not Found" },
          },
        },
        put: {
          operationId: "replaceUsers",
          requestBody: { required: true, content: USERS_CONTENT },
          responses: {
            "200": { description: "OK", content: USERS_CONTENT },
            "400": { description: "Bad Request" },
            "404": { description: "Not Found" },
          },
        },
        delete: {
          operationId: "deleteUsers",
          responses: {
            "204": { description: "No Content" },
            "404": { description: "Not Found" },
          },
        },
      },
    ]);
  });

  it("writes path parameters in primary key order with non-null schemas", () => {
    const schema = usersSchema(
      { primaryKeyColumnIds: ["col_tenant", "col_code"] },
      [
        column({ id: "col_code", name: "order_code", type: { kind: "text" } }),
        column({
          id: "col_tenant",
          name: "tenant id",
          type: { kind: "uuid" },
          isNullable: true,
        }),
      ],
    );

    const [, itemPath] = pathItems(schema);

    expect(itemPath).toMatchObject([
      "/users/{tenantId}/{orderCode}",
      {
        parameters: [
          {
            name: "tenantId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          {
            name: "orderCode",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
      },
    ]);
  });

  it("adds 409 to create only when the table has a primary key", () => {
    const createResponses = [SINGLE_KEY_SCHEMA, KEYLESS_SCHEMA].map(
      (schema) => pathItems(schema)[0]?.[1],
    );

    expect(createResponses).toMatchObject([
      { post: { responses: { "409": { description: "Conflict" } } } },
      {
        post: {
          responses: {
            "201": { description: "Created", content: USERS_CONTENT },
            "400": { description: "Bad Request" },
          },
        },
      },
    ]);
    expect(createResponses[1]).not.toHaveProperty(["post", "responses", "409"]);
  });

  it("names operation ids from the component name", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_items",
          name: "order items",
          primaryKeyColumnIds: ["col_id"],
        }),
      ],
      columns: [makeColumn({ id: "col_id", tableId: "tbl_items" })],
    });

    const operationIds = pathItems(schema).flatMap(([, item]) =>
      JSON.stringify(item).match(/"operationId":"[^"]*"/g),
    );

    expect(operationIds).toStrictEqual([
      '"operationId":"listOrderItems"',
      '"operationId":"createOrderItems"',
      '"operationId":"getOrderItems"',
      '"operationId":"replaceOrderItems"',
      '"operationId":"deleteOrderItems"',
    ]);
  });
});

describe("buildPaths", () => {
  it("writes only the collection path for a table without a primary key and reports table-without-identifier", () => {
    const result = buildPaths(
      KEYLESS_SCHEMA,
      buildRestApiNames(KEYLESS_SCHEMA),
    );

    expect([Object.keys(result.paths), result.diagnostics]).toStrictEqual([
      ["/users"],
      [{ code: "table-without-identifier", path: ["tables", "tbl_users"] }],
    ]);
  });
});
