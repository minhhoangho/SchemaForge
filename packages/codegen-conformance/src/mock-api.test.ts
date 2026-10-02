import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { sortTables } from "@schemaforge/core";
import type { SchemaDocument } from "@schemaforge/core";
import { generateMockApi } from "@schemaforge/core/generators/mock-api";
import { generateOpenApi } from "@schemaforge/core/generators/openapi";
import { HttpHandler } from "msw";
import { setupServer } from "msw/node";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { listConformanceFixtures } from "./support/fixtures.js";
import { withTempDirectory } from "./support/temp-directory.js";
import { typecheckFiles } from "./support/typecheck.js";

// The OpenAPI server URL is `/api`; MSW paths start with `*/api`.
const API_ORIGIN = "http://localhost/api";
const CRUD_FIXTURES: ReadonlySet<string> = new Set(["sample", "target-limit"]);

// Only the parts of the generated OpenAPI document this test reads.
const openApiShape = z.object({
  paths: z.record(
    z.string(),
    z.object({
      parameters: z.array(z.object({ name: z.string() })).optional(),
      get: z.object({
        responses: z.object({
          "200": z.object({
            content: z.object({
              "application/json": z.object({
                schema: z.object({ $ref: z.string().optional() }),
              }),
            }),
          }),
        }),
      }),
    }),
  ),
  components: z.object({
    schemas: z.record(
      z.string(),
      z.object({ properties: z.record(z.string(), z.unknown()).optional() }),
    ),
  }),
});
const handlersModuleShape = z.object({
  handlers: z.array(z.instanceof(HttpHandler)),
});
const rowShape = z.record(z.string(), z.unknown());

type Row = z.infer<typeof rowShape>;

type CrudTarget = {
  readonly collectionPath: string;
  readonly itemPath: string;
  readonly parameterNames: readonly string[];
  readonly keyColumnNames: readonly string[];
  // Null when every column is a key column: the PUT then sends the row as is.
  readonly nonKeyColumnName: string | null;
};

type CrudRun = {
  readonly row: Row;
  readonly replacement: Row;
  readonly observed: unknown;
};

function haveSameNames(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return [...left].sort().join("\n") === [...right].sort().join("\n");
}

// An item path names its table only through the component of its response, so
// the table is the one whose columns are the component's properties.
function toCrudTarget(
  schema: SchemaDocument,
  propertyNames: readonly string[],
  itemPath: string,
  parameterNames: readonly string[],
): readonly CrudTarget[] {
  const table = sortTables(schema).find(
    (candidate) =>
      candidate.primaryKeyColumnIds.length === parameterNames.length &&
      haveSameNames(
        candidate.columnIds.map((id) => schema.columns[id]?.name ?? ""),
        propertyNames,
      ),
  );
  const keyColumns = (table?.primaryKeyColumnIds ?? []).flatMap(
    (id) => schema.columns[id] ?? [],
  );
  const nonKeyColumn = table?.columnIds
    .filter((id) => !table.primaryKeyColumnIds.includes(id))
    .flatMap((id) => schema.columns[id] ?? [])[0];
  // `hasKey` compares keys with String(), so a json key would match every row.
  const hasJsonKey = keyColumns.some((column) => column.type.kind === "json");
  return keyColumns.length === 0 || hasJsonKey
    ? []
    : [
        {
          collectionPath: itemPath.slice(0, itemPath.indexOf("/{")),
          itemPath,
          parameterNames,
          keyColumnNames: keyColumns.map((column) => column.name),
          nonKeyColumnName: nonKeyColumn?.name ?? null,
        },
      ];
}

function listCrudTargets(schema: SchemaDocument): readonly CrudTarget[] {
  const document = openApiShape.parse(
    JSON.parse(generateOpenApi(schema, {}).file.content),
  );
  return Object.entries(document.paths).flatMap(([itemPath, item]) => {
    const reference =
      item.get.responses["200"].content["application/json"].schema.$ref ?? "";
    const component =
      document.components.schemas[reference.split("/").at(-1) ?? ""];
    return toCrudTarget(
      schema,
      Object.keys(component?.properties ?? {}),
      itemPath,
      (item.parameters ?? []).map((parameter) => parameter.name),
    );
  });
}

