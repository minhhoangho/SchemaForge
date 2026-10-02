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

const rowsAllTypes: Row[] = [
  { id: 1, smallint_value: -26668, integer_value: 729542903, bigint_value: "2082846120", decimal_value: "750329344.87", real_value: 8241.52, double_value: 3820.76, boolean_value: false, char_value: "e_1", varchar_value: "varchar_value_1", text_value: "text_value_1", uuid_value: "bac07737-e3fc-4537-8fce-01f5876ed4e7", date_value: "2026-07-05", time_value: "08:42:01", timestamp_value: "2026-08-30T12:49:57", timestamptz_value: "2026-07-03T21:41:01Z", timestamp_now: "2026-05-06T19:27:11", timestamptz_now: "2026-08-26T18:45:41Z", json_value: { value: 919 }, binary_value: "M7gyGQ==", enum_value: "inactive" },
  { id: 2, smallint_value: -19141, integer_value: 1597383677, bigint_value: "857011259", decimal_value: "385633377.58", real_value: 633.35, double_value: 9760.96, boolean_value: true, char_value: "e_2", varchar_value: "varchar_value_2", text_value: "text_value_2", uuid_value: "192d42da-ff11-4fc4-9475-41970d898cd4", date_value: "2026-10-18", time_value: "08:42:49", timestamp_value: "2026-02-20T02:21:40", timestamptz_value: "2026-08-31T04:32:53Z", timestamp_now: "2026-01-08T17:19:09", timestamptz_now: "2026-12-27T00:01:39Z", json_value: { value: 327 }, binary_value: "DufU/w==", enum_value: "inactive" },
  { id: 3, smallint_value: -20120, integer_value: 954790182, bigint_value: "1806488819", decimal_value: "613397647.28", real_value: 6165.96, double_value: 3747.29, boolean_value: false, char_value: "e_3", varchar_value: "varchar_value_3", text_value: "text_value_3", uuid_value: "1a89e0c1-1f77-40dd-a2d2-6ca52aaedb9e", date_value: "2026-05-05", time_value: "07:15:20", timestamp_value: "2026-12-26T16:17:20", timestamptz_value: "2026-06-15T12:25:31Z", timestamp_now: "2026-03-24T14:00:15", timestamptz_now: "2026-01-09T17:00:40Z", json_value: { value: 367 }, binary_value: "U5dGbQ==", enum_value: "active" },
  { id: 4, smallint_value: -6743, integer_value: -89716034, bigint_value: "2033077165", decimal_value: "706196464.63", real_value: 3618.67, double_value: 399.15, boolean_value: false, char_value: "e_4", varchar_value: "varchar_value_4", text_value: "text_value_4", uuid_value: "94e93fef-faef-4ed0-b962-2c244350cb69", date_value: "2026-12-03", time_value: "16:17:04", timestamp_value: "2026-08-05T09:10:08", timestamptz_value: "2026-08-07T22:01:35Z", timestamp_now: "2026-07-24T21:29:01", timestamptz_now: "2026-11-02T12:14:41Z", json_value: { value: 191 }, binary_value: "PihFVw==", enum_value: "active" },
  { id: 5, smallint_value: -15106, integer_value: 440282672, bigint_value: "380923878", decimal_value: "597664348.98", real_value: 7462.04, double_value: 429.92, boolean_value: true, char_value: "e_5", varchar_value: "varchar_value_5", text_value: "text_value_5", uuid_value: "53893e60-5a52-4552-a622-0ba0af77440a", date_value: "2026-01-24", time_value: "02:52:55", timestamp_value: "2026-09-18T23:20:54", timestamptz_value: "2026-08-08T01:21:48Z", timestamp_now: "2026-06-21T16:31:16", timestamptz_now: "2026-05-09T16:24:55Z", json_value: { value: 962 }, binary_value: "1JMIXQ==", enum_value: "inactive" },
];

const rowsAutoInteger: Row[] = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
  { id: 4 },
  { id: 5 },
];

const rowsAutoSmallint: Row[] = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
  { id: 4 },
  { id: 5 },
];

const rowsAutoTrailing: Row[] = [
  { a: 1, id: "1" },
  { a: 2, id: "2" },
  { a: 3, id: "3" },
  { a: 4, id: "4" },
  { a: 5, id: "5" },
];

const rowsAutoWideKey: Row[] = [
  { id: "1", code_a: "code_a_1", code_b: "code_b_1" },
  { id: "2", code_a: "code_a_2", code_b: "code_b_2" },
  { id: "3", code_a: "code_a_3", code_b: "code_b_3" },
  { id: "4", code_a: "code_a_4", code_b: "code_b_4" },
  { id: "5", code_a: "code_a_5", code_b: "code_b_5" },
];

const rowsBinaryKeys: Row[] = [
  { id: 1, hash: "lYAM9g==" },
  { id: 2, hash: "ggFTGA==" },
  { id: 3, hash: "qxCMmw==" },
  { id: 4, hash: "w/+BnQ==" },
  { id: 5, hash: "b5vnLQ==" },
];

