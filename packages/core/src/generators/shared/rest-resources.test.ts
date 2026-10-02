import { describe, expect, it } from "vitest";

import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeTable,
} from "../../testing/factories.js";
import type { RestResource } from "./rest-resources.js";
import {
  buildRestApiNames,
  formatMswPath,
  formatOpenApiPath,
} from "./rest-resources.js";

const ORDERS: RestResource = {
  tableId: "tbl_orders",
  typeName: "Orders",
  pathSegment: "orders",
  keyParameters: [
    { columnId: "col_tenant", name: "tenantId" },
    { columnId: "col_number", name: "orderNumber" },
  ],
};

describe("buildRestApiNames", () => {
  it("derives kebab-case path segments from table names", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_users", name: "người dùng" }),
        makeTable({ id: "tbl_codes", name: "2FA Codes" }),
        makeTable({ id: "tbl_chinese", name: "用户" }),
      ],
    });

    const segments = buildRestApiNames(schema).resources.map(
      (resource) => resource.pathSegment,
    );

    expect(segments).toStrictEqual(["2fa-codes", "nguoi-dung", "table"]);
  });

  it("adds -2 to a path segment that repeats after mapping", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_spaced", name: "order items" }),
        makeTable({ id: "tbl_snake", name: "order_items" }),
      ],
    });

    const segments = buildRestApiNames(schema).resources.map(
      (resource) => resource.pathSegment,
    );

    expect(segments).toStrictEqual(["order-items", "order-items-2"]);
  });

  it("names components with enums before tables", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_status", name: "status" })],
      enums: [makeEnum({ id: "enum_status", name: "status" })],
    });

    const names = buildRestApiNames(schema);

    expect({
      enumTypeNames: [...names.enumTypeNames],
      typeNames: names.resources.map((resource) => resource.typeName),
    }).toStrictEqual({
      enumTypeNames: [["enum_status", "Status"]],
      typeNames: ["Status2"],
    });
  });

  it("adds 2 to a repeated component name", () => {
    const schema = buildSchema({
      tables: [
        makeTable({ id: "tbl_spaced", name: "order items" }),
        makeTable({ id: "tbl_snake", name: "order_items" }),
        makeTable({ id: "tbl_chinese", name: "用户" }),
      ],
      enums: [makeEnum({ id: "enum_chinese", name: "状态" })],
    });

    const names = buildRestApiNames(schema);

    expect({
      enumTypeNames: [...names.enumTypeNames.values()],
      typeNames: names.resources.map((resource) => resource.typeName),
    }).toStrictEqual({
      enumTypeNames: ["Enum"],
      typeNames: ["OrderItems", "OrderItems2", "Table"],
    });
  });

  it("names key parameters in primary key order", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_orders",
          name: "orders",
          primaryKeyColumnIds: ["col_number", "col_tenant", "col_digit"],
        }),
      ],
      columns: [
        makeColumn({
          id: "col_tenant",
          tableId: "tbl_orders",
          name: "tenant_id",
        }),
        makeColumn({
          id: "col_number",
          tableId: "tbl_orders",
          name: "order number",
        }),
        makeColumn({ id: "col_digit", tableId: "tbl_orders", name: "2nd key" }),
      ],
    });

    const [resource] = buildRestApiNames(schema).resources;

    expect(resource?.keyParameters).toStrictEqual([
      { columnId: "col_number", name: "orderNumber" },
      { columnId: "col_tenant", name: "tenantId" },
      { columnId: "col_digit", name: "field2ndKey" },
    ]);
  });

  it("adds 2 to a repeated key parameter name", () => {
    const schema = buildSchema({
      tables: [
        makeTable({
          id: "tbl_orders",
          name: "orders",
          primaryKeyColumnIds: ["col_snake", "col_spaced"],
        }),
      ],
      columns: [
        makeColumn({
          id: "col_snake",
          tableId: "tbl_orders",
          name: "order_id",
        }),
        makeColumn({
          id: "col_spaced",
          tableId: "tbl_orders",
          name: "order id",
        }),
      ],
    });

    const [resource] = buildRestApiNames(schema).resources;

    expect(
      resource?.keyParameters.map((parameter) => parameter.name),
    ).toStrictEqual(["orderId", "orderId2"]);
  });

  it("returns no key parameters for a table without a primary key", () => {
    const schema = buildSchema({
      tables: [makeTable({ id: "tbl_logs", name: "logs" })],
      columns: [makeColumn({ id: "col_message", tableId: "tbl_logs" })],
    });

    const [resource] = buildRestApiNames(schema).resources;

    expect(resource?.keyParameters).toStrictEqual([]);
  });

  it("returns the same names regardless of map key order", () => {
    const tables = [
      makeTable({ id: "tbl_b", name: "order items" }),
      makeTable({ id: "tbl_a", name: "order_items" }),
      makeTable({ id: "tbl_c", name: "Status" }),
    ];
    const enums = [
      makeEnum({ id: "enum_b", name: "status" }),
      makeEnum({ id: "enum_a", name: "Status" }),
    ];
    const forward = buildSchema({ tables, enums });
    const reversed = buildSchema({
      tables: tables.toReversed(),
      enums: enums.toReversed(),
    });

    expect(buildRestApiNames(reversed)).toStrictEqual(
      buildRestApiNames(forward),
    );
  });
});

describe("formatOpenApiPath and formatMswPath", () => {
  it("formats OpenAPI and MSW paths for collections and items", () => {
    expect({
      openApiCollection: formatOpenApiPath(ORDERS, false),
      openApiItem: formatOpenApiPath(ORDERS, true),
      mswCollection: formatMswPath(ORDERS, false),
      mswItem: formatMswPath(ORDERS, true),
    }).toStrictEqual({
      openApiCollection: "/orders",
      openApiItem: "/orders/{tenantId}/{orderNumber}",
      mswCollection: "*/api/orders",
      mswItem: "*/api/orders/:tenantId/:orderNumber",
    });
  });
});