function findCrudTarget(
  targets: readonly CrudTarget[],
  isComposite: boolean,
): CrudTarget {
  const target = targets.find((candidate) =>
    isComposite
      ? candidate.parameterNames.length >= 2
      : candidate.parameterNames.length === 1,
  );
  if (target === undefined) {
    throw new Error(`No ${isComposite ? "composite" : "single"}-key path`);
  }
  return target;
}

async function withMockServer<T>(
  content: string,
  run: () => Promise<T>,
): Promise<T> {
  return withTempDirectory(async (directory) => {
    const path = join(directory, "handlers.ts");
    await writeFile(path, content);
    const loaded: unknown = await import(pathToFileURL(path).href);
    const server = setupServer(...handlersModuleShape.parse(loaded).handlers);
    server.listen({ onUnhandledRequest: "error" });
    try {
      return await run();
    } finally {
      server.close();
    }
  });
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text === "" ? null : JSON.parse(text);
}

function itemUrl(target: CrudTarget, row: Row): string {
  const path = target.parameterNames.reduce(
    (current, name, index) =>
      current.replace(`{${name}}`, () =>
        encodeURIComponent(String(row[target.keyColumnNames[index] ?? ""])),
      ),
    target.itemPath,
  );
  return `${API_ORIGIN}${path}`;
}

// The new value is a string that cannot equal the old one, whatever its type.
function replaceNonKeyValue(row: Row, columnName: string | null): Row {
  return columnName === null
    ? row
    : { ...row, [columnName]: `${JSON.stringify(row[columnName])} changed` };
}

async function runCrudSequence(target: CrudTarget): Promise<CrudRun> {
  const collectionUrl = `${API_ORIGIN}${target.collectionPath}`;
  const list = await fetch(collectionUrl);
  const rows = z.array(rowShape).parse(await readJson(list));
  const row = rows[0] ?? {};
  const url = itemUrl(target, row);
  const replacement = replaceNonKeyValue(row, target.nonKeyColumnName);
  const read = await fetch(url);
  const readBody = await readJson(read);
  const replace = await fetch(url, jsonRequest("PUT", replacement));
  const replaceBody = await readJson(replace);
  const remove = await fetch(url, { method: "DELETE" });
  const readRemoved = await fetch(url);
  const create = await fetch(collectionUrl, jsonRequest("POST", row));
  const createAgain = await fetch(collectionUrl, jsonRequest("POST", row));
  const createArray = await fetch(collectionUrl, jsonRequest("POST", []));
  return {
    row,
    replacement,
    observed: {
      list: { status: list.status, rowCount: rows.length },
      read: { status: read.status, body: readBody },
      replace: { status: replace.status, body: replaceBody },
      remove: remove.status,
      readRemoved: readRemoved.status,
      create: create.status,
      createAgain: createAgain.status,
      createArray: createArray.status,
    },
  };
}

function expectedObservations(run: CrudRun): unknown {
  return {
    list: { status: 200, rowCount: 5 },
    read: { status: 200, body: run.row },
    replace: { status: 200, body: run.replacement },
    remove: 204,
    readRemoved: 404,
    create: 201,
    createAgain: 409,
    createArray: 400,
  };
}

describe.each(listConformanceFixtures())("mock api for $name", ({ schema }) => {
  it("typechecks with msw", async () => {
    const { file } = generateMockApi(schema, {});

    expect(
      await typecheckFiles([
        { fileName: file.fileName, content: file.content },
      ]),
    ).toStrictEqual([]);
  });
});

describe.each(
  listConformanceFixtures().filter((fixture) =>
    CRUD_FIXTURES.has(fixture.name),
  ),
)("mock api routes for $name", ({ schema }) => {
  it("serves the crud routes of a single-key and a composite-key table", async () => {
    const targets = listCrudTargets(schema);
    const runs = await withMockServer(
      generateMockApi(schema, {}).file.content,
      async () => [
        await runCrudSequence(findCrudTarget(targets, false)),
        await runCrudSequence(findCrudTarget(targets, true)),
      ],
    );

    expect(runs.map((run) => run.observed)).toStrictEqual(
      runs.map(expectedObservations),
    );
  });
});
