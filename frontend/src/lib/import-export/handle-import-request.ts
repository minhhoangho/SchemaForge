import {
  applyOperation,
  buildImportOperation,
  createEmptySchema,
  finalizeImportDiagnostics,
  findIntroducedIssues,
  type GenerateId,
  type SchemaDocument,
} from "@schemaforge/core";

import type { loadImporter } from "./importer-loaders";
import type {
  ImportRequest,
  ImportResponse,
  ImportSummary,
} from "./import-protocol";

export type ImportDependencies = {
  readonly loadImporter: typeof loadImporter;
  readonly generateId: GenerateId;
};

function summarize(document: SchemaDocument): ImportSummary {
  return {
    tables: Object.keys(document.tables).length,
    columns: Object.keys(document.columns).length,
    relations: Object.keys(document.relations).length,
    indexes: Object.keys(document.indexes).length,
    enums: Object.keys(document.enums).length,
    subjectAreas: Object.keys(document.subjectAreas).length,
    notes: Object.keys(document.notes).length,
  };
}

/**
 * Runs one import. Never logs the source: it is the user's file.
 * Throws only on programmer errors; the worker turns those into `crashed`.
 */
export async function handleImportRequest(
  request: ImportRequest,
  dependencies: ImportDependencies,
): Promise<ImportResponse> {
  const { requestId } = request;
  const importer = await dependencies.loadImporter(request.format);
  const result = importer(request.source, {
    fallbackSchemaName: request.fallbackSchemaName,
    generateId: dependencies.generateId,
    layout: request.layout,
  });
  if (!result.isOk) {
    return {
      requestId,
      kind: "failure",
      diagnostics: result.error.diagnostics,
    };
  }
  const imported = result.value.document;
  // In "new" mode the name comes from the source, not from the fallback.
  const target = request.target ?? createEmptySchema(imported.name);
  if (request.mode.mode === "merge" && request.target === null) {
    return { requestId, kind: "crashed" };
  }
  const build = buildImportOperation(
    target,
    imported,
    request.mode,
    dependencies.generateId,
  );
  const applied = applyOperation(target, build.operation);
  if (!applied.isOk) {
    return { requestId, kind: "crashed" };
  }
  const resultDocument = applied.value.schema;
  return {
    requestId,
    kind: "success",
    operation: build.operation,
    resultDocument,
    summary: summarize(imported),
    diagnostics: finalizeImportDiagnostics([
      ...result.value.diagnostics,
      ...build.diagnostics,
    ]),
    introducedIssues: findIntroducedIssues(target, resultDocument),
  };
}
