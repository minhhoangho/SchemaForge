import { describe, expect, it } from "vitest";

import type { RestResource } from "../shared/rest-resources.js";
import { renderResourceHandlers } from "./mock-api-handlers.js";

const USERS: RestResource = {
  tableId: "tbl_users",
  typeName: "Users",
  pathSegment: "users",
  keyParameters: [{ columnId: "col_id", name: "id" }],
};

const ORDERS: RestResource = {
  tableId: "tbl_orders",
  typeName: "Orders",
  pathSegment: "orders",
  keyParameters: [
    { columnId: "col_tenant", name: "tenantId" },
    { columnId: "col_number", name: "orderNumber" },
  ],
};

function renderUsers(): readonly string[] {
  return renderResourceHandlers({
    resource: USERS,
    rowsVariable: "rowsUsers",
    keyColumnNames: ["id"],
  });
}

function renderKeyless(): readonly string[] {
  return renderResourceHandlers({
    resource: { ...USERS, keyParameters: [] },
    rowsVariable: "rowsUsers",
    keyColumnNames: [],
  });
}

function handlerHeads(lines: readonly string[]): readonly string[] {
  return lines.filter((line) => line.startsWith("  http."));
}

describe("renderResourceHandlers", () => {
  it("writes list, create, get, replace and delete handlers for a table with a primary key", () => {
    expect(renderUsers()).toStrictEqual([
      '  http.get("*/api/users", () => HttpResponse.json(rowsUsers)),',
      '  http.post("*/api/users", async ({ request }) => {',
      "    const body: unknown = await request.json().catch(() => null);",
      "    if (!isRow(body)) {",
      "      return new HttpResponse(null, { status: 400 });",
      "    }",
      '    if (rowsUsers.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {',
      "      return new HttpResponse(null, { status: 409 });",
      "    }",
      "    rowsUsers.push(body);",
      "    return HttpResponse.json(body, { status: 201 });",
      "  }),",
      '  http.get("*/api/users/:id", ({ params }) => {',
      '    const stored = rowsUsers.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));',
      "    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);",
      "  }),",
      '  http.put("*/api/users/:id", async ({ request, params }) => {',
      "    const body: unknown = await request.json().catch(() => null);",
      "    if (!isRow(body)) {",
      "      return new HttpResponse(null, { status: 400 });",
      "    }",
      '    const stored = rowsUsers.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));',
      "    if (stored === undefined) {",
      "      return new HttpResponse(null, { status: 404 });",
      "    }",
      '    const replacement: Row = { ...body, id: stored["id"] };',
      "    rowsUsers.splice(rowsUsers.indexOf(stored), 1, replacement);",
      "    return HttpResponse.json(replacement);",
      "  }),",
      '  http.delete("*/api/users/:id", ({ params }) => {',
      '    const stored = rowsUsers.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));',
      "    if (stored === undefined) {",
      "      return new HttpResponse(null, { status: 404 });",
      "    }",
      "    rowsUsers.splice(rowsUsers.indexOf(stored), 1);",
      "    return new HttpResponse(null, { status: 204 });",
      "  }),",
    ]);
  });

  it("writes only list and create handlers for a table without a primary key", () => {
    expect(renderKeyless()).toStrictEqual([
      '  http.get("*/api/users", () => HttpResponse.json(rowsUsers)),',
      '  http.post("*/api/users", async ({ request }) => {',
      "    const body: unknown = await request.json().catch(() => null);",
      "    if (!isRow(body)) {",
      "      return new HttpResponse(null, { status: 400 });",
      "    }",
      "    rowsUsers.push(body);",
      "    return HttpResponse.json(body, { status: 201 });",
      "  }),",
    ]);
  });

  it("uses colon parameters in primary key order for a composite key", () => {
    const lines = renderResourceHandlers({
      resource: ORDERS,
      rowsVariable: "rowsOrders",
      keyColumnNames: ["tenant_id", "order number"],
    });

    expect([handlerHeads(lines)[2], lines[13]]).toStrictEqual([
      '  http.get("*/api/orders/:tenantId/:orderNumber", ({ params }) => {',
      '    const stored = rowsOrders.find((candidate) => hasKey(candidate, ["tenant_id", "order number"], [params["tenantId"], params["orderNumber"]]));',
    ]);
  });

  it("returns 400 for a body that is not an object and 409 for an existing key", () => {
    expect(renderUsers().slice(3, 9)).toStrictEqual([
      "    if (!isRow(body)) {",
      "      return new HttpResponse(null, { status: 400 });",
      "    }",
      '    if (rowsUsers.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {',
      "      return new HttpResponse(null, { status: 409 });",
      "    }",
    ]);
  });

  it("keeps key values from the stored row on replace", () => {
    const lines = renderResourceHandlers({
      resource: ORDERS,
      rowsVariable: "rowsOrders",
      keyColumnNames: ["tenant_id", "__proto__"],
    });

    expect(lines).toContain(
      '    const replacement: Row = { ...body, tenant_id: stored["tenant_id"], ["__proto__"]: stored["__proto__"] };',
    );
  });
});