const rowsCharUnique: Row[] = [
  { id: 1, code: "code_1" },
  { id: 2, code: "code_2" },
  { id: 3, code: "code_3" },
  { id: 4, code: "code_4" },
  { id: 5, code: "code_5" },
];

const rowsCustomRequired: Row[] = [];

const rowsCustomValues: Row[] = [
  { id: 1, shape: null },
  { id: 2, shape: null },
  { id: 3, shape: null },
  { id: 4, shape: null },
  { id: 5, shape: null },
];

const rowsCycleA: Row[] = [
  { id: 1, b_id: 3 },
  { id: 2, b_id: 2 },
  { id: 3, b_id: 1 },
  { id: 4, b_id: 4 },
  { id: 5, b_id: 4 },
];

const rowsCycleB: Row[] = [
  { id: 1, a_id: 2 },
  { id: 2, a_id: 2 },
  { id: 3, a_id: 2 },
  { id: 4, a_id: 3 },
  { id: 5, a_id: 2 },
];

const rowsDefaultChildren: Row[] = [
  { id: 1, parent_id: 5 },
  { id: 2, parent_id: 1 },
  { id: 3, parent_id: 4 },
  { id: 4, parent_id: 1 },
  { id: 5, parent_id: 1 },
];

const rowsDefaultParents: Row[] = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
  { id: 4 },
  { id: 5 },
];

const rowsFivePartKeys: Row[] = [
  { id: 1, q1: "q1_1", q2: "q2_1", q3: "q3_1", q4: "q4_1", q5: "q5_1" },
  { id: 2, q1: "q1_2", q2: "q2_2", q3: "q3_2", q4: "q4_2", q5: "q5_2" },
  { id: 3, q1: "q1_3", q2: "q2_3", q3: "q3_3", q4: "q4_3", q5: "q5_3" },
  { id: 4, q1: "q1_4", q2: "q2_4", q3: "q3_4", q4: "q4_4", q5: "q5_4" },
  { id: 5, q1: "q1_5", q2: "q2_5", q3: "q3_5", q4: "q4_5", q5: "q5_5" },
];

const rowsFivePartRefs: Row[] = [
  { id: 1, q1: "q1_5", q2: "q2_5", q3: "q3_5", q4: "q4_5", q5: "q5_5" },
  { id: 2, q1: "q1_3", q2: "q2_3", q3: "q3_3", q4: "q4_3", q5: "q5_3" },
  { id: 3, q1: "q1_5", q2: "q2_5", q3: "q3_5", q4: "q4_5", q5: "q5_5" },
  { id: 4, q1: "q1_5", q2: "q2_5", q3: "q3_5", q4: "q4_5", q5: "q5_5" },
  { id: 5, q1: "q1_3", q2: "q2_3", q3: "q3_3", q4: "q4_3", q5: "q5_3" },
];

const rowsFixedKeys: Row[] = [
  { code: "code_1" },
  { code: "code_2" },
  { code: "code_3" },
  { code: "code_4" },
  { code: "code_5" },
];

const rowsFixedRefs: Row[] = [
  { id: 1, fixed_code: "code_4" },
  { id: 2, fixed_code: "code_4" },
  { id: 3, fixed_code: "code_2" },
  { id: 4, fixed_code: "code_1" },
  { id: 5, fixed_code: "code_5" },
];

const rowsFixedUnique: Row[] = [
  { id: 1, code: "code_1" },
  { id: 2, code: "code_2" },
  { id: 3, code: "code_3" },
  { id: 4, code: "code_4" },
  { id: 5, code: "code_5" },
];

const rowsFlags: Row[] = [
  { id: 1, status: "active", is_primary: true },
  { id: 2, status: "active", is_primary: false },
];

const rowsFourPartKeys: Row[] = [
  { id: 1, p1: "p1_1", p2: "p2_1", p3: "p3_1", p4: "p4_1" },
  { id: 2, p1: "p1_2", p2: "p2_2", p3: "p3_2", p4: "p4_2" },
  { id: 3, p1: "p1_3", p2: "p2_3", p3: "p3_3", p4: "p4_3" },
  { id: 4, p1: "p1_4", p2: "p2_4", p3: "p3_4", p4: "p4_4" },
  { id: 5, p1: "p1_5", p2: "p2_5", p3: "p3_5", p4: "p4_5" },
];

const rowsFractionalTimes: Row[] = [
  { id: 1, starts_at: "17:52:32", created_at: "2026-10-03T18:08:57" },
  { id: 2, starts_at: "11:15:14", created_at: "2026-04-28T01:06:17" },
  { id: 3, starts_at: "23:04:53", created_at: "2026-10-09T02:13:40" },
  { id: 4, starts_at: "20:17:21", created_at: "2026-08-10T15:40:22" },
  { id: 5, starts_at: "14:31:45", created_at: "2026-12-18T09:35:26" },
];

