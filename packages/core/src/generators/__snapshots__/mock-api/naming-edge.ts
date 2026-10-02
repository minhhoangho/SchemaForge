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

const rowsTable2faCodes: Row[] = [
  { code: "code_1", ["__proto__"]: "proto_1" },
  { code: "code_2", ["__proto__"]: null },
  { code: "code_3", ["__proto__"]: "proto_3" },
  { code: "code_4", ["__proto__"]: null },
  { code: "code_5", ["__proto__"]: "proto_5" },
];

const rowsBangCoTenDaiDungSauMuoiBaByteTheoUtf8Nhe: Row[] = [
  { id: 1, "mã duy nhất": "ma_duy_nhat_1" },
  { id: 2, "mã duy nhất": "ma_duy_nhat_2" },
  { id: 3, "mã duy nhất": "ma_duy_nhat_3" },
  { id: 4, "mã duy nhất": "ma_duy_nhat_4" },
  { id: 5, "mã duy nhất": "ma_duy_nhat_5" },
];

const rowsNguoiDung: Row[] = [
  { id: "0a4c75a8-148b-4b7f-9413-34471e88c512", "họ tên": "ho_ten_1", USER_ID: 994025309, ma: "ma_1", "má": "ma_1", "ghi chú": "ghi_chu_1" },
  { id: "e0b9b7f4-dddc-4e67-9e95-70e00fc18cdf", "họ tên": "ho_ten_2", USER_ID: -1608992785, ma: "ma_2", "má": "ma_2", "ghi chú": "ghi_chu_2" },
  { id: "288878a1-283f-4f96-b713-a56772cce06a", "họ tên": null, USER_ID: 161868220, ma: "ma_3", "má": "ma_3", "ghi chú": "ghi_chu_3" },
  { id: "368a8302-3927-4593-a5c6-d0bc339ee2fb", "họ tên": "ho_ten_4", USER_ID: -470709550, ma: "ma_4", "má": "ma_4", "ghi chú": "ghi_chu_4" },
  { id: "020bf494-c864-4387-a9d1-34eaa4f1b7df", "họ tên": null, USER_ID: -410981733, ma: "ma_5", "má": "ma_5", "ghi chú": "ghi_chu_5" },
];

const rowsOrder: Row[] = [
  { id: 1, select: "select_1", group: 1143494150, "người dùng id": "368a8302-3927-4593-a5c6-d0bc339ee2fb", updated_by: "e0b9b7f4-dddc-4e67-9e95-70e00fc18cdf", "trạng thái": "má" },
  { id: 2, select: "select_2", group: 1001039841, "người dùng id": "288878a1-283f-4f96-b713-a56772cce06a", updated_by: "e0b9b7f4-dddc-4e67-9e95-70e00fc18cdf", "trạng thái": "chờ xử lý" },
  { id: 3, select: "select_3", group: -268590644, "người dùng id": "368a8302-3927-4593-a5c6-d0bc339ee2fb", updated_by: "288878a1-283f-4f96-b713-a56772cce06a", "trạng thái": "đã giao" },
  { id: 4, select: "select_4", group: 1400197937, "người dùng id": "0a4c75a8-148b-4b7f-9413-34471e88c512", updated_by: "368a8302-3927-4593-a5c6-d0bc339ee2fb", "trạng thái": "má" },
  { id: 5, select: "select_5", group: -929554914, "người dùng id": "368a8302-3927-4593-a5c6-d0bc339ee2fb", updated_by: "020bf494-c864-4387-a9d1-34eaa4f1b7df", "trạng thái": "má" },
];

const rowsOrderItems: Row[] = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
  { id: 4 },
  { id: 5 },
];

const rowsOrderItems2: Row[] = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
  { id: 4 },
  { id: 5 },
];

const rowsTenLaXYZW: Row[] = [
  { id: 1, "tên \"lạ\" `x` [y] 'z' \\ w": "ten_la_x_y_z_w_1" },
  { id: 2, "tên \"lạ\" `x` [y] 'z' \\ w": "ten_la_x_y_z_w_2" },
  { id: 3, "tên \"lạ\" `x` [y] 'z' \\ w": "ten_la_x_y_z_w_3" },
  { id: 4, "tên \"lạ\" `x` [y] 'z' \\ w": "ten_la_x_y_z_w_4" },
  { id: 5, "tên \"lạ\" `x` [y] 'z' \\ w": "ten_la_x_y_z_w_5" },
];

const rowsTable: Row[] = [
  { id: 1, "名字": "value_1" },
  { id: 2, "名字": "value_2" },
  { id: 3, "名字": "value_3" },
  { id: 4, "名字": "value_4" },
  { id: 5, "名字": "value_5" },
];

