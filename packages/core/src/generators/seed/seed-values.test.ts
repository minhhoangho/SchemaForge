import { describe, expect, it } from "vitest";

import type { Column } from "../../model/column.js";
import type { ColumnType } from "../../model/column-type.js";
import { makeColumn, makeEnum } from "../../testing/factories.js";
import { isValidJsonValue } from "../shared/json-representation.js";
import { createSeedRandom } from "./seed-random.js";
import { findFixedSeedValue, generateColumnValue } from "./seed-values.js";

const ENUMS = {
  enum_status: makeEnum({ id: "enum_status", values: ["active", "closed"] }),
  enum_empty: makeEnum({ id: "enum_empty", values: [] }),
};

// Counted once with seed state 1; any change to the draw order changes it.
const NULL_COUNT_FOR_STATE_1 = 194;

function column(overrides: Partial<Column> = {}): Column {
  return makeColumn({ id: "col_status", tableId: "tbl_a", ...overrides });
}

type GenerateOverrides = {
  readonly sequence?: number;
  readonly isKeyColumn?: boolean;
  readonly isPrimaryKeyColumn?: boolean;
  readonly state?: number;
};

function generate(
  target: Column,
  overrides: GenerateOverrides = {},
): ReturnType<typeof generateColumnValue> {
  return generateColumnValue({
    column: target,
    enums: ENUMS,
    random: createSeedRandom(overrides.state ?? 1),
    sequence: overrides.sequence ?? 1,
    isKeyColumn: overrides.isKeyColumn ?? false,
    isPrimaryKeyColumn: overrides.isPrimaryKeyColumn ?? false,
  });
}

const NON_CUSTOM_TYPES: readonly ColumnType[] = [
  { kind: "smallint" },
  { kind: "integer" },
  { kind: "bigint" },
  { kind: "decimal", precision: 10, scale: 2 },
  { kind: "real" },
  { kind: "double" },
  { kind: "boolean" },
  { kind: "char", length: 4 },
  { kind: "varchar", length: 40 },
  { kind: "text" },
  { kind: "uuid" },
  { kind: "date" },
  { kind: "time" },
  { kind: "timestamp" },
  { kind: "timestamptz" },
  { kind: "json" },
  { kind: "binary" },
  { kind: "enum", enumId: "enum_status" },
];

function valueOf(result: ReturnType<typeof generateColumnValue>): unknown {
  return result.kind === "value" ? result.value : result.kind;
}

describe("generateColumnValue", () => {
  it.each(NON_CUSTOM_TYPES)(
    "generates a value accepted by isValidJsonValue for type %j",
    (type) => {
      const result = generate(column({ type }), { sequence: 7 });
      expect(
        result.kind === "value" && isValidJsonValue(type, result.value, ENUMS),
      ).toBe(true);
    },
  );

  it.each<ColumnType>([
    { kind: "decimal", precision: 4, scale: 4 },
    { kind: "decimal", precision: 3, scale: 5 },
    { kind: "decimal", precision: 30, scale: 0 },
  ])("generates a valid value for decimal edge %j", (type) => {
    const result = generate(column({ type }));
    expect(
      result.kind === "value" && isValidJsonValue(type, result.value, ENUMS),
    ).toBe(true);
  });

  it.each<[ColumnType, Partial<Column>, GenerateOverrides, unknown]>([
    [{ kind: "integer" }, {}, { isPrimaryKeyColumn: true, sequence: 1 }, 1],
    [{ kind: "bigint" }, {}, { isPrimaryKeyColumn: true, sequence: 2 }, "2"],
    [{ kind: "smallint" }, { isAutoIncrement: true }, { sequence: 3 }, 3],
  ])(
    "numbers auto-increment and integer primary key columns by sequence (%j)",
    (type, overrides, options, expected) => {
      expect(valueOf(generate(column({ type, ...overrides }), options))).toBe(
        expected,
      );
    },
  );

  it("writes a string as the ascii column name and the sequence", () => {
    const target = column({ name: "Tên Khách", type: { kind: "text" } });
    expect(valueOf(generate(target, { sequence: 4 }))).toBe("ten_khach_4");
  });

  it("falls back to value when the column name has no ascii word", () => {
    const target = column({ name: "合計", type: { kind: "text" } });
    expect(valueOf(generate(target))).toBe("value_1");
  });

  it("keeps the sequence suffix when truncating a string to its max length", () => {
    const target = column({ type: { kind: "varchar", length: 3 } });
    expect(valueOf(generate(target, { sequence: 12 }))).toBe("_12");
  });

  it("formats an offset date time with Z", () => {
    const result = valueOf(generate(column({ type: { kind: "timestamptz" } })));
    expect(result).toMatch(/^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("returns null for a nullable custom column", () => {
    const target = column({
      type: { kind: "custom", name: "inet" },
      isNullable: true,
    });
    expect(generate(target)).toStrictEqual({ kind: "value", value: null });
  });

  it("omits a custom column with a default", () => {
    const target = column({
      type: { kind: "custom", name: "inet" },
      defaultValue: { kind: "literal", value: "127.0.0.1" },
    });
    expect(generate(target)).toStrictEqual({ kind: "omit" });
  });

  it.each<ColumnType>([
    { kind: "custom", name: "inet" },
    { kind: "enum", enumId: "enum_missing" },
    { kind: "enum", enumId: "enum_empty" },
  ])(
    "returns none for a required column of type %j without a default",
    (type) => {
      expect(generate(column({ type }))).toStrictEqual({ kind: "none" });
    },
  );

  it("never returns null for a key column", () => {
    const random = createSeedRandom(1);
    const target = column({ isNullable: true });
    const results = Array.from({ length: 200 }, (_, index) =>
      generateColumnValue({
        column: target,
        enums: ENUMS,
        random,
        sequence: index + 1,
        isKeyColumn: true,
        isPrimaryKeyColumn: false,
      }),
    );
    expect(results.some((result) => valueOf(result) === null)).toBe(false);
  });

  it("returns null for a nullable column at the fixed rate", () => {
    const random = createSeedRandom(1);
    const target = column({ isNullable: true });
    const results = Array.from({ length: 1000 }, (_, index) =>
      generateColumnValue({
        column: target,
        enums: ENUMS,
        random,
        sequence: index + 1,
        isKeyColumn: false,
        isPrimaryKeyColumn: false,
      }),
    );
    expect(results.filter((result) => valueOf(result) === null)).toHaveLength(
      NULL_COUNT_FOR_STATE_1,
    );
  });
});

describe("findFixedSeedValue", () => {
  it("returns null for a type that has a generator", () => {
    expect(findFixedSeedValue(column(), ENUMS)).toBeNull();
  });

  it("returns none for a required custom column without a default", () => {
    const target = column({ type: { kind: "custom", name: "inet" } });
    expect(findFixedSeedValue(target, ENUMS)).toStrictEqual({ kind: "none" });
  });
});