const rowsJsonKeys: Row[] = [
  { doc: { value: 111 } },
  { doc: { value: 475 } },
  { doc: { value: 152 } },
  { doc: { value: 301 } },
  { doc: { value: 605 } },
];

const rowsJsonRefs: Row[] = [
  { id: 1, doc: { value: 856 } },
  { id: 2, doc: { value: 856 } },
  { id: 3, doc: { value: 523 } },
  { id: 4, doc: { value: 216 } },
  { id: 5, doc: { value: 631 } },
];

const rowsJsonUnique: Row[] = [
  { id: 1, doc: { value: 631 } },
  { id: 2, doc: { value: 523 } },
  { id: 3, doc: { value: 856 } },
  { id: 4, doc: { value: 78 } },
  { id: 5, doc: { value: 216 } },
];

const rowsLeaf: Row[] = [
  { id: 1, left_id: 5, right_id: 1 },
  { id: 2, left_id: 5, right_id: 5 },
  { id: 3, left_id: 1, right_id: 5 },
  { id: 4, left_id: 2, right_id: 5 },
  { id: 5, left_id: 5, right_id: 3 },
];

const rowsLeft: Row[] = [
  { id: 1, root_id: 3 },
  { id: 2, root_id: 1 },
  { id: 3, root_id: 4 },
  { id: 4, root_id: 5 },
  { id: 5, root_id: 3 },
];

const rowsLongComments: Row[] = [
  { id: 1, note: "note_1", surrogate_note: "surrogate_note_1" },
  { id: 2, note: "note_2", surrogate_note: "surrogate_note_2" },
  { id: 3, note: "note_3", surrogate_note: "surrogate_note_3" },
  { id: 4, note: "note_4", surrogate_note: "surrogate_note_4" },
  { id: 5, note: "note_5", surrogate_note: "surrogate_note_5" },
];

const rowsLongUnique: Row[] = [
  { id: 1, code: "code_1" },
  { id: 2, code: "code_2" },
  { id: 3, code: "code_3" },
  { id: 4, code: "code_4" },
  { id: 5, code: "code_5" },
];

const rowsNoKeyRows: Row[] = [
  { note: "note_1", value: 680512464 },
  { note: "note_2", value: -2024683812 },
  { note: "note_3", value: -1097183343 },
  { note: "note_4", value: 1403684304 },
  { note: "note_5", value: 291061546 },
];

const rowsNullableUnique: Row[] = [
  { id: 1, code: "code_1", alt_code: "alt_code_1" },
  { id: 2, code: "code_2", alt_code: "alt_code_2" },
  { id: 3, code: "code_3", alt_code: "alt_code_3" },
  { id: 4, code: "code_4", alt_code: "alt_code_4" },
  { id: 5, code: "code_5", alt_code: "alt_code_5" },
];

const rowsNullableUniqueRefs: Row[] = [
  { id: 1, code: "code_3" },
  { id: 2, code: "code_1" },
  { id: 3, code: "code_2" },
  { id: 4, code: "code_2" },
  { id: 5, code: "code_3" },
];

const rowsOversizedTypes: Row[] = [
  { id: 1, pg_varchar: "pg_varchar_1", mysql_char: "mysql_char_1", mysql_varchar: "mysql_varchar_1", sqlserver_char: "sqlserver_char_1", sqlserver_varchar: "sqlserver_varchar_1", pg_decimal: "954638464.91", mysql_decimal: "983148276.6784687621492733882805745271054" },
  { id: 2, pg_varchar: "pg_varchar_2", mysql_char: "mysql_char_2", mysql_varchar: "mysql_varchar_2", sqlserver_char: "sqlserver_char_2", sqlserver_varchar: "sqlserver_varchar_2", pg_decimal: "752496475.98", mysql_decimal: "624835936.8131158258809413735435127836087" },
  { id: 3, pg_varchar: "pg_varchar_3", mysql_char: "mysql_char_3", mysql_varchar: "mysql_varchar_3", sqlserver_char: "sqlserver_char_3", sqlserver_varchar: "sqlserver_varchar_3", pg_decimal: "749689704.24", mysql_decimal: "913598098.1133903833505502475544049458440" },
  { id: 4, pg_varchar: "pg_varchar_4", mysql_char: "mysql_char_4", mysql_varchar: "mysql_varchar_4", sqlserver_char: "sqlserver_char_4", sqlserver_varchar: "sqlserver_varchar_4", pg_decimal: "142319643.47", mysql_decimal: "612787009.5910618172516595201835727727538" },
  { id: 5, pg_varchar: "pg_varchar_5", mysql_char: "mysql_char_5", mysql_varchar: "mysql_varchar_5", sqlserver_char: "sqlserver_char_5", sqlserver_varchar: "sqlserver_varchar_5", pg_decimal: "877282019.81", mysql_decimal: "146917195.9574928561400130032422537153494" },
];

