import type { Column } from "../../model/column.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { toAsciiWords } from "../shared/identifiers.js";
import { toJsonFieldType } from "../shared/json-representation.js";
import type {
  JsonFieldType,
  JsonValue,
} from "../shared/json-representation.js";
import {
  encodeBase64,
  formatSeedDate,
  formatSeedTime,
  formatUuidV4,
} from "./seed-random.js";
import type { SeedRandom } from "./seed-random.js";

// A nullable column outside every key gets null when nextInt(5) === 0.
export const SEED_NULL_RATE_DENOMINATOR = 5;

export type SeedValue =
  | { readonly kind: "value"; readonly value: JsonValue }
  // Left out of the row so the database writes its default.
  | { readonly kind: "omit" }
  // No value can be generated: the table is skipped.
  | { readonly kind: "none" };

export type ColumnValueInput = {
  readonly column: Column;
  readonly enums: SchemaDocument["enums"];
  readonly random: SeedRandom;
  // The column's own counter: 1 on its first generation, then +1 per call.
  readonly sequence: number;
  // In the primary key, unique (column or index), or in a relation column pair.
  readonly isKeyColumn: boolean;
  readonly isPrimaryKeyColumn: boolean;
};

const SMALLINT_RANGE = 65_536;
const SMALLINT_OFFSET = 32_768;
const MAX_INTEGER_DIGITS = 9;
const DECIMAL_BASE = 10;
const FLOAT_CENTS = 1_000_000;
const CENTS_PER_UNIT = 100;
const DAYS_IN_SEED_YEAR = 365;
const SECONDS_IN_DAY = 86_400;
const BYTE_RANGE = 256;
const UUID_BYTE_COUNT = 16;
const BINARY_BYTE_COUNT = 4;
const JSON_VALUE_RANGE = 1000;
const STRING_FALLBACK_WORD = "value";
const SEQUENCED_KINDS: ReadonlySet<JsonFieldType["kind"]> = new Set([
  "smallint",
  "int32",
  "bigintString",
]);

/**
 * The outcome for a column whose type has no generator (custom, or an enum
 * that is missing or empty), or null when the type has one. Needs no PRNG,
 * so a table that would get `none` is known before any row is built.
 */
export function findFixedSeedValue(
  column: Column,
  enums: SchemaDocument["enums"],
): SeedValue | null {
  const { type } = column;
  const hasGenerator =
    type.kind !== "custom" &&
    (type.kind !== "enum" || (enums[type.enumId]?.values.length ?? 0) > 0);
  if (hasGenerator) {
    return null;
  }
  if (column.isNullable) {
    return { kind: "value", value: null };
  }
  return column.defaultValue === null ? { kind: "none" } : { kind: "omit" };
}

// A loop, not Array.from({ length }): this runs for every uuid and binary value.
function drawBytes(random: SeedRandom, count: number): readonly number[] {
  const bytes: number[] = [];
  for (let index = 0; index < count; index += 1) {
    bytes.push(random.nextInt(BYTE_RANGE));
  }
  return bytes;
}

function drawDecimal(
  random: SeedRandom,
  precision: number,
  scale: number,
): string {
  const integerDigits = Math.min(precision - scale, MAX_INTEGER_DIGITS);
  const integerPart =
    integerDigits <= 0
      ? "0"
      : String(random.nextInt(DECIMAL_BASE ** integerDigits));
  const fractionalPart = Array.from({ length: scale }, () =>
    String(random.nextInt(DECIMAL_BASE)),
  ).join("");
  return scale > 0 ? `${integerPart}.${fractionalPart}` : integerPart;
}

function drawDateTime(random: SeedRandom): string {
  const date = formatSeedDate(random.nextInt(DAYS_IN_SEED_YEAR));
  return `${date}T${formatSeedTime(random.nextInt(SECONDS_IN_DAY))}`;
}

// Truncation keeps the end, so the sequence that makes values distinct survives.
function formatSequencedString(
  column: Column,
  sequence: number,
  maxLength: number | null,
): string {
  const words = toAsciiWords(column.name).map((word) => word.toLowerCase());
  const base = words.length === 0 ? STRING_FALLBACK_WORD : words.join("_");
  const text = `${base}_${String(sequence)}`;
  return maxLength === null ? text : text.slice(-maxLength);
}

function drawValue(
  fieldType: JsonFieldType,
  input: ColumnValueInput,
): JsonValue {
  const { random } = input;
  switch (fieldType.kind) {
    case "smallint":
      return random.nextInt(SMALLINT_RANGE) - SMALLINT_OFFSET;
    case "int32":
      return random.nextUint32() | 0;
    case "bigintString":
      return String(random.nextUint32());
    case "decimalString":
      return drawDecimal(random, fieldType.precision, fieldType.scale);
    case "float":
    case "double":
      return random.nextInt(FLOAT_CENTS) / CENTS_PER_UNIT;
    case "boolean":
      return random.nextInt(2) === 1;
    case "string":
      return formatSequencedString(
        input.column,
        input.sequence,
        fieldType.maxLength,
      );
    case "uuid":
      return formatUuidV4(drawBytes(random, UUID_BYTE_COUNT));
    case "date":
      return formatSeedDate(random.nextInt(DAYS_IN_SEED_YEAR));
    case "time":
      return formatSeedTime(random.nextInt(SECONDS_IN_DAY));
    case "localDateTime":
      return drawDateTime(random);
    case "offsetDateTime":
      return `${drawDateTime(random)}Z`;
    case "json":
      return Object.fromEntries([["value", random.nextInt(JSON_VALUE_RANGE)]]);
    case "base64":
      return encodeBase64(drawBytes(random, BINARY_BYTE_COUNT));
    case "enum":
      return drawEnumValue(input.enums[fieldType.enumId]?.values ?? [], random);
    case "unknown":
      // Custom types never get here: findFixedSeedValue handles them first.
      return null;
  }
}

// findFixedSeedValue has already ruled out a missing or empty enum.
function drawEnumValue(
  values: readonly string[],
  random: SeedRandom,
): JsonValue {
  return values[random.nextInt(Math.max(values.length, 1))] ?? null;
}

function toSequenceValue(
  fieldType: JsonFieldType,
  sequence: number,
): JsonValue {
  return fieldType.kind === "bigintString" ? String(sequence) : sequence;
}

/** One column value for seed data (spec CG-08, "Sinh giá trị xác định"). */
export function generateColumnValue(input: ColumnValueInput): SeedValue {
  const { column, random } = input;
  const fixed = findFixedSeedValue(column, input.enums);
  if (fixed !== null) {
    return fixed;
  }
  if (
    column.isNullable &&
    !input.isKeyColumn &&
    random.nextInt(SEED_NULL_RATE_DENOMINATOR) === 0
  ) {
    return { kind: "value", value: null };
  }
  const fieldType = toJsonFieldType(column.type);
  const isSequenced =
    (column.isAutoIncrement || input.isPrimaryKeyColumn) &&
    SEQUENCED_KINDS.has(fieldType.kind);
  return {
    kind: "value",
    value: isSequenced
      ? toSequenceValue(fieldType, input.sequence)
      : drawValue(fieldType, input),
  };
}
