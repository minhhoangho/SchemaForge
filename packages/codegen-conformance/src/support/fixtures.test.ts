import { validateSchema } from "@schemaforge/core";
import type { SqlDialect } from "@schemaforge/core";
import { createTargetLimitSchema } from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { listConformanceFixtures, withDialectCustomTypes } from "./fixtures.js";

const DIALECTS: readonly SqlDialect[] = ["postgresql", "mysql", "sqlserver"];

const customColumnsOf = (schema: ReturnType<typeof createTargetLimitSchema>) =>
  Object.values(schema.columns).flatMap((column) =>
    column.type.kind === "custom"
      ? [{ typeName: column.type.name, defaultValue: column.defaultValue }]
      : [],
  );

describe("listConformanceFixtures", () => {
  it("lists the four fixtures in order", () => {
    expect(
      listConformanceFixtures().map((fixture) => fixture.name),
    ).toStrictEqual(["sample", "naming-edge", "target-limit", "empty"]);
  });
});

describe("withDialectCustomTypes", () => {
  it.each([
    ["postgresql", "inet"],
    ["mysql", "YEAR"],
    ["sqlserver", "money"],
  ] as const)(
    "replaces every custom type with the %s type",
    (dialect, typeName) => {
      const schema = withDialectCustomTypes(createTargetLimitSchema(), dialect);

      expect(
        new Set(customColumnsOf(schema).map((column) => column.typeName)),
      ).toStrictEqual(new Set([typeName]));
    },
  );

  it("replaces a custom literal default with the dialect literal", () => {
    const schema = withDialectCustomTypes(createTargetLimitSchema(), "mysql");

    expect(
      customColumnsOf(schema)
        .map((column) => column.defaultValue)
        .filter((defaultValue) => defaultValue !== null),
    ).toStrictEqual([{ kind: "literal", value: "2024" }]);
  });

  it("leaves the original fixture unchanged", () => {
    const original = createTargetLimitSchema();

    withDialectCustomTypes(original, "sqlserver");

    expect(original).toStrictEqual(createTargetLimitSchema());
  });

  it.each(
    DIALECTS.flatMap((dialect) =>
      listConformanceFixtures().map(
        (fixture) => [fixture.name, dialect, fixture.schema] as const,
      ),
    ),
  )(
    "returns a schema without semantic issues for %s on %s",
    (_name, dialect, schema) => {
      expect(
        validateSchema(withDialectCustomTypes(schema, dialect)),
      ).toStrictEqual([]);
    },
  );
});