const rowsOversizedUnique: Row[] = [
  { id: 1, code: "code_1" },
  { id: 2, code: "code_2" },
  { id: 3, code: "code_3" },
  { id: 4, code: "code_4" },
  { id: 5, code: "code_5" },
];

const rowsRequiredA: Row[] = [];

const rowsRequiredB: Row[] = [];

const rowsRequiredChild: Row[] = [];

const rowsRight: Row[] = [
  { id: 1, root_id: 5 },
  { id: 2, root_id: 5 },
  { id: 3, root_id: 4 },
  { id: 4, root_id: 5 },
  { id: 5, root_id: 1 },
];

const rowsRoot: Row[] = [
  { id: 1, leaf_id: 1 },
  { id: 2, leaf_id: 1 },
  { id: 3, leaf_id: 2 },
  { id: 4, leaf_id: 4 },
  { id: 5, leaf_id: 3 },
];

const rowsTextKeys: Row[] = [
  { code: "code_1", label: "label_1", tag: "tag_1" },
  { code: "code_2", label: "label_2", tag: "tag_2" },
  { code: "code_3", label: "label_3", tag: "tag_3" },
  { code: "code_4", label: "label_4", tag: "tag_4" },
  { code: "code_5", label: "label_5", tag: "tag_5" },
];

const rowsTextRefs: Row[] = [
  { id: 1, text_key_code: "code_5" },
  { id: 2, text_key_code: "code_1" },
  { id: 3, text_key_code: "code_3" },
  { id: 4, text_key_code: "code_5" },
  { id: 5, text_key_code: "code_2" },
];

const rowsTreeNodes: Row[] = [
  { id: 1, parent_id: null },
  { id: 2, parent_id: 1 },
  { id: 3, parent_id: 2 },
  { id: 4, parent_id: 3 },
  { id: 5, parent_id: 4 },
];

const rowsUniqueOnly: Row[] = [
  { code: "code_1", label: "label_1" },
  { code: "code_2", label: "label_2" },
  { code: "code_3", label: "label_3" },
  { code: "code_4", label: "label_4" },
  { code: "code_5", label: "label_5" },
];

const rowsWideRows: Row[] = [
  { id: 1, v: "v_1" },
  { id: 2, v: "v_2" },
  { id: 3, v: "v_3" },
  { id: 4, v: "v_4" },
  { id: 5, v: "v_5" },
];

