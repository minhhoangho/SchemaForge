import {
  createEmptySchema,
  type GenerateResult,
  type GeneratorTarget,
  type MarkdownLabels,
  type SchemaDocument,
} from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import { loadGenerator } from "./generator-registry";

const labels: MarkdownLabels = {
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
  indexNameHeader: "Name",
  indexColumnsHeader: "Columns",
  indexUniqueHeader: "Unique",
  yes: "yes",
  no: "no",
  primaryKey: "primary key",
  unique: "unique",
  autoIncrement: "auto increment",
  foreignKey: "foreign key",
  oneToOne: "one to one",
  oneToMany: "one to many",
  outgoingRelations: "References",
  incomingRelations: "Referenced by",
};

// A mapped type makes a new generator target fail to compile until it is here.
const runs: Readonly<
  Record<GeneratorTarget, (schema: SchemaDocument) => Promise<GenerateResult>>
> = {
  postgresql: async (s) => (await loadGenerator("postgresql"))(s, {}),
  mysql: async (s) => (await loadGenerator("mysql"))(s, {}),
  sqlserver: async (s) => (await loadGenerator("sqlserver"))(s, {}),
  prisma: async (s) =>
    (await loadGenerator("prisma"))(s, { provider: "postgresql" }),
  drizzle: async (s) =>
    (await loadGenerator("drizzle"))(s, { dialect: "postgresql" }),
  typescript: async (s) => (await loadGenerator("typescript"))(s, {}),
  zod: async (s) => (await loadGenerator("zod"))(s, {}),
  "mock-api": async (s) => (await loadGenerator("mock-api"))(s, {}),
  openapi: async (s) => (await loadGenerator("openapi"))(s, {}),
  seed: async (s) =>
    (await loadGenerator("seed"))(s, {
      format: "json",
      rowsPerTable: 1,
      seed: 1,
    }),
  dbml: async (s) => (await loadGenerator("dbml"))(s, {}),
  markdown: async (s) => (await loadGenerator("markdown"))(s, { labels }),
};

describe("loadGenerator", () => {
  it.each(Object.entries(runs))(
    "loads a generate function for %s",
    async (_target, run) => {
      const result = await run(createEmptySchema("Empty"));
      expect(typeof result.file.content).toBe("string");
    },
  );
});
