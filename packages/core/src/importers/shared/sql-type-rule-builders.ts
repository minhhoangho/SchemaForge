import type { ImportDiagnosticCode } from "./import-diagnostic-codes.js";
import type { DraftColumnType } from "./import-draft.js";

export type SqlTypeMapping = {
  readonly type: DraftColumnType;
  readonly isAutoIncrement: boolean;
  readonly codes: readonly ImportDiagnosticCode[];
};

// args is null when the type has no parenthesized list. A rule returns null
// when the arguments are outside the model's domain, so the type stays custom.
export type TypeRule = (
  args: readonly string[] | null,
  hasUuidDefault: boolean,
) => SqlTypeMapping | null;

type Codes = readonly ImportDiagnosticCode[];

const NO_CODES: Codes = [];
export const APPROXIMATED: Codes = ["type-approximated"];
const PARAMETER_DROPPED: ImportDiagnosticCode = "type-parameter-dropped";
const COUNT_PATTERN = /^[0-9]+$/;
const MAX_REAL_FLOAT_BITS = 24;
const MAX_FLOAT_BITS = 53;
const MYSQL_UUID_LENGTH = 36;
const UNBOUNDED_LENGTH = "max";

export function mapped(
  type: DraftColumnType,
  codes: Codes = NO_CODES,
  isAutoIncrement = false,
): SqlTypeMapping {
  return { type, isAutoIncrement, codes };
}

function parseCount(text: string | undefined): number | null {
  if (text === undefined || !COUNT_PATTERN.test(text)) {
    return null;
  }
  const count = Number(text);
  return Number.isSafeInteger(count) ? count : null;
}

export function singleCount(args: readonly string[] | null): number | null {
  return args?.length === 1 ? parseCount(args[0]) : null;
}

export function plain(type: DraftColumnType, codes = NO_CODES): TypeRule {
  return (args) => (args === null ? mapped(type, codes) : null);
}

export function serial(type: DraftColumnType): TypeRule {
  return (args) => (args === null ? mapped(type, NO_CODES, true) : null);
}

// MySQL integer display widths (INT(11)) have no place in the model.
export function displayWidth(
  type: DraftColumnType,
  codes = NO_CODES,
): TypeRule {
  return (args) => {
    if (args === null) {
      return mapped(type, codes);
    }
    return singleCount(args) === null
      ? null
      : mapped(type, [...codes, PARAMETER_DROPPED]);
  };
}

export function fractionalSeconds(
  type: DraftColumnType,
  implicitPrecision: number,
  modelPrecision: number,
): TypeRule {
  return (args) => {
    const precision = args === null ? implicitPrecision : singleCount(args);
    if (precision === null) {
      return null;
    }
    return mapped(
      type,
      precision === modelPrecision ? NO_CODES : [PARAMETER_DROPPED],
    );
  };
}

export function withLength(
  kind: "char" | "varchar",
  codes = NO_CODES,
): TypeRule {
  return (args) => {
    const length = singleCount(args);
    return length === null || length < 1
      ? null
      : mapped({ kind, length }, codes);
  };
}

export function unbounded(type: DraftColumnType, codes = NO_CODES): TypeRule {
  return (args) =>
    args?.length === 1 && args[0]?.toLowerCase() === UNBOUNDED_LENGTH
      ? mapped(type, codes)
      : null;
}

export const decimal: TypeRule = (args) => {
  if (args === null || args.length > 2) {
    return null;
  }
  const precision = parseCount(args[0]);
  const scale = args.length === 2 ? parseCount(args[1]) : 0;
  return precision === null || precision < 1 || scale === null
    ? null
    : mapped({ kind: "decimal", precision, scale });
};

// float(n) is real up to 24 bits of mantissa and double up to 53.
export const floatBits: TypeRule = (args) => {
  const bits = singleCount(args);
  if (bits === null || bits < 1 || bits > MAX_FLOAT_BITS) {
    return null;
  }
  return mapped({ kind: bits <= MAX_REAL_FLOAT_BITS ? "real" : "double" });
};

// BINARY(n) and VARBINARY(n) keep bytes but not their length limit.
export const sizedBinary: TypeRule = (args) =>
  singleCount(args) === null ? null : mapped({ kind: "binary" }, APPROXIMATED);

export const mysqlChar: TypeRule = (args, hasUuidDefault) =>
  hasUuidDefault && singleCount(args) === MYSQL_UUID_LENGTH
    ? mapped({ kind: "uuid" })
    : withLength("char")(args, hasUuidDefault);

export function firstOf(...rules: readonly TypeRule[]): TypeRule {
  return (args, hasUuidDefault) => {
    for (const rule of rules) {
      const result = rule(args, hasUuidDefault);
      if (result !== null) {
        return result;
      }
    }
    return null;
  };
}

// Names @dbml/core squashes (`doubleprecision`) for a type the model keeps as custom.
export function customAlias(name: string): TypeRule {
  return (args) =>
    mapped({
      kind: "custom",
      name: args === null ? name : `${name}(${args.join(", ")})`,
    });
}
