import type { ImportDiagnostic, SchemaDocument } from "@schemaforge/core";
import { buildSchema, makeColumn, makeTable } from "@schemaforge/core/testing";
import { vi } from "vitest";

import type {
  ImportOutcome,
  ImporterClient,
} from "@/lib/import-export/importer-client";
import type { ImportRequest } from "@/lib/import-export/import-protocol";

export const IMPORTED_DOCUMENT: SchemaDocument = buildSchema({
  name: "Shop",
  tables: [makeTable({ id: "tbl_users", name: "users" })],
  columns: [makeColumn({ id: "col_users_id", tableId: "tbl_users" })],
});

type SuccessOutcome = Extract<ImportOutcome, { kind: "success" }>;

export function successOutcome(
  overrides: Partial<SuccessOutcome> = {},
): SuccessOutcome {
  return {
    requestId: 1,
    kind: "success",
    operation: { type: "batch", operations: [] },
    resultDocument: IMPORTED_DOCUMENT,
    summary: {
      tables: 1,
      columns: 1,
      relations: 0,
      indexes: 0,
      enums: 0,
      subjectAreas: 0,
      notes: 0,
    },
    diagnostics: [],
    introducedIssues: [],
    ...overrides,
  };
}

export function syntaxError(line: number, column: number): ImportDiagnostic {
  return { code: "syntax-error", location: { line, column }, path: null };
}

export type FakeImporterClient = ImporterClient & {
  readonly requests: Omit<ImportRequest, "requestId">[];
  // Resolves the run that is waiting.
  readonly settle: (outcome: ImportOutcome) => void;
};

/** The worker is the boundary: this client resolves only when a test says so. */
export function createFakeImporterClient(): FakeImporterClient {
  const requests: Omit<ImportRequest, "requestId">[] = [];
  let resolveRun: ((outcome: ImportOutcome) => void) | null = null;
  const settle = (outcome: ImportOutcome): void => {
    resolveRun?.(outcome);
    resolveRun = null;
  };
  return {
    requests,
    settle,
    prepare: vi.fn(),
    run: vi.fn((request: Omit<ImportRequest, "requestId">) => {
      requests.push(request);
      return new Promise<ImportOutcome>((resolve) => {
        resolveRun = resolve;
      });
    }),
    cancel: vi.fn(() => {
      settle({ kind: "cancelled" });
    }),
    dispose: vi.fn(() => {
      settle({ kind: "cancelled" });
    }),
  };
}
