import { API_ERROR_CODES } from "@schemaforge/api-contract";
import { describe, expect, it } from "vitest";

import { STORAGE_ERROR_CODES } from "@/lib/storage/storage-error";

import { NAMESPACES, RESOURCES } from "./resources";
import type { Locale } from "./supported-locales";
import { SUPPORTED_LOCALES } from "./supported-locales";

const CLIENT_FAILURE_KINDS = [
  "network",
  "timeout",
  "invalid-response",
] as const;

type TranslationTree = { readonly [key: string]: string | TranslationTree };

type TranslationEntry = readonly [key: string, value: string];

const KEY_SEPARATOR = ".";
const INTERPOLATION_PATTERN = /{{\s*([^}]+?)\s*}}/g;

function flattenTranslations(
  tree: TranslationTree,
  prefix: string,
): readonly TranslationEntry[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix === "" ? key : `${prefix}${KEY_SEPARATOR}${key}`;
    return typeof value === "string"
      ? [[path, value] as const]
      : flattenTranslations(value, path);
  });
}

function readInterpolationVariables(
  value: string | undefined,
): readonly string[] {
  return [...(value ?? "").matchAll(INTERPOLATION_PATTERN)]
    .map((match) => match[1] ?? "")
    .toSorted();
}

const FLAT_RESOURCES: Record<Locale, ReadonlyMap<string, string>> = {
  en: new Map(flattenTranslations(RESOURCES.en, "")),
  vi: new Map(flattenTranslations(RESOURCES.vi, "")),
};

const EN_KEYS = [...FLAT_RESOURCES.en.keys()].toSorted();

const TRANSLATION_CASES = SUPPORTED_LOCALES.flatMap((locale) =>
  EN_KEYS.map((key) => [locale, key] as const),
);

describe("RESOURCES", () => {
  it("has the same keys in vi and en", () => {
    expect([...FLAT_RESOURCES.vi.keys()].toSorted()).toEqual(EN_KEYS);
  });

  it.each(TRANSLATION_CASES)(
    "has a non-empty %s translation for %s",
    (locale, key) => {
      expect(FLAT_RESOURCES[locale].get(key)).toMatch(/\S/);
    },
  );

  it.each(EN_KEYS)(
    "uses the same interpolation variables in vi and en for %s",
    (key) => {
      expect(readInterpolationVariables(FLAT_RESOURCES.vi.get(key))).toEqual(
        readInterpolationVariables(FLAT_RESOURCES.en.get(key)),
      );
    },
  );

  it("has one storage message per storage error code", () => {
    expect(Object.keys(RESOURCES.en.storage).toSorted()).toEqual(
      [...STORAGE_ERROR_CODES].toSorted(),
    );
  });

  it("has one apiErrors message per API error code plus client failure kinds", () => {
    expect(Object.keys(RESOURCES.en.apiErrors).toSorted()).toEqual(
      [...API_ERROR_CODES, ...CLIENT_FAILURE_KINDS].toSorted(),
    );
  });

  it("registers the auth, sync and apiErrors namespaces", () => {
    expect(NAMESPACES).toContain("auth");
    expect(NAMESPACES).toContain("sync");
    expect(NAMESPACES).toContain("apiErrors");
  });
});
