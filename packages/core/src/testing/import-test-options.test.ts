import { describe, expect, it } from "vitest";

import {
  createImportTestOptions,
  TEST_LAYOUT_METRICS,
} from "./import-test-options.js";

describe("createImportTestOptions", () => {
  it("uses the test fallback name and layout metrics", () => {
    const { fallbackSchemaName, layout } = createImportTestOptions();

    expect({ fallbackSchemaName, layout }).toStrictEqual({
      fallbackSchemaName: "Imported",
      layout: {
        tableWidth: 320,
        headerHeight: 40,
        columnRowHeight: 28,
        gap: 80,
      },
    });
    expect(layout).toBe(TEST_LAYOUT_METRICS);
  });

  it("starts a fresh id counter on every call", () => {
    createImportTestOptions().generateId();

    expect(createImportTestOptions().generateId()).toBe("1");
  });
});
