import type {
  ImportOptions,
  LayoutMetrics,
} from "../importers/shared/import-types.js";
import { createCounterIdGenerator } from "./factories.js";

export const TEST_LAYOUT_METRICS: LayoutMetrics = {
  tableWidth: 320,
  headerHeight: 40,
  columnRowHeight: 28,
  gap: 80,
};

/** Options for importer tests, with a fresh counter id generator per call. */
export function createImportTestOptions(): ImportOptions {
  return {
    fallbackSchemaName: "Imported",
    generateId: createCounterIdGenerator(),
    layout: TEST_LAYOUT_METRICS,
  };
}
