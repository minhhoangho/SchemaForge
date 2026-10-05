import { describe, expect, it } from "vitest";

import { enCodeGenerator } from "@/lib/i18n/locales/en/code-generator";

import { DEFAULT_CODE_OPTIONS } from "../code-generator/generator-request";
import {
  clearZip,
  countZipFiles,
  DEFAULT_ZIP_SELECTION,
  selectAllZip,
  toZipGeneratorRequests,
} from "./zip-selection";

const LABELS = enCodeGenerator.markdownLabels;

describe("zip selection", () => {
  it("selects only json by default", () => {
    expect(DEFAULT_ZIP_SELECTION.json).toBe(true);
    expect(countZipFiles(DEFAULT_ZIP_SELECTION)).toBe(1);
    expect(
      toZipGeneratorRequests(
        DEFAULT_ZIP_SELECTION,
        DEFAULT_CODE_OPTIONS,
        LABELS,
      ),
    ).toStrictEqual([]);
  });

  it("selects and clears every item", () => {
    expect(countZipFiles(selectAllZip(DEFAULT_CODE_OPTIONS))).toBe(15);
    expect(countZipFiles(clearZip())).toBe(0);
  });

  it("maps a selection to generator requests with code panel seed options", () => {
    const requests = toZipGeneratorRequests(
      {
        ...clearZip(),
        sql: ["mysql"],
        prisma: "sqlserver",
        drizzle: "mysql",
        zod: true,
        seed: "json",
        markdown: true,
      },
      { ...DEFAULT_CODE_OPTIONS, seedRowsPerTable: 25, seedSeed: 9 },
      LABELS,
    );
    expect(requests).toStrictEqual([
      { target: "mysql", options: {} },
      { target: "prisma", options: { provider: "sqlserver" } },
      { target: "drizzle", options: { dialect: "mysql" } },
      { target: "zod", options: {} },
      {
        target: "seed",
        options: { format: "json", rowsPerTable: 25, seed: 9 },
      },
      { target: "markdown", options: { labels: LABELS } },
    ]);
  });

  it("counts the files of a selection", () => {
    expect(
      countZipFiles({
        ...clearZip(),
        png: true,
        sql: ["postgresql", "mysql"],
        dbml: true,
      }),
    ).toBe(4);
  });
});
