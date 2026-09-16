import { ERROR_CODES, ISSUE_CODES } from "@schemaforge/core";
import { describe, expect, it } from "vitest";

import { createI18nInstance } from "./create-i18n-instance";
import { RESOURCES } from "./resources";
import { SUPPORTED_LOCALES } from "./supported-locales";

// The five names spec section 4 allows in an issue or error message.
const DOCUMENTED_VARIABLES: readonly string[] = [
  "table",
  "column",
  "index",
  "enum",
  "value",
];

const INTERPOLATION_PATTERN = /{{\s*([^}]+?)\s*}}/g;

function readInterpolationVariables(message: string): readonly string[] {
  return [...message.matchAll(INTERPOLATION_PATTERN)]
    .map((match) => match[1] ?? "")
    .toSorted();
}

const ISSUE_CASES = SUPPORTED_LOCALES.flatMap((locale) =>
  ISSUE_CODES.map((code) => [code, locale] as const),
);

const ERROR_CASES = SUPPORTED_LOCALES.flatMap((locale) =>
  ERROR_CODES.map((code) => [code, locale] as const),
);

const ALL_MESSAGES = SUPPORTED_LOCALES.flatMap((locale) => [
  ...Object.values(RESOURCES[locale].issues),
  ...Object.values(RESOURCES[locale].errors.codes),
  RESOURCES[locale].errors.operationNotApplied,
]);

const USED_VARIABLES = [
  ...new Set(ALL_MESSAGES.flatMap(readInterpolationVariables)),
].toSorted();

const SAMPLE_VARIABLES = {
  table: "users",
  column: "created_at",
  index: "users_email_idx",
  enum: "order_status",
  value: "paid",
};

const TRANSLATED_ISSUE_CASES = [
  ["table-name-duplicate", SAMPLE_VARIABLES.table],
  ["column-primary-key-nullable", SAMPLE_VARIABLES.column],
  ["enum-value-duplicate", SAMPLE_VARIABLES.value],
] as const;

describe("issue and error messages", () => {
  it.each(ISSUE_CASES)(
    "has a non-empty issue message for %s in %s",
    (code, locale) => {
      expect(RESOURCES[locale].issues[code]).toMatch(/\S/);
    },
  );

  it.each(ERROR_CASES)(
    "has a non-empty error message for %s in %s",
    (code, locale) => {
      expect(RESOURCES[locale].errors.codes[code]).toMatch(/\S/);
    },
  );

  it.each(SUPPORTED_LOCALES)(
    "has an operationNotApplied message in %s",
    (locale) => {
      expect(RESOURCES[locale].errors.operationNotApplied).toMatch(/\S/);
    },
  );

  it("uses only the documented interpolation variables", () => {
    const undocumented = USED_VARIABLES.filter(
      (name) => !DOCUMENTED_VARIABLES.includes(name),
    );

    expect(undocumented).toEqual([]);
  });

  it.each(ISSUE_CODES)(
    "uses the same interpolation variables in vi and en for %s",
    (code) => {
      expect(readInterpolationVariables(RESOURCES.vi.issues[code])).toEqual(
        readInterpolationVariables(RESOURCES.en.issues[code]),
      );
    },
  );

  it.each(TRANSLATED_ISSUE_CASES)(
    "translates issue %s through createI18nInstance",
    (code, expected) => {
      const message = createI18nInstance("en").t(
        `issues:${code}`,
        SAMPLE_VARIABLES,
      );

      expect(message).toContain(expected);
      expect(message).not.toContain("{{");
    },
  );
});
