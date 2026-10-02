// Mock REST API handlers for MSW 2 (npm install msw@^2).
// Browser: run npx msw init <public dir>, then setupWorker(...handlers).start().
// Node: setupServer(...handlers).listen() from msw/node.

import { http, HttpResponse } from "msw";

type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKey(row: Row, columns: readonly string[], values: readonly unknown[]): boolean {
  return columns.every((column, index) => String(row[column]) === String(values[index]));
}

const rowsOrderItems: Row[] = [
  { tenant_id: "01fcc062-455b-40ce-bfec-99e1310b90dd", order_number: 2, line_number: 1, quantity: -900892718 },
  { tenant_id: "f6b2a378-807b-458f-9d0c-1cd535c1a21b", order_number: 5, line_number: 2, quantity: -1236171027 },
  { tenant_id: "01fcc062-455b-40ce-bfec-99e1310b90dd", order_number: 2, line_number: 3, quantity: -1706561432 },
  { tenant_id: "25747bdb-d537-47ca-a22f-a8be87be7c7a", order_number: 3, line_number: 4, quantity: 462020729 },
  { tenant_id: "25747bdb-d537-47ca-a22f-a8be87be7c7a", order_number: 3, line_number: 5, quantity: -1558163434 },
];

const rowsOrders: Row[] = [
  { tenant_id: "790262ec-a5cb-49a9-b064-5f764a74db70", order_number: 1, status: "shipped", total: "450463497.90", user_id: "3" },
  { tenant_id: "01fcc062-455b-40ce-bfec-99e1310b90dd", order_number: 2, status: "pending", total: "784077283.02", user_id: "5" },
  { tenant_id: "25747bdb-d537-47ca-a22f-a8be87be7c7a", order_number: 3, status: "pending", total: "280772963.09", user_id: "3" },
  { tenant_id: "8a4e94c6-65b2-48ca-8afa-fdcb7b560e78", order_number: 4, status: "shipped", total: "44198293.04", user_id: "2" },
  { tenant_id: "f6b2a378-807b-458f-9d0c-1cd535c1a21b", order_number: 5, status: "pending", total: "554448670.95", user_id: "3" },
];

const rowsTags: Row[] = [
  { id: "f85fc778-14ce-490a-9675-d5d1e4f1817e" },
  { id: "52f908ad-9048-42e5-a8ce-0e0643dae4d4" },
  { id: "56ab18c9-f061-494c-9a7a-e3cccf76d6cc" },
  { id: "e4ec5a9a-8a0b-4d3a-a4ab-77043f0adb2f" },
  { id: "eb6b0cfc-0912-4863-90b2-660905157d77" },
];

const rowsTenants: Row[] = [
  { id: "14dff6f0-2768-4189-8345-572dc88367b9" },
  { id: "f8828d79-030c-496d-bf42-ec11ea269aae" },
  { id: "186daa03-01d7-4b72-85fd-0aa39c080478" },
  { id: "aca71419-8489-401e-b106-d347539484d8" },
  { id: "e0ee09b0-1c86-4432-b7f0-65c1a7b0d87c" },
];

const rowsUserProfiles: Row[] = [
  { user_id: "1", bio: "bio_1" },
  { user_id: "5", bio: "bio_2" },
  { user_id: "3", bio: "bio_3" },
  { user_id: "4", bio: "bio_4" },
  { user_id: "2", bio: "bio_5" },
];

const rowsUserTags: Row[] = [
  { users_id: "4", tags_id: "eb6b0cfc-0912-4863-90b2-660905157d77", assigned_at: "2026-06-15T14:09:06Z" },
  { users_id: "3", tags_id: "56ab18c9-f061-494c-9a7a-e3cccf76d6cc", assigned_at: "2026-03-12T02:00:53Z" },
  { users_id: "1", tags_id: "52f908ad-9048-42e5-a8ce-0e0643dae4d4", assigned_at: "2026-05-01T14:47:41Z" },
  { users_id: "2", tags_id: "f85fc778-14ce-490a-9675-d5d1e4f1817e", assigned_at: "2026-03-12T12:18:29Z" },
  { users_id: "4", tags_id: "f85fc778-14ce-490a-9675-d5d1e4f1817e", assigned_at: "2026-01-04T13:30:46Z" },
];

const rowsUsers: Row[] = [
  { id: "1", tenant_id: "186daa03-01d7-4b72-85fd-0aa39c080478", email: "email_1", manager_id: null, created_at: "2026-07-05T02:41:33Z", location: null },
  { id: "2", tenant_id: "f8828d79-030c-496d-bf42-ec11ea269aae", email: "email_2", manager_id: "1", created_at: "2026-05-15T06:27:42Z", location: null },
  { id: "3", tenant_id: "f8828d79-030c-496d-bf42-ec11ea269aae", email: "email_3", manager_id: "2", created_at: "2026-05-22T12:30:28Z", location: null },
  { id: "4", tenant_id: "f8828d79-030c-496d-bf42-ec11ea269aae", email: "email_4", manager_id: "3", created_at: "2026-12-18T10:46:42Z", location: null },
  { id: "5", tenant_id: "aca71419-8489-401e-b106-d347539484d8", email: "email_5", manager_id: "4", created_at: "2026-09-14T11:16:27Z", location: null },
];

