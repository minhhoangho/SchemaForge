import type { ColumnType } from "../../model/column-type.js";
import type { EnumId } from "../../model/ids.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import { isValidDefaultLiteral } from "../../validation/rules/default-literals.js";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** How a column value travels through JSON (spec section 3, "Biểu diễn JSON"). */
export type JsonFieldType =
  | { readonly kind: "smallint" }
  | { readonly kind: "int32" }
  | { readonly kind: "bigintString" }
  | {
      readonly kind: "decimalString";
      readonly precision: number;
      readonly scale: number;
    }
  | { readonly kind: "float" }
  | { readonly kind: "double" }
  | { readonly kind: "boolean" }
  | { readonly kind: "string"; readonly maxLength: number | null }
  | { readonly kind: "uuid" }
  | { readonly kind: "date" }
  | { readonly kind: "time" }
  | { readonly kind: "localDateTime" }
  | { readonly kind: "offsetDateTime" }
  | { readonly kind: "json" }
  | { readonly kind: "base64" }
  | { readonly kind: "enum"; readonly enumId: EnumId }
  | { readonly kind: "unknown" };

export const SMALLINT_MINIMUM = -32768;
export const SMALLINT_MAXIMUM = 32767;
const INT32_MINIMUM = -2147483648;
const INT32_MAXIMUM = 2147483647;

export const BIGINT_STRING_PATTERN = "^-?(0|[1-9][0-9]*)$";
export const TIME_PATTERN =
  "^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\\.[0-9]+)?$";
export const LOCAL_DATE_TIME_PATTERN = `^[0-9]{4}-[0-9]{2}-[0-9]{2}T${TIME_PATTERN.slice(1)}`;
export const BASE64_PATTERN =
  "^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$";

const BASE64_REGEX = new RegExp(BASE64_PATTERN);

export function toJsonFieldType(type: ColumnType): JsonFieldType {
  switch (type.kind) {
    case "smallint":
    case "boolean":
    case "uuid":
    case "date":
    case "time":
    case "json":
    case "double":
      return { kind: type.kind };
    case "integer":
      return { kind: "int32" };
    case "bigint":
      return { kind: "bigintString" };
    case "decimal":
      return {
        kind: "decimalString",
        precision: type.precision,
        scale: type.scale,
      };
    case "real":
      return { kind: "float" };
    case "char":
    case "varchar":
      return { kind: "string", maxLength: type.length };
    case "text":
      return { kind: "string", maxLength: null };
    case "timestamp":
      return { kind: "localDateTime" };
    case "timestamptz":
      return { kind: "offsetDateTime" };
    case "binary":
      return { kind: "base64" };
    case "enum":
      return { kind: "enum", enumId: type.enumId };
    case "custom":
      return { kind: "unknown" };
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}

/**
 * Accepts exactly the literals `isValidDefaultLiteral` accepts for
 * `decimal(precision, scale)`, leading zeros included (core model plan, issue 2).
 */
export function decimalStringPattern(precision: number, scale: number): string {
  if (scale > precision) {
    return "^-?[0-9]+(\\.[0-9]+)?$";
  }
  const integerDigits = precision - scale;
  const integerPart =
    integerDigits === 0 ? "0+" : `0*[0-9]{1,${String(integerDigits)}}`;
  const fractionalPart = scale === 0 ? "" : `(\\.[0-9]{1,${String(scale)}})?`;
  return `^-?${integerPart}${fractionalPart}$`;
}

function isIntegerInRange(
  value: JsonValue,
  minimum: number,
  maximum: number,
): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

/**
 * The one value check shared by seed data and AI-06 (spec section 3). `null`
 * is always rejected: callers check the column's nullability first.
 */
export function isValidJsonValue(
  type: ColumnType,
  value: JsonValue,
  enums: SchemaDocument["enums"],
): boolean {
  if (value === null) {
    return false;
  }
  switch (type.kind) {
    case "smallint":
      return isIntegerInRange(value, SMALLINT_MINIMUM, SMALLINT_MAXIMUM);
    case "integer":
      return isIntegerInRange(value, INT32_MINIMUM, INT32_MAXIMUM);
    case "real":
    case "double":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "json":
    case "custom":
      return true;
    case "binary":
      return typeof value === "string" && BASE64_REGEX.test(value);
    case "bigint":
    case "decimal":
    case "char":
    case "varchar":
    case "text":
    case "uuid":
    case "date":
    case "time":
    case "timestamp":
    case "timestamptz":
    case "enum":
      return (
        typeof value === "string" && isValidDefaultLiteral(type, value, enums)
      );
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}
