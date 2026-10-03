import {
  GENERATOR_DIAGNOSTIC_CODES,
  type MarkdownLabels,
} from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import { createI18nInstance } from "./create-i18n-instance";
import { RESOURCES } from "./resources";
import { SUPPORTED_LOCALES } from "./supported-locales";

// `resolveIssueTarget` supplies these; the diagnostics use no other variable.
const ALLOWED_VARIABLES: readonly string[] = [
  "table",
  "column",
  "index",
  "relation",
  "enum",
];
const INTERPOLATION_PATTERN = /{{\s*([^}]+?)\s*}}/g;

const DIAGNOSTIC_CASES = SUPPORTED_LOCALES.flatMap((locale) =>
  GENERATOR_DIAGNOSTIC_CODES.map((code) => [code, locale] as const),
);

const MARKDOWN_LABEL_KEYS: readonly (keyof MarkdownLabels)[] = [
  "enumsHeading",
  "tablesHeading",
  "indexesHeading",
  "relationsHeading",
  "columnNameHeader",
  "columnTypeHeader",
  "columnNullableHeader",
  "columnDefaultHeader",
  "columnConstraintsHeader",
  "columnCommentHeader",
  "indexNameHeader",
  "indexColumnsHeader",
  "indexUniqueHeader",
  "yes",
  "no",
  "primaryKey",
  "unique",
  "autoIncrement",
  "foreignKey",
  "oneToOne",
  "oneToMany",
  "outgoingRelations",
  "incomingRelations",
];

const MARKDOWN_CASES = SUPPORTED_LOCALES.flatMap((locale) =>
  MARKDOWN_LABEL_KEYS.map((key) => [key, locale] as const),
);

describe("generator messages", () => {
  it.each(DIAGNOSTIC_CASES)(
    "translates every generator diagnostic code in vi and en: %s in %s",
    (code, locale) => {
      const message = createI18nInstance(locale).t(
        `generatorDiagnostics:${code}`,
        { table: "users", column: "email" },
      );

      expect(message).toMatch(/\S/);
      expect(message).not.toContain("{{");
    },
  );

  it.each(SUPPORTED_LOCALES)(
    "renders null-character-removed for an enum path without empty quotes in %s",
    (locale) => {
      // An enum path resolves no table, so the message must not name one.
      const message = createI18nInstance(locale).t(
        "generatorDiagnostics:null-character-removed",
        { table: "", column: "" },
      );

      expect(message).not.toContain("“”");
      expect(message).not.toContain("{{");
    },
  );

  it("has no translation for the seed issue codes", () => {
    expect(Object.keys(RESOURCES.en.generatorDiagnostics)).not.toContain(
      "SeedIssue",
    );
  });

  it("uses only variables resolveIssueTarget provides", () => {
    const used = SUPPORTED_LOCALES.flatMap((locale) =>
      Object.values(RESOURCES[locale].generatorDiagnostics).flatMap((message) =>
        [...message.matchAll(INTERPOLATION_PATTERN)].map(
          (match) => match[1] ?? "",
        ),
      ),
    );

    expect(used.filter((name) => !ALLOWED_VARIABLES.includes(name))).toEqual(
      [],
    );
  });

  it.each(MARKDOWN_CASES)(
    "has every markdown label in vi and en: %s in %s",
    (key, locale) => {
      expect(RESOURCES[locale].codeGenerator.markdownLabels[key]).toMatch(/\S/);
    },
  );

  it("has exactly the markdown label keys core declares", () => {
    expect(
      Object.keys(RESOURCES.en.codeGenerator.markdownLabels).toSorted(),
    ).toEqual([...MARKDOWN_LABEL_KEYS].toSorted());
  });
});
