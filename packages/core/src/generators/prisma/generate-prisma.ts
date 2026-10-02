import { sortEnums, sortTables } from "../../model/ordering.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { finalizeDiagnostics } from "../shared/diagnostics.js";
import type {
  GenerateResult,
  GeneratorOptions,
} from "../shared/generator-types.js";
import { SQL_DIALECTS } from "../shared/generator-types.js";
import { renderFileContent } from "../shared/render-file.js";
import { createPrismaContext } from "./prisma-context.js";
import { formatPrismaString } from "./prisma-field-type.js";
import { renderPrismaEnum, renderPrismaModel } from "./prisma-model.js";

export type PrismaOptions = GeneratorOptions["prisma"];

// Prisma 7 reads the database URL from prisma.config.ts, so the datasource
// has no `url` (spec CG-02).
const GENERATOR_BLOCK: readonly string[] = [
  "generator client {",
  '  provider = "prisma-client"',
  '  output = "../src/generated/prisma"',
  "}",
];

/** `schema.prisma` for Prisma 7 with the given provider (spec CG-02). */
export function generatePrisma(
  schema: SchemaDocument,
  options: PrismaOptions,
): GenerateResult {
  const { provider } = options;
  if (!SQL_DIALECTS.includes(provider)) {
    throw new RangeError(`Unknown Prisma provider: ${provider}`);
  }
  const context = createPrismaContext(schema, provider);
  // SQL Server has no enums; its enum columns are strings.
  const enums =
    provider === "sqlserver"
      ? []
      : sortEnums(schema).map((element) =>
          renderPrismaEnum(context.value, element),
        );
  const models = sortTables(schema).map((table) =>
    renderPrismaModel(context.value, table),
  );
  const content = renderFileContent([
    GENERATOR_BLOCK,
    ["datasource db {", `  provider = ${formatPrismaString(provider)}`, "}"],
    ...enums,
    ...models.map((model) => model.value),
  ]);
  return {
    file: { fileName: "schema.prisma", language: "prisma", content },
    diagnostics: finalizeDiagnostics([
      ...context.diagnostics,
      ...models.flatMap((model) => model.diagnostics),
    ]),
  };
}
