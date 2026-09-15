import type { ColumnType } from "../../model/column-type.js";
import type { SchemaDocument } from "../../model/schema-document.js";

const INTEGER_LITERAL_PATTERN = /^-?(0|[1-9][0-9]*)$/;
const SMALLINT_BITS = 16n;
const INTEGER_BITS = 32n;
const BIGINT_BITS = 64n;
const SIGN_UNIT = 1n;
const BASE = 2n;

// bits includes the sign bit, matching the spec's [-2^(bits-1), 2^(bits-1) - 1].
function isValidIntegerLiteral(value: string, bits: bigint): boolean {
  if (!INTEGER_LITERAL_PATTERN.test(value)) {
    return false;
  }
  const parsed = BigInt(value);
  const max = BASE ** (bits - SIGN_UNIT) - SIGN_UNIT;
  const min = -max - SIGN_UNIT;
  return parsed >= min && parsed <= max;
}

const DECIMAL_LITERAL_PATTERN = /^-?[0-9]+(\.[0-9]+)?$/;
const LEADING_ZEROS_PATTERN = /^0+(?=[0-9])/;

// Digit-count limits only apply when scale <= precision; a larger scale
// already has its own issue (column-type-invalid-scale), so plan issue 2
// says only the numeric shape is checked in that case.
function isValidDecimalLiteral(
  value: string,
  precision: number,
  scale: number,
): boolean {
  if (!DECIMAL_LITERAL_PATTERN.test(value)) {
    return false;
  }
  if (scale > precision) {
    return true;
  }
  const unsigned = value.startsWith("-") ? value.slice(1) : value;
  const parts = unsigned.split(".");
  const integerDigits = (parts[0] ?? "").replace(LEADING_ZEROS_PATTERN, "");
  const fractionalDigits = parts[1] ?? "";
  return (
    integerDigits.length <= precision - scale &&
    fractionalDigits.length <= scale
  );
}

const REAL_LITERAL_PATTERN = /^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$/;

function isValidRealLiteral(value: string): boolean {
  return REAL_LITERAL_PATTERN.test(value);
}

function isValidBooleanLiteral(value: string): boolean {
  return value === "true" || value === "false";
}

// Array.from iterates a string by code point like a spread would, without
// tripping the no-misused-spread lint rule; Intl.Segmenter is off-limits in core.
function isValidLengthLiteral(value: string, maxLength: number): boolean {
  return Array.from(value).length <= maxLength;
}

const UUID_LITERAL_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function isValidUuidLiteral(value: string): boolean {
  return UUID_LITERAL_PATTERN.test(value);
}

const DATE_FORMAT_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const MIN_MONTH = 1;
const MAX_MONTH = 12;
const FEBRUARY = 2;
const FEBRUARY_LEAP_DAYS = 29;
const LEAP_YEAR_FACTOR = 4;
const CENTURY_FACTOR = 100;
const LEAP_CENTURY_FACTOR = 400;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  if (year % LEAP_YEAR_FACTOR !== 0) {
    return false;
  }
  return year % CENTURY_FACTOR !== 0 || year % LEAP_CENTURY_FACTOR === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === FEBRUARY && isLeapYear(year)) {
    return FEBRUARY_LEAP_DAYS;
  }
  return DAYS_IN_MONTH[month - 1] ?? 0;
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return false;
  }
  if (month < MIN_MONTH || month > MAX_MONTH) {
    return false;
  }
  return day >= 1 && day <= daysInMonth(year, month);
}

function isValidDateLiteral(value: string): boolean {
  if (!DATE_FORMAT_PATTERN.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return isValidCalendarDate(year, month, day);
}

const TIME_LITERAL_PATTERN =
  /^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?$/;
const TIMESTAMPTZ_TIME_PATTERN =
  /^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?(Z|[+-]([01][0-9]|2[0-3]):[0-5][0-9])$/;

function isValidTimeLiteral(value: string): boolean {
  return TIME_LITERAL_PATTERN.test(value);
}

// Splits on the first "T" instead of using one combined regex, so the date
// half can be checked for calendar validity, not just its shape.
function splitTimestamp(
  value: string,
): { readonly datePart: string; readonly timePart: string } | undefined {
  const separatorIndex = value.indexOf("T");
  if (separatorIndex === -1) {
    return undefined;
  }
  return {
    datePart: value.slice(0, separatorIndex),
    timePart: value.slice(separatorIndex + 1),
  };
}

function isValidTimestampLiteral(value: string): boolean {
  const parts = splitTimestamp(value);
  if (parts === undefined) {
    return false;
  }
  return (
    isValidDateLiteral(parts.datePart) &&
    TIME_LITERAL_PATTERN.test(parts.timePart)
  );
}

function isValidTimestamptzLiteral(value: string): boolean {
  const parts = splitTimestamp(value);
  if (parts === undefined) {
    return false;
  }
  return (
    isValidDateLiteral(parts.datePart) &&
    TIMESTAMPTZ_TIME_PATTERN.test(parts.timePart)
  );
}

function isValidJsonLiteral(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function isValidEnumLiteral(
  type: Extract<ColumnType, { readonly kind: "enum" }>,
  value: string,
  enums: SchemaDocument["enums"],
): boolean {
  return enums[type.enumId]?.values.includes(value) ?? false;
}

/** Checks a `literal` default's string against the shape its column type requires. */
export function isValidDefaultLiteral(
  type: ColumnType,
  value: string,
  enums: SchemaDocument["enums"],
): boolean {
  switch (type.kind) {
    case "smallint":
      return isValidIntegerLiteral(value, SMALLINT_BITS);
    case "integer":
      return isValidIntegerLiteral(value, INTEGER_BITS);
    case "bigint":
      return isValidIntegerLiteral(value, BIGINT_BITS);
    case "decimal":
      return isValidDecimalLiteral(value, type.precision, type.scale);
    case "real":
    case "double":
      return isValidRealLiteral(value);
    case "boolean":
      return isValidBooleanLiteral(value);
    case "char":
    case "varchar":
      return isValidLengthLiteral(value, type.length);
    case "text":
    case "custom":
      return true;
    case "uuid":
      return isValidUuidLiteral(value);
    case "date":
      return isValidDateLiteral(value);
    case "time":
      return isValidTimeLiteral(value);
    case "timestamp":
      return isValidTimestampLiteral(value);
    case "timestamptz":
      return isValidTimestamptzLiteral(value);
    case "json":
      return isValidJsonLiteral(value);
    case "binary":
      return false;
    case "enum":
      return isValidEnumLiteral(type, value, enums);
  }
}
