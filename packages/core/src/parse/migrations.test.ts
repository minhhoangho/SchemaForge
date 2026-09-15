import { describe, expect, it } from "vitest";

import { CURRENT_SCHEMA_VERSION } from "../model/schema-document.js";

import type { MigrationStep } from "./migrations.js";
import { MIGRATION_STEPS, migrateDocument } from "./migrations.js";

const addedByStepOneToTwo: MigrationStep = (document) => ({
  ...document,
  addedByStepOneToTwo: true,
});

const addedByStepTwoToThree: MigrationStep = (document) => ({
  ...document,
  addedByStepTwoToThree: true,
});

describe("MIGRATION_STEPS", () => {
  it("has one step for every version before the current version", () => {
    expect(MIGRATION_STEPS.length).toBe(CURRENT_SCHEMA_VERSION - 1);
  });
});

describe("migrateDocument", () => {
  it("returns the document unchanged when no step applies", () => {
    const document = { version: 1, name: "Blog" };

    expect(migrateDocument(document, 1, [])).toStrictEqual(document);
  });

  it("applies steps in order starting from the document version", () => {
    const document = { version: 2, name: "Blog" };

    expect(
      migrateDocument(document, 2, [
        addedByStepOneToTwo,
        addedByStepTwoToThree,
      ]),
    ).toStrictEqual({ version: 3, name: "Blog", addedByStepTwoToThree: true });
  });

  it("writes the next version after each step", () => {
    const identityStep: MigrationStep = (document) => document;
    const document = { version: 1, name: "Blog" };

    expect(
      migrateDocument(document, 1, [identityStep, identityStep]).version,
    ).toBe(3);
  });
});
