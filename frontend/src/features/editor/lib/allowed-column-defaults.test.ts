import type { ColumnDefault, ColumnType } from "@schemaforge/core";
import { validateSchema } from "@schemaforge/core";
import {
  buildSchema,
  makeColumn,
  makeEnum,
  makeTable,
} from "@schemaforge/core/testing";
import { describe, expect, it } from "vitest";

import { getAllowedColumnDefaults } from "./allowed-column-defaults";

const EVERY_COLUMN_TYPE: readonly ColumnType[] = [
  { kind: "smallint" },
  { kind: "integer" },
  { kind: "bigint" },
  { kind: "decimal", precision: 10, scale: 2 },
  { kind: "real" },
  { kind: "double" },
  { kind: "boolean" },
  { kind: "char", length: 2 },
  { kind: "varchar", length: 255 },
  { kind: "text" },
  { kind: "uuid" },
  { kind: "date" },
  { kind: "time" },
  { kind: "timestamp" },
  { kind: "timestamptz" },
  { kind: "json" },
  { kind: "binary" },
  { kind: "enum", enumId: "enum_status" },
  { kind: "custom", name: "citext" },
];

function typeOfKind(kind: ColumnType["kind"]): ColumnType {
  const type = EVERY_COLUMN_TYPE.find((candidate) => candidate.kind === kind);
  if (type === undefined) {
    throw new Error(`No sample column type of kind ${kind}`);
  }
  return type;
}

const EVERY_DEFAULT: readonly ColumnDefault[] = [
  { kind: "literal", value: "1" },
  { kind: "currentTimestamp" },
  { kind: "generateUuid" },
];

// A default kind is allowed exactly when core reports no
// `column-default-incompatible` issue for it.
function isAllowedByCore(
  type: ColumnType,
  defaultValue: ColumnDefault,
): boolean {
  const document = buildSchema({
    tables: [makeTable({ id: "tbl_users" })],
    columns: [
      makeColumn({ id: "col_value", tableId: "tbl_users", type, defaultValue }),
    ],
    enums: [makeEnum({ id: "enum_status" })],
  });
  return validateSchema(document).every(
    (issue) => issue.code !== "column-default-incompatible",
  );
}

describe("getAllowedColumnDefaults", () => {
  it.each([
    [
      "literal and currentTimestamp",
      "timestamp",
      ["literal", "currentTimestamp"],
    ],
    [
      "literal and currentTimestamp",
      "timestamptz",
      ["literal", "currentTimestamp"],
    ],
    ["literal and generateUuid", "uuid", ["literal", "generateUuid"]],
    ["only literal", "varchar", ["literal"]],
    ["no default", "binary", []],
  ] as const)("allows %s for a %s column", (_allowed, kind, expected) => {
    expect(getAllowedColumnDefaults(typeOfKind(kind))).toEqual(expected);
  });

  it("never allows a literal default on a binary column", () => {
    expect(getAllowedColumnDefaults({ kind: "binary" })).toEqual([]);
  });

  it("matches the core rule for every column kind", () => {
    const fromCore = EVERY_COLUMN_TYPE.map((type) => ({
      kind: type.kind,
      defaults: EVERY_DEFAULT.filter((defaultValue) =>
        isAllowedByCore(type, defaultValue),
      ).map((defaultValue) => defaultValue.kind),
    }));
    const fromPanel = EVERY_COLUMN_TYPE.map((type) => ({
      kind: type.kind,
      defaults: getAllowedColumnDefaults(type),
    }));

    expect(fromPanel).toEqual(fromCore);
  });
});
