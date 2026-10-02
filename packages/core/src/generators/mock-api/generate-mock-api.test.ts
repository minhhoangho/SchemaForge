import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import { createEmptySchema } from "../../model/create-empty-schema.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { Table } from "../../model/table.js";
import { buildSchema, makeColumn, makeTable } from "../../testing/factories.js";
import { formatDiagnosticsSnapshot } from "../../testing/generator-snapshot.js";
import { createNamingEdgeSchema } from "../../testing/naming-edge-schema.js";
import { createSampleSchema } from "../../testing/sample-schema.js";
import { createTargetLimitSchema } from "../../testing/target-limit-schema.js";
import { buildSeedDataset } from "../seed/build-seed-dataset.js";
import { generateMockApi } from "./generate-mock-api.js";

const HEADER = [
  "// Mock REST API handlers for MSW 2 (npm install msw@^2).",
  "// Browser: run npx msw init <public dir>, then setupWorker(...handlers).start().",
  "// Node: setupServer(...handlers).listen() from msw/node.",
].join("\n");

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

const USERS_SCHEMA = usersSchema({ primaryKeyColumnIds: ["col_id"] }, [
  column({ id: "col_id", name: "id" }),
  column({ id: "col_email", name: "email", type: { kind: "text" } }),
]);

function contentOf(schema: SchemaDocument): string {
  return generateMockApi(schema, {}).file.content;
}

// The lines between `const <variable>: Row[] = [` and the closing `];`.
function rowLines(content: string, variable: string): readonly string[] {
  const lines = content.split("\n");
  const start = lines.indexOf(`const ${variable}: Row[] = [`);
  return lines.slice(start + 1, lines.indexOf("];", start));
}

describe("generateMockApi", () => {
  it("names the file handlers.ts with language typescript", () => {
    const { file } = generateMockApi(createEmptySchema("Empty"), {});

    expect({ fileName: file.fileName, language: file.language }).toStrictEqual({
      fileName: "handlers.ts",
      language: "typescript",
    });
  });

  it("starts with the MSW 2 usage comment", () => {
    expect(contentOf(USERS_SCHEMA).startsWith(`${HEADER}\n\n`)).toBe(true);
  });

  it("imports http and HttpResponse from msw", () => {
    expect(contentOf(USERS_SCHEMA).split("\n")[4]).toBe(
      'import { http, HttpResponse } from "msw";',
    );
  });

  it("fills each table with five seed rows", () => {
    expect(rowLines(contentOf(USERS_SCHEMA), "rowsUsers")).toHaveLength(5);
  });

  it("matches the rows of buildSeedDataset with seed 1", () => {
    const { dataset } = buildSeedDataset(USERS_SCHEMA, {
      rowsPerTable: 5,
      seed: 1,
    });
    const expected = (dataset.tables[0]?.rows ?? []).map(
      (row) =>
        `  { id: ${JSON.stringify(row.col_id)}, email: ${JSON.stringify(row.col_email)} },`,
    );

    expect(rowLines(contentOf(USERS_SCHEMA), "rowsUsers")).toStrictEqual(
      expected,
    );
  });

  it("writes original column names as keys", () => {
    const schema = usersSchema({}, [
      column({ id: "col_name", name: "Họ tên", type: { kind: "text" } }),
      column({ id: "col_proto", name: "__proto__" }),
    ]);

    expect(rowLines(contentOf(schema), "rowsUsers")[0]).toMatch(
      /^ {2}\{ "Họ tên": "[^"]*", \["__proto__"\]: -?\d+ \},$/u,
    );
  });

  it("forwards seed diagnostics", () => {
    const schema = usersSchema({}, [
      column({
        id: "col_shape",
        type: { kind: "custom", name: "geometry" },
      }),
    ]);

    expect(generateMockApi(schema, {}).diagnostics).toContainEqual({
      code: "seed-table-skipped",
      path: ["tables", "tbl_users"],
    });
  });

  it("writes an empty array for a table the seed skips", () => {
    const schema = usersSchema({}, [
      column({
        id: "col_shape",
        type: { kind: "custom", name: "geometry" },
      }),
    ]);

    expect(contentOf(schema)).toContain("const rowsUsers: Row[] = [];");
  });

  it("reports table-without-identifier for a table without a primary key", () => {
    const schema = usersSchema({}, [column({ id: "col_id", name: "id" })]);

    expect(generateMockApi(schema, {}).diagnostics).toStrictEqual([
      { code: "table-without-identifier", path: ["tables", "tbl_users"] },
    ]);
  });

  it("reports custom-type-unmapped for a custom column", () => {
    const schema = usersSchema({ primaryKeyColumnIds: ["col_id"] }, [
      column({ id: "col_id", name: "id" }),
      column({
        id: "col_shape",
        type: { kind: "custom", name: "geometry" },
        isNullable: true,
      }),
    ]);

    expect(generateMockApi(schema, {}).diagnostics).toStrictEqual([
      { code: "custom-type-unmapped", path: ["columns", "col_shape", "type"] },
    ]);
  });

  it("matches every handler path with */api", () => {
    const paths = [
      ...contentOf(createSampleSchema()).matchAll(/http\.\w+\("([^"]*)"/gu),
    ].map((match) => match[1] ?? "");

    expect({
      hasPaths: paths.length > 0,
      outside: paths.filter((path) => !path.startsWith("*/api/")),
    }).toStrictEqual({ hasPaths: true, outside: [] });
  });

  it("writes an empty schema as the comment and an empty handlers array", () => {
    const result = generateMockApi(createEmptySchema("Empty"), {});

    expect([result.file.content, result.diagnostics]).toStrictEqual([
      `${HEADER}\n\nexport const handlers = [];\n`,
      [],
    ]);
  });

  it("returns the same content when map keys were inserted in a different order", () => {
    const schema = createSampleSchema();
    const reordered: SchemaDocument = {
      ...schema,
      tables: Object.fromEntries(Object.entries(schema.tables).reverse()),
      columns: Object.fromEntries(Object.entries(schema.columns).reverse()),
      relations: Object.fromEntries(Object.entries(schema.relations).reverse()),
      enums: Object.fromEntries(Object.entries(schema.enums).reverse()),
    };

    expect(generateMockApi(reordered, {})).toStrictEqual(
      generateMockApi(schema, {}),
    );
  });

  it.each<[string, () => SchemaDocument]>([
    ["sample", createSampleSchema],
    ["naming-edge", createNamingEdgeSchema],
    ["target-limit", createTargetLimitSchema],
    ["empty", () => createEmptySchema("Empty")],
  ])("matches the snapshot for %s", async (fixture, createSchema) => {
    const result = generateMockApi(createSchema(), {});

    await expect(result.file.content).toMatchFileSnapshot(
      `../__snapshots__/mock-api/${fixture}.ts`,
    );
    await expect(
      formatDiagnosticsSnapshot(result.diagnostics),
    ).toMatchFileSnapshot(
      `../__snapshots__/mock-api/${fixture}.diagnostics.txt`,
    );
  });
});
