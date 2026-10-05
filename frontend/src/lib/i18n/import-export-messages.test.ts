import { IMPORT_DIAGNOSTIC_CODES } from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import { createI18nInstance } from "./create-i18n-instance";
import { RESOURCES } from "./resources";
import { SUPPORTED_LOCALES } from "./supported-locales";

const DIAGNOSTIC_CASES = SUPPORTED_LOCALES.flatMap((locale) =>
  IMPORT_DIAGNOSTIC_CODES.map((code) => [code, locale] as const),
);

type Tree = { readonly [key: string]: string | Tree };

function listKeys(tree: Tree, prefix: string): readonly string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string"
      ? [`${prefix}${key}`]
      : listKeys(value, `${prefix}${key}.`),
  );
}

describe("import and export messages", () => {
  it.each(DIAGNOSTIC_CASES)(
    "translates every import diagnostic code in vi and en: %s in %s",
    (code, locale) => {
      const message = createI18nInstance(locale).t(`importDiagnostics:${code}`);

      expect(message).toMatch(/\S/);
      expect(message).not.toContain("{{");
    },
  );

  it("has exactly one importDiagnostics key per code", () => {
    expect(Object.keys(RESOURCES.en.importDiagnostics).toSorted()).toEqual(
      [...IMPORT_DIAGNOSTIC_CODES].toSorted(),
    );
  });

  it("has the same import and export keys in vi and en", () => {
    expect(listKeys(RESOURCES.vi.importExport, "").toSorted()).toEqual(
      listKeys(RESOURCES.en.importExport, "").toSorted(),
    );
    expect(listKeys(RESOURCES.vi.importDiagnostics, "").toSorted()).toEqual(
      listKeys(RESOURCES.en.importDiagnostics, "").toSorted(),
    );
  });

  it("formats the source location in vi and en", () => {
    const values = { line: 12, column: 5 };

    expect(createI18nInstance("en").t("importExport:location", values)).toBe(
      "Line 12, column 5",
    );
    expect(createI18nInstance("vi").t("importExport:location", values)).toBe(
      "Dòng 12, cột 5",
    );
  });

  it("pluralizes the import result in en", () => {
    const t = createI18nInstance("en").t;

    expect(t("importExport:import.done", { count: 1 })).toBe(
      "Imported 1 table",
    );
    expect(t("importExport:import.done", { count: 12 })).toBe(
      "Imported 12 tables",
    );
  });
});