export const handlers = [
  http.get("*/api/order-items", () => HttpResponse.json(rowsOrderItems)),
  http.post("*/api/order-items", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsOrderItems.some((candidate) => hasKey(candidate, ["tenant_id", "order_number", "line_number"], ["tenant_id", "order_number", "line_number"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsOrderItems.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/order-items/:tenantId/:orderNumber/:lineNumber", ({ params }) => {
    const stored = rowsOrderItems.find((candidate) => hasKey(candidate, ["tenant_id", "order_number", "line_number"], [params["tenantId"], params["orderNumber"], params["lineNumber"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/order-items/:tenantId/:orderNumber/:lineNumber", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsOrderItems.find((candidate) => hasKey(candidate, ["tenant_id", "order_number", "line_number"], [params["tenantId"], params["orderNumber"], params["lineNumber"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, tenant_id: stored["tenant_id"], order_number: stored["order_number"], line_number: stored["line_number"] };
    rowsOrderItems.splice(rowsOrderItems.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/order-items/:tenantId/:orderNumber/:lineNumber", ({ params }) => {
    const stored = rowsOrderItems.find((candidate) => hasKey(candidate, ["tenant_id", "order_number", "line_number"], [params["tenantId"], params["orderNumber"], params["lineNumber"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsOrderItems.splice(rowsOrderItems.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/orders", () => HttpResponse.json(rowsOrders)),
  http.post("*/api/orders", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsOrders.some((candidate) => hasKey(candidate, ["tenant_id", "order_number"], ["tenant_id", "order_number"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsOrders.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/orders/:tenantId/:orderNumber", ({ params }) => {
    const stored = rowsOrders.find((candidate) => hasKey(candidate, ["tenant_id", "order_number"], [params["tenantId"], params["orderNumber"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/orders/:tenantId/:orderNumber", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsOrders.find((candidate) => hasKey(candidate, ["tenant_id", "order_number"], [params["tenantId"], params["orderNumber"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, tenant_id: stored["tenant_id"], order_number: stored["order_number"] };
    rowsOrders.splice(rowsOrders.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/orders/:tenantId/:orderNumber", ({ params }) => {
    const stored = rowsOrders.find((candidate) => hasKey(candidate, ["tenant_id", "order_number"], [params["tenantId"], params["orderNumber"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsOrders.splice(rowsOrders.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/tags", () => HttpResponse.json(rowsTags)),
  http.post("*/api/tags", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsTags.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsTags.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/tags/:id", ({ params }) => {
    const stored = rowsTags.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/tags/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsTags.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsTags.splice(rowsTags.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/tags/:id", ({ params }) => {
    const stored = rowsTags.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsTags.splice(rowsTags.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/tenants", () => HttpResponse.json(rowsTenants)),
  http.post("*/api/tenants", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsTenants.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsTenants.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/tenants/:id", ({ params }) => {
    const stored = rowsTenants.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/tenants/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsTenants.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsTenants.splice(rowsTenants.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/tenants/:id", ({ params }) => {
    const stored = rowsTenants.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsTenants.splice(rowsTenants.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/user-profiles", () => HttpResponse.json(rowsUserProfiles)),
  http.post("*/api/user-profiles", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsUserProfiles.some((candidate) => hasKey(candidate, ["user_id"], ["user_id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsUserProfiles.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/user-profiles/:userId", ({ params }) => {
    const stored = rowsUserProfiles.find((candidate) => hasKey(candidate, ["user_id"], [params["userId"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/user-profiles/:userId", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsUserProfiles.find((candidate) => hasKey(candidate, ["user_id"], [params["userId"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, user_id: stored["user_id"] };
    rowsUserProfiles.splice(rowsUserProfiles.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/user-profiles/:userId", ({ params }) => {
    const stored = rowsUserProfiles.find((candidate) => hasKey(candidate, ["user_id"], [params["userId"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsUserProfiles.splice(rowsUserProfiles.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/user-tags", () => HttpResponse.json(rowsUserTags)),
  http.post("*/api/user-tags", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsUserTags.some((candidate) => hasKey(candidate, ["users_id", "tags_id"], ["users_id", "tags_id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsUserTags.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/user-tags/:usersId/:tagsId", ({ params }) => {
    const stored = rowsUserTags.find((candidate) => hasKey(candidate, ["users_id", "tags_id"], [params["usersId"], params["tagsId"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/user-tags/:usersId/:tagsId", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsUserTags.find((candidate) => hasKey(candidate, ["users_id", "tags_id"], [params["usersId"], params["tagsId"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, users_id: stored["users_id"], tags_id: stored["tags_id"] };
    rowsUserTags.splice(rowsUserTags.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/user-tags/:usersId/:tagsId", ({ params }) => {
    const stored = rowsUserTags.find((candidate) => hasKey(candidate, ["users_id", "tags_id"], [params["usersId"], params["tagsId"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsUserTags.splice(rowsUserTags.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/users", () => HttpResponse.json(rowsUsers)),
  http.post("*/api/users", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsUsers.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsUsers.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/users/:id", ({ params }) => {
    const stored = rowsUsers.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/users/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsUsers.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsUsers.splice(rowsUsers.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/users/:id", ({ params }) => {
    const stored = rowsUsers.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsUsers.splice(rowsUsers.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
