import type {
  GeneratorOptions,
  GeneratorTarget,
  MarkdownLabels,
  SqlDialect,
} from "@schemaforge/core";

export const CODE_TARGETS = [
  "sql",
  "prisma",
  "drizzle",
  "typescript",
  "zod",
  "mock-api",
  "openapi",
  "seed",
  "dbml",
  "markdown",
] as const;

export type CodeTarget = (typeof CODE_TARGETS)[number];

export type DrizzleDialect = GeneratorOptions["drizzle"]["dialect"];

export type CodeOptions = {
  readonly sqlDialect: SqlDialect;
  readonly prismaProvider: SqlDialect;
  readonly drizzleDialect: DrizzleDialect;
  readonly seedFormat: SqlDialect | "json";
  readonly seedRowsPerTable: number;
  readonly seedSeed: number;
};

export const DEFAULT_CODE_OPTIONS: CodeOptions = {
  sqlDialect: "postgresql",
  prismaProvider: "postgresql",
  drizzleDialect: "postgresql",
  seedFormat: "postgresql",
  seedRowsPerTable: 10,
  seedSeed: 1,
};

// Core throws outside these ranges, so the inputs clamp to them.
export const MIN_ROWS_PER_TABLE = 1;
export const MAX_ROWS_PER_TABLE = 1000;
export const MIN_SEED = 0;
export const MAX_SEED = 0xffffffff;

export type GeneratorRequest = {
  readonly target: GeneratorTarget;
  readonly options: GeneratorOptions[GeneratorTarget];
};

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function clampSeedRowsPerTable(value: number): number {
  return clamp(value, MIN_ROWS_PER_TABLE, MAX_ROWS_PER_TABLE);
}

export function clampSeed(value: number): number {
  return clamp(value, MIN_SEED, MAX_SEED);
}

export function toGeneratorRequest(
  target: CodeTarget,
  options: CodeOptions,
  markdownLabels: MarkdownLabels,
): GeneratorRequest {
  switch (target) {
    case "sql":
      return { target: options.sqlDialect, options: {} };
    case "prisma":
      return {
        target: "prisma",
        options: { provider: options.prismaProvider },
      };
    case "drizzle":
      return {
        target: "drizzle",
        options: { dialect: options.drizzleDialect },
      };
    case "seed":
      return {
        target: "seed",
        options: {
          format: options.seedFormat,
          rowsPerTable: clampSeedRowsPerTable(options.seedRowsPerTable),
          seed: clampSeed(options.seedSeed),
        },
      };
    case "markdown":
      return { target: "markdown", options: { labels: markdownLabels } };
    case "typescript":
    case "zod":
    case "mock-api":
    case "openapi":
    case "dbml":
      return { target, options: {} };
    default: {
      const unreachable: never = target;
      return unreachable;
    }
  }
}
