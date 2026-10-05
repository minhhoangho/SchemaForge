import {
  applyOperation,
  createEmptySchema,
  finalizeImportDiagnostics,
  type ImportFormat,
  type SchemaDocument,
} from "@schemaforge/core";
import {
  SSMS_SCRIPT_EXPECTED_DIAGNOSTICS,
  SSMS_SCRIPT_SOURCE,
  createCounterIdGenerator,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { readImportFile } from "./decode-import-file";
import { handleImportRequest } from "./handle-import-request";
import { loadImporter } from "./importer-loaders";
import type { ImportRequest } from "./import-protocol";

const layout = {
  tableWidth: 320,
  headerHeight: 37,
  columnRowHeight: 28,
  gap: 80,
};

function requestOf(overrides: Partial<ImportRequest>): ImportRequest {
  return {
    requestId: 1,
    format: "dbml",
    source: "",
    fallbackSchemaName: "Fallback",
    layout,
    mode: { mode: "new" },
    target: null,
    ...overrides,
  };
}

// Shared by the calls of one test so merged ids never repeat the target's.
function createRunner(): (
  request: ImportRequest,
) => ReturnType<typeof handleImportRequest> {
  const generateId = createCounterIdGenerator();
  return (request) =>
    handleImportRequest(request, { loadImporter, generateId });
}

const DBML = `Project Shop {
  note: 'x'
}
Table users {
  id int [pk]
  email varchar
}
Table posts {
  id int [pk]
  user_id int [ref: > users.id]
}`;

function importDbml(
  target: SchemaDocument | null,
  source = DBML,
): ImportRequest {
  return requestOf({
    source,
    target,
    mode:
      target === null
        ? { mode: "new" }
        : { mode: "merge", origin: { x: 500, y: 0 } },
  });
}

describe("handleImportRequest", () => {
  it("returns the operation, summary and diagnostics of a new import", async () => {
    const run = createRunner();
    const response = await run(importDbml(null));

    expect(response.kind).toBe("success");
    if (response.kind !== "success") return;
    expect(response.requestId).toBe(1);
    expect(response.operation.type).toBe("batch");
    expect(response.summary).toStrictEqual({
      tables: 2,
      columns: 4,
      relations: 1,
      indexes: 0,
      enums: 0,
      subjectAreas: 0,
      notes: 0,
    });
    expect(response.diagnostics).toStrictEqual(
      finalizeImportDiagnostics(response.diagnostics),
    );
    const applied = applyOperation(
      createEmptySchema("Shop"),
      response.operation,
    );
    expect(applied.isOk && applied.value.schema).toStrictEqual(
      response.resultDocument,
    );
  });

  it("keeps the source schema name in new mode", async () => {
    const run = createRunner();
    const response = await run(
      requestOf({ source: DBML, fallbackSchemaName: "Other" }),
    );

    expect(response.kind === "success" && response.resultDocument.name).toBe(
      "Shop",
    );
  });

  it("merges into a target and lists only introduced issues", async () => {
    const run = createRunner();
    const first = await run(importDbml(null));
    if (first.kind !== "success") throw new Error("setup failed");
    const target = first.resultDocument;

    const response = await run(
      importDbml(target, "Table orders {\n  id varchar [pk, increment]\n}"),
    );

    expect(response.kind).toBe("success");
    if (response.kind !== "success") return;
    expect(response.resultDocument.name).toBe("Shop");
    expect(Object.keys(response.resultDocument.tables)).toHaveLength(3);
    expect(response.summary.tables).toBe(1);
    // Only the new table's problem, none of the target's.
    expect(response.introducedIssues.map((issue) => issue.code)).toStrictEqual([
      "column-auto-increment-invalid-type",
    ]);
  });

  it("sorts importer and merge diagnostics together", async () => {
    const run = createRunner();
    const first = await run(importDbml(null));
    if (first.kind !== "success") throw new Error("setup failed");

    const response = await run(
      importDbml(first.resultDocument, "Table users {\n  id int [pk]\n}"),
    );

    expect(response.kind).toBe("success");
    if (response.kind !== "success") return;
    expect(response.diagnostics.length).toBeGreaterThan(0);
    expect(response.diagnostics).toStrictEqual(
      finalizeImportDiagnostics(response.diagnostics),
    );
  });

  it("returns failure diagnostics for unreadable source", async () => {
    const run = createRunner();
    const response = await run(requestOf({ format: "json", source: "{" }));

    expect(response.kind).toBe("failure");
    expect(
      response.kind === "failure" && response.diagnostics.length,
    ).toBeGreaterThan(0);
  });

  it("returns crashed when the batch does not apply", async () => {
    const run = createRunner();
    const ok = await run(importDbml(null));
    if (ok.kind !== "success") throw new Error("setup failed");
    const [relation] = Object.values(ok.resultDocument.relations);
    if (relation === undefined) throw new Error("setup failed");
    // A relation to a table that does not exist: addRelation is rejected.
    const broken: SchemaDocument = {
      ...ok.resultDocument,
      relations: {
        [relation.id]: { ...relation, toTableId: "tbl_missing" },
      },
    };

    const response = await handleImportRequest(importDbml(null), {
      loadImporter: () =>
        Promise.resolve(() => ({
          isOk: true,
          value: { document: broken, diagnostics: [] },
        })),
      generateId: createCounterIdGenerator(),
    });

    expect(response).toStrictEqual({ requestId: 1, kind: "crashed" });
  });

  it("returns crashed for a merge request without a target", async () => {
    const run = createRunner();
    const response = await run(
      requestOf({
        source: DBML,
        mode: { mode: "merge", origin: { x: 0, y: 0 } },
      }),
    );

    expect(response).toStrictEqual({ requestId: 1, kind: "crashed" });
  });

  it("imports an ssms script saved as utf-16 le with a byte order mark", async () => {
    const bytes = [0xff, 0xfe];
    for (const character of SSMS_SCRIPT_SOURCE) {
      const code = character.codePointAt(0) ?? 0;
      // The script is plain BMP text, so one code unit per character.
      bytes.push(code & 0xff, code >> 8);
    }
    const decoded = await readImportFile(
      new File([new Uint8Array(bytes)], "script.sql"),
    );
    expect(decoded).toStrictEqual({ isOk: true, value: SSMS_SCRIPT_SOURCE });
    if (!decoded.isOk) return;

    const format: ImportFormat = "sqlserver";
    const fromFile = await handleImportRequest(
      requestOf({ format, source: decoded.value }),
      { loadImporter, generateId: createCounterIdGenerator() },
    );
    const fromString = await handleImportRequest(
      requestOf({ format, source: SSMS_SCRIPT_SOURCE }),
      { loadImporter, generateId: createCounterIdGenerator() },
    );

    expect(fromFile.kind).toBe("success");
    if (fromFile.kind !== "success" || fromString.kind !== "success") return;
    expect(fromFile.diagnostics).toStrictEqual(
      SSMS_SCRIPT_EXPECTED_DIAGNOSTICS,
    );
    expect(fromFile.resultDocument).toStrictEqual(fromString.resultDocument);
  });
});
