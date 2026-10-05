import type { MarkdownLabels, SqlDialect } from "@schemaforge/core";

import { toGeneratorRequest } from "../code-generator/generator-request";
import type {
  CodeOptions,
  DrizzleDialect,
  GeneratorRequest,
} from "../code-generator/generator-request";

// Spec section 11, "Hộp thoại Tải ZIP". A null provider, dialect or format
// means the item is not selected.
/* eslint-disable @typescript-eslint/naming-convention -- the plan (Task 31) fixes these property names; the spec table names the items, not flags. */
export type ZipSelection = {
  readonly json: boolean;
  readonly png: boolean;
  readonly svg: boolean;
  readonly sql: readonly SqlDialect[];
  readonly prisma: SqlDialect | null;
  readonly drizzle: DrizzleDialect | null;
  readonly typescript: boolean;
  readonly zod: boolean;
  readonly mockApi: boolean;
  readonly openapi: boolean;
  readonly seed: SqlDialect | "json" | null;
  readonly dbml: boolean;
  readonly markdown: boolean;
};
/* eslint-enable @typescript-eslint/naming-convention -- end of the plan-fixed names. */

export const DEFAULT_ZIP_SELECTION: ZipSelection = {
  json: true,
  png: false,
  svg: false,
  sql: [],
  prisma: null,
  drizzle: null,
  typescript: false,
  zod: false,
  mockApi: false,
  openapi: false,
  seed: null,
  dbml: false,
  markdown: false,
};

// A freshly selected provider, dialect or format follows the code panel's
// choice, so "select all" agrees with what the panel shows.
export function selectAllZip(codeOptions: CodeOptions): ZipSelection {
  return {
    json: true,
    png: true,
    svg: true,
    sql: ["postgresql", "mysql", "sqlserver"],
    prisma: codeOptions.prismaProvider,
    drizzle: codeOptions.drizzleDialect,
    typescript: true,
    zod: true,
    mockApi: true,
    openapi: true,
    seed: codeOptions.seedFormat,
    dbml: true,
    markdown: true,
  };
}

export function clearZip(): ZipSelection {
  return { ...DEFAULT_ZIP_SELECTION, json: false };
}

// Requests come out in the order of the dialog's groups.
export function toZipGeneratorRequests(
  selection: ZipSelection,
  codeOptions: CodeOptions,
  markdownLabels: MarkdownLabels,
): readonly GeneratorRequest[] {
  const requests: GeneratorRequest[] = selection.sql.map((target) => ({
    target,
    options: {},
  }));
  if (selection.prisma !== null) {
    requests.push(
      toGeneratorRequest(
        "prisma",
        { ...codeOptions, prismaProvider: selection.prisma },
        markdownLabels,
      ),
    );
  }
  if (selection.drizzle !== null) {
    requests.push(
      toGeneratorRequest(
        "drizzle",
        { ...codeOptions, drizzleDialect: selection.drizzle },
        markdownLabels,
      ),
    );
  }
  const plainTargets = [
    ["typescript", selection.typescript],
    ["zod", selection.zod],
    ["mock-api", selection.mockApi],
    ["openapi", selection.openapi],
  ] as const;
  for (const [target, isSelected] of plainTargets) {
    if (isSelected) {
      requests.push(toGeneratorRequest(target, codeOptions, markdownLabels));
    }
  }
  if (selection.seed !== null) {
    requests.push(
      toGeneratorRequest(
        "seed",
        { ...codeOptions, seedFormat: selection.seed },
        markdownLabels,
      ),
    );
  }
  if (selection.dbml) {
    requests.push(toGeneratorRequest("dbml", codeOptions, markdownLabels));
  }
  if (selection.markdown) {
    requests.push(toGeneratorRequest("markdown", codeOptions, markdownLabels));
  }
  return requests;
}

export function countZipFiles(selection: ZipSelection): number {
  const flags = [
    selection.json,
    selection.png,
    selection.svg,
    selection.prisma !== null,
    selection.drizzle !== null,
    selection.typescript,
    selection.zod,
    selection.mockApi,
    selection.openapi,
    selection.seed !== null,
    selection.dbml,
    selection.markdown,
  ];
  return selection.sql.length + flags.filter(Boolean).length;
}