export const handlers = [
  http.get("*/api/2fa-codes", () => HttpResponse.json(rowsTable2faCodes)),
  http.post("*/api/2fa-codes", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsTable2faCodes.some((candidate) => hasKey(candidate, ["code"], ["code"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsTable2faCodes.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/2fa-codes/:code", ({ params }) => {
    const stored = rowsTable2faCodes.find((candidate) => hasKey(candidate, ["code"], [params["code"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/2fa-codes/:code", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsTable2faCodes.find((candidate) => hasKey(candidate, ["code"], [params["code"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, code: stored["code"] };
    rowsTable2faCodes.splice(rowsTable2faCodes.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/2fa-codes/:code", ({ params }) => {
    const stored = rowsTable2faCodes.find((candidate) => hasKey(candidate, ["code"], [params["code"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsTable2faCodes.splice(rowsTable2faCodes.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/bang-co-ten-dai-dung-sau-muoi-ba-byte-theo-utf-8-nhe", () => HttpResponse.json(rowsBangCoTenDaiDungSauMuoiBaByteTheoUtf8Nhe)),
  http.post("*/api/bang-co-ten-dai-dung-sau-muoi-ba-byte-theo-utf-8-nhe", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsBangCoTenDaiDungSauMuoiBaByteTheoUtf8Nhe.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsBangCoTenDaiDungSauMuoiBaByteTheoUtf8Nhe.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/bang-co-ten-dai-dung-sau-muoi-ba-byte-theo-utf-8-nhe/:id", ({ params }) => {
    const stored = rowsBangCoTenDaiDungSauMuoiBaByteTheoUtf8Nhe.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/bang-co-ten-dai-dung-sau-muoi-ba-byte-theo-utf-8-nhe/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsBangCoTenDaiDungSauMuoiBaByteTheoUtf8Nhe.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsBangCoTenDaiDungSauMuoiBaByteTheoUtf8Nhe.splice(rowsBangCoTenDaiDungSauMuoiBaByteTheoUtf8Nhe.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/bang-co-ten-dai-dung-sau-muoi-ba-byte-theo-utf-8-nhe/:id", ({ params }) => {
    const stored = rowsBangCoTenDaiDungSauMuoiBaByteTheoUtf8Nhe.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsBangCoTenDaiDungSauMuoiBaByteTheoUtf8Nhe.splice(rowsBangCoTenDaiDungSauMuoiBaByteTheoUtf8Nhe.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/nguoi-dung", () => HttpResponse.json(rowsNguoiDung)),
  http.post("*/api/nguoi-dung", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsNguoiDung.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsNguoiDung.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/nguoi-dung/:id", ({ params }) => {
    const stored = rowsNguoiDung.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/nguoi-dung/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsNguoiDung.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsNguoiDung.splice(rowsNguoiDung.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/nguoi-dung/:id", ({ params }) => {
    const stored = rowsNguoiDung.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsNguoiDung.splice(rowsNguoiDung.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/order", () => HttpResponse.json(rowsOrder)),
  http.post("*/api/order", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsOrder.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsOrder.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/order/:id", ({ params }) => {
    const stored = rowsOrder.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/order/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsOrder.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsOrder.splice(rowsOrder.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/order/:id", ({ params }) => {
    const stored = rowsOrder.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsOrder.splice(rowsOrder.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/order-items", () => HttpResponse.json(rowsOrderItems)),
  http.post("*/api/order-items", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsOrderItems.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsOrderItems.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/order-items/:id", ({ params }) => {
    const stored = rowsOrderItems.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/order-items/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsOrderItems.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsOrderItems.splice(rowsOrderItems.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/order-items/:id", ({ params }) => {
    const stored = rowsOrderItems.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsOrderItems.splice(rowsOrderItems.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/order-items-2", () => HttpResponse.json(rowsOrderItems2)),
  http.post("*/api/order-items-2", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsOrderItems2.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsOrderItems2.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/order-items-2/:id", ({ params }) => {
    const stored = rowsOrderItems2.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/order-items-2/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsOrderItems2.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsOrderItems2.splice(rowsOrderItems2.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/order-items-2/:id", ({ params }) => {
    const stored = rowsOrderItems2.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsOrderItems2.splice(rowsOrderItems2.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/ten-la-x-y-z-w", () => HttpResponse.json(rowsTenLaXYZW)),
  http.post("*/api/ten-la-x-y-z-w", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsTenLaXYZW.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsTenLaXYZW.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/ten-la-x-y-z-w/:id", ({ params }) => {
    const stored = rowsTenLaXYZW.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/ten-la-x-y-z-w/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsTenLaXYZW.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsTenLaXYZW.splice(rowsTenLaXYZW.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/ten-la-x-y-z-w/:id", ({ params }) => {
    const stored = rowsTenLaXYZW.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsTenLaXYZW.splice(rowsTenLaXYZW.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/table", () => HttpResponse.json(rowsTable)),
  http.post("*/api/table", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsTable.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsTable.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/table/:id", ({ params }) => {
    const stored = rowsTable.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/table/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsTable.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsTable.splice(rowsTable.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/table/:id", ({ params }) => {
    const stored = rowsTable.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsTable.splice(rowsTable.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