export const handlers = [
  http.get("*/api/all-types", () => HttpResponse.json(rowsAllTypes)),
  http.post("*/api/all-types", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsAllTypes.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsAllTypes.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/all-types/:id", ({ params }) => {
    const stored = rowsAllTypes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/all-types/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsAllTypes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsAllTypes.splice(rowsAllTypes.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/all-types/:id", ({ params }) => {
    const stored = rowsAllTypes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsAllTypes.splice(rowsAllTypes.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/auto-integer", () => HttpResponse.json(rowsAutoInteger)),
  http.post("*/api/auto-integer", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsAutoInteger.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsAutoInteger.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/auto-integer/:id", ({ params }) => {
    const stored = rowsAutoInteger.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/auto-integer/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsAutoInteger.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsAutoInteger.splice(rowsAutoInteger.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/auto-integer/:id", ({ params }) => {
    const stored = rowsAutoInteger.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsAutoInteger.splice(rowsAutoInteger.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/auto-smallint", () => HttpResponse.json(rowsAutoSmallint)),
  http.post("*/api/auto-smallint", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsAutoSmallint.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsAutoSmallint.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/auto-smallint/:id", ({ params }) => {
    const stored = rowsAutoSmallint.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/auto-smallint/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsAutoSmallint.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsAutoSmallint.splice(rowsAutoSmallint.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/auto-smallint/:id", ({ params }) => {
    const stored = rowsAutoSmallint.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsAutoSmallint.splice(rowsAutoSmallint.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/auto-trailing", () => HttpResponse.json(rowsAutoTrailing)),
  http.post("*/api/auto-trailing", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsAutoTrailing.some((candidate) => hasKey(candidate, ["a", "id"], ["a", "id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsAutoTrailing.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/auto-trailing/:a/:id", ({ params }) => {
    const stored = rowsAutoTrailing.find((candidate) => hasKey(candidate, ["a", "id"], [params["a"], params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/auto-trailing/:a/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsAutoTrailing.find((candidate) => hasKey(candidate, ["a", "id"], [params["a"], params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, a: stored["a"], id: stored["id"] };
    rowsAutoTrailing.splice(rowsAutoTrailing.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/auto-trailing/:a/:id", ({ params }) => {
    const stored = rowsAutoTrailing.find((candidate) => hasKey(candidate, ["a", "id"], [params["a"], params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsAutoTrailing.splice(rowsAutoTrailing.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/auto-wide-key", () => HttpResponse.json(rowsAutoWideKey)),
  http.post("*/api/auto-wide-key", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsAutoWideKey.some((candidate) => hasKey(candidate, ["id", "code_a", "code_b"], ["id", "code_a", "code_b"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsAutoWideKey.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/auto-wide-key/:id/:codeA/:codeB", ({ params }) => {
    const stored = rowsAutoWideKey.find((candidate) => hasKey(candidate, ["id", "code_a", "code_b"], [params["id"], params["codeA"], params["codeB"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/auto-wide-key/:id/:codeA/:codeB", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsAutoWideKey.find((candidate) => hasKey(candidate, ["id", "code_a", "code_b"], [params["id"], params["codeA"], params["codeB"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"], code_a: stored["code_a"], code_b: stored["code_b"] };
    rowsAutoWideKey.splice(rowsAutoWideKey.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/auto-wide-key/:id/:codeA/:codeB", ({ params }) => {
    const stored = rowsAutoWideKey.find((candidate) => hasKey(candidate, ["id", "code_a", "code_b"], [params["id"], params["codeA"], params["codeB"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsAutoWideKey.splice(rowsAutoWideKey.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/binary-keys", () => HttpResponse.json(rowsBinaryKeys)),
  http.post("*/api/binary-keys", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsBinaryKeys.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsBinaryKeys.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/binary-keys/:id", ({ params }) => {
    const stored = rowsBinaryKeys.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/binary-keys/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsBinaryKeys.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsBinaryKeys.splice(rowsBinaryKeys.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/binary-keys/:id", ({ params }) => {
    const stored = rowsBinaryKeys.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsBinaryKeys.splice(rowsBinaryKeys.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/char-unique", () => HttpResponse.json(rowsCharUnique)),
  http.post("*/api/char-unique", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsCharUnique.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsCharUnique.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/char-unique/:id", ({ params }) => {
    const stored = rowsCharUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/char-unique/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsCharUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsCharUnique.splice(rowsCharUnique.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/char-unique/:id", ({ params }) => {
    const stored = rowsCharUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsCharUnique.splice(rowsCharUnique.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/custom-required", () => HttpResponse.json(rowsCustomRequired)),
  http.post("*/api/custom-required", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsCustomRequired.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsCustomRequired.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/custom-required/:id", ({ params }) => {
    const stored = rowsCustomRequired.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/custom-required/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsCustomRequired.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsCustomRequired.splice(rowsCustomRequired.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/custom-required/:id", ({ params }) => {
    const stored = rowsCustomRequired.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsCustomRequired.splice(rowsCustomRequired.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/custom-values", () => HttpResponse.json(rowsCustomValues)),
  http.post("*/api/custom-values", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsCustomValues.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsCustomValues.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/custom-values/:id", ({ params }) => {
    const stored = rowsCustomValues.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/custom-values/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsCustomValues.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsCustomValues.splice(rowsCustomValues.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/custom-values/:id", ({ params }) => {
    const stored = rowsCustomValues.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsCustomValues.splice(rowsCustomValues.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/cycle-a", () => HttpResponse.json(rowsCycleA)),
  http.post("*/api/cycle-a", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsCycleA.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsCycleA.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/cycle-a/:id", ({ params }) => {
    const stored = rowsCycleA.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/cycle-a/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsCycleA.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsCycleA.splice(rowsCycleA.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/cycle-a/:id", ({ params }) => {
    const stored = rowsCycleA.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsCycleA.splice(rowsCycleA.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/cycle-b", () => HttpResponse.json(rowsCycleB)),
  http.post("*/api/cycle-b", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsCycleB.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsCycleB.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/cycle-b/:id", ({ params }) => {
    const stored = rowsCycleB.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/cycle-b/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsCycleB.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsCycleB.splice(rowsCycleB.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/cycle-b/:id", ({ params }) => {
    const stored = rowsCycleB.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsCycleB.splice(rowsCycleB.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/default-children", () => HttpResponse.json(rowsDefaultChildren)),
  http.post("*/api/default-children", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsDefaultChildren.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsDefaultChildren.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/default-children/:id", ({ params }) => {
    const stored = rowsDefaultChildren.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/default-children/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsDefaultChildren.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsDefaultChildren.splice(rowsDefaultChildren.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/default-children/:id", ({ params }) => {
    const stored = rowsDefaultChildren.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsDefaultChildren.splice(rowsDefaultChildren.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/default-parents", () => HttpResponse.json(rowsDefaultParents)),
  http.post("*/api/default-parents", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsDefaultParents.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsDefaultParents.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/default-parents/:id", ({ params }) => {
    const stored = rowsDefaultParents.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/default-parents/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsDefaultParents.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsDefaultParents.splice(rowsDefaultParents.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/default-parents/:id", ({ params }) => {
    const stored = rowsDefaultParents.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsDefaultParents.splice(rowsDefaultParents.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/five-part-keys", () => HttpResponse.json(rowsFivePartKeys)),
  http.post("*/api/five-part-keys", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsFivePartKeys.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsFivePartKeys.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/five-part-keys/:id", ({ params }) => {
    const stored = rowsFivePartKeys.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/five-part-keys/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsFivePartKeys.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsFivePartKeys.splice(rowsFivePartKeys.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/five-part-keys/:id", ({ params }) => {
    const stored = rowsFivePartKeys.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsFivePartKeys.splice(rowsFivePartKeys.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/five-part-refs", () => HttpResponse.json(rowsFivePartRefs)),
  http.post("*/api/five-part-refs", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsFivePartRefs.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsFivePartRefs.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/five-part-refs/:id", ({ params }) => {
    const stored = rowsFivePartRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/five-part-refs/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsFivePartRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsFivePartRefs.splice(rowsFivePartRefs.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/five-part-refs/:id", ({ params }) => {
    const stored = rowsFivePartRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsFivePartRefs.splice(rowsFivePartRefs.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/fixed-keys", () => HttpResponse.json(rowsFixedKeys)),
  http.post("*/api/fixed-keys", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsFixedKeys.some((candidate) => hasKey(candidate, ["code"], ["code"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsFixedKeys.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/fixed-keys/:code", ({ params }) => {
    const stored = rowsFixedKeys.find((candidate) => hasKey(candidate, ["code"], [params["code"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/fixed-keys/:code", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsFixedKeys.find((candidate) => hasKey(candidate, ["code"], [params["code"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, code: stored["code"] };
    rowsFixedKeys.splice(rowsFixedKeys.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/fixed-keys/:code", ({ params }) => {
    const stored = rowsFixedKeys.find((candidate) => hasKey(candidate, ["code"], [params["code"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsFixedKeys.splice(rowsFixedKeys.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/fixed-refs", () => HttpResponse.json(rowsFixedRefs)),
  http.post("*/api/fixed-refs", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsFixedRefs.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsFixedRefs.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/fixed-refs/:id", ({ params }) => {
    const stored = rowsFixedRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/fixed-refs/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsFixedRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsFixedRefs.splice(rowsFixedRefs.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/fixed-refs/:id", ({ params }) => {
    const stored = rowsFixedRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsFixedRefs.splice(rowsFixedRefs.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/fixed-unique", () => HttpResponse.json(rowsFixedUnique)),
  http.post("*/api/fixed-unique", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsFixedUnique.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsFixedUnique.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/fixed-unique/:id", ({ params }) => {
    const stored = rowsFixedUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/fixed-unique/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsFixedUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsFixedUnique.splice(rowsFixedUnique.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/fixed-unique/:id", ({ params }) => {
    const stored = rowsFixedUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsFixedUnique.splice(rowsFixedUnique.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/flags", () => HttpResponse.json(rowsFlags)),
  http.post("*/api/flags", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsFlags.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsFlags.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/flags/:id", ({ params }) => {
    const stored = rowsFlags.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/flags/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsFlags.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsFlags.splice(rowsFlags.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/flags/:id", ({ params }) => {
    const stored = rowsFlags.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsFlags.splice(rowsFlags.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/four-part-keys", () => HttpResponse.json(rowsFourPartKeys)),
  http.post("*/api/four-part-keys", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsFourPartKeys.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsFourPartKeys.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/four-part-keys/:id", ({ params }) => {
    const stored = rowsFourPartKeys.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/four-part-keys/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsFourPartKeys.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsFourPartKeys.splice(rowsFourPartKeys.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/four-part-keys/:id", ({ params }) => {
    const stored = rowsFourPartKeys.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsFourPartKeys.splice(rowsFourPartKeys.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/fractional-times", () => HttpResponse.json(rowsFractionalTimes)),
  http.post("*/api/fractional-times", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsFractionalTimes.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsFractionalTimes.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/fractional-times/:id", ({ params }) => {
    const stored = rowsFractionalTimes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/fractional-times/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsFractionalTimes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsFractionalTimes.splice(rowsFractionalTimes.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/fractional-times/:id", ({ params }) => {
    const stored = rowsFractionalTimes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsFractionalTimes.splice(rowsFractionalTimes.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/json-keys", () => HttpResponse.json(rowsJsonKeys)),
  http.post("*/api/json-keys", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsJsonKeys.some((candidate) => hasKey(candidate, ["doc"], ["doc"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsJsonKeys.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/json-keys/:doc", ({ params }) => {
    const stored = rowsJsonKeys.find((candidate) => hasKey(candidate, ["doc"], [params["doc"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/json-keys/:doc", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsJsonKeys.find((candidate) => hasKey(candidate, ["doc"], [params["doc"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, doc: stored["doc"] };
    rowsJsonKeys.splice(rowsJsonKeys.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/json-keys/:doc", ({ params }) => {
    const stored = rowsJsonKeys.find((candidate) => hasKey(candidate, ["doc"], [params["doc"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsJsonKeys.splice(rowsJsonKeys.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/json-refs", () => HttpResponse.json(rowsJsonRefs)),
  http.post("*/api/json-refs", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsJsonRefs.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsJsonRefs.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/json-refs/:id", ({ params }) => {
    const stored = rowsJsonRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/json-refs/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsJsonRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsJsonRefs.splice(rowsJsonRefs.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/json-refs/:id", ({ params }) => {
    const stored = rowsJsonRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsJsonRefs.splice(rowsJsonRefs.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/json-unique", () => HttpResponse.json(rowsJsonUnique)),
  http.post("*/api/json-unique", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsJsonUnique.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsJsonUnique.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/json-unique/:id", ({ params }) => {
    const stored = rowsJsonUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/json-unique/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsJsonUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsJsonUnique.splice(rowsJsonUnique.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/json-unique/:id", ({ params }) => {
    const stored = rowsJsonUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsJsonUnique.splice(rowsJsonUnique.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/leaf", () => HttpResponse.json(rowsLeaf)),
  http.post("*/api/leaf", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsLeaf.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsLeaf.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/leaf/:id", ({ params }) => {
    const stored = rowsLeaf.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/leaf/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsLeaf.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsLeaf.splice(rowsLeaf.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/leaf/:id", ({ params }) => {
    const stored = rowsLeaf.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsLeaf.splice(rowsLeaf.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/left", () => HttpResponse.json(rowsLeft)),
  http.post("*/api/left", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsLeft.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsLeft.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/left/:id", ({ params }) => {
    const stored = rowsLeft.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/left/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsLeft.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsLeft.splice(rowsLeft.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/left/:id", ({ params }) => {
    const stored = rowsLeft.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsLeft.splice(rowsLeft.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/long-comments", () => HttpResponse.json(rowsLongComments)),
  http.post("*/api/long-comments", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsLongComments.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsLongComments.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/long-comments/:id", ({ params }) => {
    const stored = rowsLongComments.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/long-comments/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsLongComments.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsLongComments.splice(rowsLongComments.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/long-comments/:id", ({ params }) => {
    const stored = rowsLongComments.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsLongComments.splice(rowsLongComments.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/long-unique", () => HttpResponse.json(rowsLongUnique)),
  http.post("*/api/long-unique", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsLongUnique.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsLongUnique.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/long-unique/:id", ({ params }) => {
    const stored = rowsLongUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/long-unique/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsLongUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsLongUnique.splice(rowsLongUnique.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/long-unique/:id", ({ params }) => {
    const stored = rowsLongUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsLongUnique.splice(rowsLongUnique.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/no-key-rows", () => HttpResponse.json(rowsNoKeyRows)),
  http.post("*/api/no-key-rows", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    rowsNoKeyRows.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/nullable-unique", () => HttpResponse.json(rowsNullableUnique)),
  http.post("*/api/nullable-unique", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsNullableUnique.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsNullableUnique.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/nullable-unique/:id", ({ params }) => {
    const stored = rowsNullableUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/nullable-unique/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsNullableUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsNullableUnique.splice(rowsNullableUnique.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/nullable-unique/:id", ({ params }) => {
    const stored = rowsNullableUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsNullableUnique.splice(rowsNullableUnique.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/nullable-unique-refs", () => HttpResponse.json(rowsNullableUniqueRefs)),
  http.post("*/api/nullable-unique-refs", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsNullableUniqueRefs.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsNullableUniqueRefs.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/nullable-unique-refs/:id", ({ params }) => {
    const stored = rowsNullableUniqueRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/nullable-unique-refs/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsNullableUniqueRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsNullableUniqueRefs.splice(rowsNullableUniqueRefs.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/nullable-unique-refs/:id", ({ params }) => {
    const stored = rowsNullableUniqueRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsNullableUniqueRefs.splice(rowsNullableUniqueRefs.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/oversized-types", () => HttpResponse.json(rowsOversizedTypes)),
  http.post("*/api/oversized-types", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsOversizedTypes.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsOversizedTypes.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/oversized-types/:id", ({ params }) => {
    const stored = rowsOversizedTypes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/oversized-types/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsOversizedTypes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsOversizedTypes.splice(rowsOversizedTypes.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/oversized-types/:id", ({ params }) => {
    const stored = rowsOversizedTypes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsOversizedTypes.splice(rowsOversizedTypes.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/oversized-unique", () => HttpResponse.json(rowsOversizedUnique)),
  http.post("*/api/oversized-unique", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsOversizedUnique.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsOversizedUnique.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/oversized-unique/:id", ({ params }) => {
    const stored = rowsOversizedUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/oversized-unique/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsOversizedUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsOversizedUnique.splice(rowsOversizedUnique.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/oversized-unique/:id", ({ params }) => {
    const stored = rowsOversizedUnique.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsOversizedUnique.splice(rowsOversizedUnique.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/required-a", () => HttpResponse.json(rowsRequiredA)),
  http.post("*/api/required-a", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsRequiredA.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsRequiredA.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/required-a/:id", ({ params }) => {
    const stored = rowsRequiredA.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/required-a/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsRequiredA.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsRequiredA.splice(rowsRequiredA.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/required-a/:id", ({ params }) => {
    const stored = rowsRequiredA.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsRequiredA.splice(rowsRequiredA.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/required-b", () => HttpResponse.json(rowsRequiredB)),
  http.post("*/api/required-b", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsRequiredB.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsRequiredB.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/required-b/:id", ({ params }) => {
    const stored = rowsRequiredB.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/required-b/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsRequiredB.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsRequiredB.splice(rowsRequiredB.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/required-b/:id", ({ params }) => {
    const stored = rowsRequiredB.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsRequiredB.splice(rowsRequiredB.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/required-child", () => HttpResponse.json(rowsRequiredChild)),
  http.post("*/api/required-child", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsRequiredChild.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsRequiredChild.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/required-child/:id", ({ params }) => {
    const stored = rowsRequiredChild.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/required-child/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsRequiredChild.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsRequiredChild.splice(rowsRequiredChild.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/required-child/:id", ({ params }) => {
    const stored = rowsRequiredChild.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsRequiredChild.splice(rowsRequiredChild.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/right", () => HttpResponse.json(rowsRight)),
  http.post("*/api/right", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsRight.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsRight.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/right/:id", ({ params }) => {
    const stored = rowsRight.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/right/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsRight.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsRight.splice(rowsRight.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/right/:id", ({ params }) => {
    const stored = rowsRight.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsRight.splice(rowsRight.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/root", () => HttpResponse.json(rowsRoot)),
  http.post("*/api/root", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsRoot.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsRoot.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/root/:id", ({ params }) => {
    const stored = rowsRoot.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/root/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsRoot.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsRoot.splice(rowsRoot.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/root/:id", ({ params }) => {
    const stored = rowsRoot.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsRoot.splice(rowsRoot.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/text-keys", () => HttpResponse.json(rowsTextKeys)),
  http.post("*/api/text-keys", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsTextKeys.some((candidate) => hasKey(candidate, ["code"], ["code"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsTextKeys.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/text-keys/:code", ({ params }) => {
    const stored = rowsTextKeys.find((candidate) => hasKey(candidate, ["code"], [params["code"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/text-keys/:code", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsTextKeys.find((candidate) => hasKey(candidate, ["code"], [params["code"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, code: stored["code"] };
    rowsTextKeys.splice(rowsTextKeys.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/text-keys/:code", ({ params }) => {
    const stored = rowsTextKeys.find((candidate) => hasKey(candidate, ["code"], [params["code"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsTextKeys.splice(rowsTextKeys.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/text-refs", () => HttpResponse.json(rowsTextRefs)),
  http.post("*/api/text-refs", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsTextRefs.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsTextRefs.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/text-refs/:id", ({ params }) => {
    const stored = rowsTextRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/text-refs/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsTextRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsTextRefs.splice(rowsTextRefs.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/text-refs/:id", ({ params }) => {
    const stored = rowsTextRefs.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsTextRefs.splice(rowsTextRefs.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/tree-nodes", () => HttpResponse.json(rowsTreeNodes)),
  http.post("*/api/tree-nodes", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsTreeNodes.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsTreeNodes.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/tree-nodes/:id", ({ params }) => {
    const stored = rowsTreeNodes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/tree-nodes/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsTreeNodes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsTreeNodes.splice(rowsTreeNodes.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/tree-nodes/:id", ({ params }) => {
    const stored = rowsTreeNodes.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsTreeNodes.splice(rowsTreeNodes.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get("*/api/unique-only", () => HttpResponse.json(rowsUniqueOnly)),
  http.post("*/api/unique-only", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    rowsUniqueOnly.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/wide-rows", () => HttpResponse.json(rowsWideRows)),
  http.post("*/api/wide-rows", async ({ request }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    if (rowsWideRows.some((candidate) => hasKey(candidate, ["id"], ["id"].map((column) => body[column])))) {
      return new HttpResponse(null, { status: 409 });
    }
    rowsWideRows.push(body);
    return HttpResponse.json(body, { status: 201 });
  }),
  http.get("*/api/wide-rows/:id", ({ params }) => {
    const stored = rowsWideRows.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    return stored === undefined ? new HttpResponse(null, { status: 404 }) : HttpResponse.json(stored);
  }),
  http.put("*/api/wide-rows/:id", async ({ request, params }) => {
    const body: unknown = await request.json().catch(() => null);
    if (!isRow(body)) {
      return new HttpResponse(null, { status: 400 });
    }
    const stored = rowsWideRows.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    const replacement: Row = { ...body, id: stored["id"] };
    rowsWideRows.splice(rowsWideRows.indexOf(stored), 1, replacement);
    return HttpResponse.json(replacement);
  }),
  http.delete("*/api/wide-rows/:id", ({ params }) => {
    const stored = rowsWideRows.find((candidate) => hasKey(candidate, ["id"], [params["id"]]));
    if (stored === undefined) {
      return new HttpResponse(null, { status: 404 });
    }
    rowsWideRows.splice(rowsWideRows.indexOf(stored), 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
