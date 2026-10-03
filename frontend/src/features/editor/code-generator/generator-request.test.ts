import type { MarkdownLabels } from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import {
  clampSeed,
  clampSeedRowsPerTable,
  DEFAULT_CODE_OPTIONS,
  toGeneratorRequest,
} from "./generator-request";
import type { CodeOptions, CodeTarget } from "./generator-request";

const LABELS: MarkdownLabels = {
  enumsHeading: "Enums",
  tablesHeading: "Tables",
  indexesHeading: "Indexes",
  relationsHeading: "Relations",
  columnNameHeader: "Name",
  columnTypeHeader: "Type",
  columnNullableHeader: "Nullable",
  columnDefaultHeader: "Default",
  columnConstraintsHeader: "Constraints",
  columnCommentHeader: "Comment",
  indexNameHeader: "Index",
  indexColumnsHeader: "Columns",
  indexUniqueHeader: "Unique",
  yes: "Yes",
  no: "No",
  primaryKey: "PK",
  unique: "Unique",
  autoIncrement: "Auto increment",
  foreignKey: "FK",
  oneToOne: "1:1",
  oneToMany: "1:N",
  outgoingRelations: "Outgoing",
  incomingRelations: "Incoming",
};

const OPTIONS: CodeOptions = {
  sqlDialect: "mysql",
  prismaProvider: "sqlserver",
  drizzleDialect: "mysql",
  seedFormat: "json",
  seedRowsPerTable: 25,
  seedSeed: 7,
};

const CASES: readonly (readonly [CodeTarget, unknown])[] = [
  ["sql", { target: "mysql", options: {} }],
  ["prisma", { target: "prisma", options: { provider: "sqlserver" } }],
  ["drizzle", { target: "drizzle", options: { dialect: "mysql" } }],
  ["typescript", { target: "typescript", options: {} }],
  ["zod", { target: "zod", options: {} }],
  ["mock-api", { target: "mock-api", options: {} }],
  ["openapi", { target: "openapi", options: {} }],
  [
    "seed",
    {
      target: "seed",
      options: { format: "json", rowsPerTable: 25, seed: 7 },
    },
  ],
  ["dbml", { target: "dbml", options: {} }],
  ["markdown", { target: "markdown", options: { labels: LABELS } }],
];

describe("toGeneratorRequest", () => {
  it.each(CASES)(
    "maps every code target and option to a generator request: %s",
    (target, expected) => {
      expect(toGeneratorRequest(target, OPTIONS, LABELS)).toEqual(expected);
    },
  );

  it("passes markdown labels", () => {
    const request = toGeneratorRequest(
      "markdown",
      DEFAULT_CODE_OPTIONS,
      LABELS,
    );

    expect(request.options).toEqual({ labels: LABELS });
  });

  it("clamps rows per table and seed", () => {
    expect(clampSeedRowsPerTable(0)).toBe(1);
    expect(clampSeedRowsPerTable(5000)).toBe(1000);
    expect(clampSeedRowsPerTable(12.9)).toBe(12);
    expect(clampSeedRowsPerTable(Number.NaN)).toBe(1);
    expect(clampSeed(-3)).toBe(0);
    expect(clampSeed(2 ** 40)).toBe(0xffffffff);
  });

  it("clamps out-of-range seed options inside the request", () => {
    const request = toGeneratorRequest(
      "seed",
      { ...OPTIONS, seedRowsPerTable: 0, seedSeed: -1 },
      LABELS,
    );

    expect(request.options).toMatchObject({ rowsPerTable: 1, seed: 0 });
  });
});
