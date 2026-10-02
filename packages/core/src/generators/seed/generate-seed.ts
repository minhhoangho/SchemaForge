import type { SchemaDocument } from "../../model/schema-document.js";
import type {
  GenerateResult,
  GeneratorOptions,
} from "../shared/generator-types.js";
import { SQL_DIALECTS } from "../shared/generator-types.js";
import { buildSeedDataset } from "./build-seed-dataset.js";
import { serializeSeedDataset } from "./serialize-seed-dataset.js";

export type SeedOptions = GeneratorOptions["seed"];

const SEED_FORMATS: ReadonlySet<string> = new Set([...SQL_DIALECTS, "json"]);

/** `buildSeedDataset`, then `serializeSeedDataset` (spec CG-08). */
export function generateSeed(
  schema: SchemaDocument,
  options: SeedOptions,
): GenerateResult {
  if (!SEED_FORMATS.has(options.format)) {
    throw new RangeError(`unknown seed format ${options.format}`);
  }
  const { dataset, diagnostics } = buildSeedDataset(schema, {
    rowsPerTable: options.rowsPerTable,
    seed: options.seed,
  });
  return {
    file: serializeSeedDataset(schema, dataset, options.format),
    diagnostics,
  };
}
