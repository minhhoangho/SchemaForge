import type { DocumentPath } from "../../document-path.js";
import type { Column } from "../../model/column.js";
import type { EnumId } from "../../model/ids.js";
import { isSafeCustomTypeName } from "../../validation/rules/custom-type-name.js";
import { createDiagnostic } from "./diagnostics.js";
import type { GeneratorDiagnostic, SqlDialect } from "./generator-types.js";

export type DialectColumnType =
  | {
      readonly kind:
        | "smallint"
        | "integer"
        | "bigint"
        | "real"
        | "double"
        | "boolean"
        | "text"
        | "uuid"
        | "date"
        | "time"
        | "timestamp"
        | "timestamptz"
        | "json"
        | "binary";
    }
  | {
      readonly kind: "decimal";
      readonly precision: number;
      readonly scale: number;
    }
  | { readonly kind: "char" | "varchar"; readonly length: number }
  // Text in a key: VARCHAR(255) on MySQL, nvarchar(450) on SQL Server.
  | { readonly kind: "keyText"; readonly length: number }
  | { readonly kind: "enum"; readonly enumId: EnumId }
  | {
      readonly kind: "custom";
      readonly name: string;
      readonly isSafe: boolean;
    };

export type ResolvedColumnType = {
  readonly type: DialectColumnType;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

type DialectLimits = {
  readonly maxCharLength: number;
  readonly maxVarcharLength: number;
  readonly maxPrecision: number;
  readonly maxScale: number;
  // null when text in a key needs no narrowing (PostgreSQL).
  readonly keyTextLength: number | null;
};

const DIALECT_LIMITS: Readonly<Record<SqlDialect, DialectLimits>> = {
  postgresql: {
    maxCharLength: 10_485_760,
    maxVarcharLength: 10_485_760,
    maxPrecision: 1000,
    maxScale: 1000,
    keyTextLength: null,
  },
  mysql: {
    maxCharLength: 255,
    maxVarcharLength: 16_383,
    maxPrecision: 65,
    maxScale: 30,
    keyTextLength: 255,
  },
  sqlserver: {
    maxCharLength: 4000,
    maxVarcharLength: 4000,
    maxPrecision: 38,
    maxScale: 38,
    keyTextLength: 450,
  },
};

// InnoDB key limit with utf8mb4 (4 bytes per character), spec section 4.
export const MYSQL_MAX_KEY_BYTES = 3072;
export const MYSQL_MAX_KEY_CHARACTERS = 768;
// Msg 1944: fixed-length part of a clustered primary key / nonclustered key.
export const SQLSERVER_MAX_PRIMARY_KEY_BYTES = 900;
export const SQLSERVER_MAX_INDEX_KEY_BYTES = 1700;

export const MYSQL_BYTES_PER_CHARACTER = 4;
const MYSQL_UUID_LENGTH = 36;
// Upper bound for every numeric, date, boolean and enum type: DECIMAL(65, 30) stores 30 bytes.
export const MYSQL_OTHER_TYPE_BYTES = 32;
const SQLSERVER_BYTES_PER_CHARACTER = 2;
const SQLSERVER_UUID_BYTES = 16;
// Upper bound for every other fixed type: decimal(38) stores 17 bytes.
const SQLSERVER_OTHER_FIXED_BYTES = 17;

type ResolveInput = {
  readonly dialect: SqlDialect;
  readonly column: Column;
  readonly isKeyColumn: boolean;
  // SQL Server only: the column belongs to a key over the fixed-length limit (Msg 1944).
  readonly isFixedLengthNarrowed?: boolean;
};

type TextualKind = "char" | "varchar";

function typePath(column: Column): DocumentPath {
  return ["columns", column.id, "type"];
}

function applyLengthLimit(
  dialect: SqlDialect,
  kind: TextualKind,
  length: number,
): DialectColumnType {
  const limits = DIALECT_LIMITS[dialect];
  if (kind === "char" && length <= limits.maxCharLength) {
    return { kind, length };
  }
  if (kind === "varchar" && length <= limits.maxVarcharLength) {
    return { kind, length };
  }
  // Only MySQL keeps an over-long char bounded, as varchar (spec issue 6).
  if (
    kind === "char" &&
    dialect === "mysql" &&
    length <= limits.maxVarcharLength
  ) {
    return { kind: "varchar", length };
  }
  return { kind: "text" };
}

function isOverLimit(
  dialect: SqlDialect,
  kind: TextualKind,
  length: number,
): boolean {
  const limits = DIALECT_LIMITS[dialect];
  const limit =
    kind === "char" ? limits.maxCharLength : limits.maxVarcharLength;
  return length > limit;
}

function resolveTextual(
  input: ResolveInput,
  kind: TextualKind,
  length: number,
): ResolvedColumnType {
  const { dialect, column, isKeyColumn } = input;
  const path = typePath(column);
  const overLimit = isOverLimit(dialect, kind, length)
    ? [createDiagnostic("type-parameter-out-of-range", path)]
    : [];
  // MySQL narrows long key columns before the limits apply (spec R2, R11).
  if (dialect === "mysql" && isKeyColumn && length > MYSQL_MAX_KEY_CHARACTERS) {
    return {
      type: { kind: "varchar", length: MYSQL_MAX_KEY_CHARACTERS },
      diagnostics: [
        ...overLimit,
        createDiagnostic("key-column-type-narrowed", path),
      ],
    };
  }
  const limited = applyLengthLimit(dialect, kind, length);
  if (limited.kind === "text") {
    return narrowKeyText(input, overLimit);
  }
  if (limited.kind === "char" && input.isFixedLengthNarrowed === true) {
    return {
      type: { kind: "varchar", length },
      diagnostics: [createDiagnostic("key-column-type-narrowed", path)],
    };
  }
  return { type: limited, diagnostics: overLimit };
}

function narrowKeyText(
  input: ResolveInput,
  diagnostics: readonly GeneratorDiagnostic[],
): ResolvedColumnType {
  const keyTextLength = DIALECT_LIMITS[input.dialect].keyTextLength;
  if (!input.isKeyColumn || keyTextLength === null) {
    return { type: { kind: "text" }, diagnostics };
  }
  return {
    type: { kind: "keyText", length: keyTextLength },
    diagnostics: [
      ...diagnostics,
      createDiagnostic("key-column-type-narrowed", typePath(input.column)),
    ],
  };
}

function resolveDecimal(
  input: ResolveInput,
  precision: number,
  scale: number,
): ResolvedColumnType {
  const limits = DIALECT_LIMITS[input.dialect];
  const clampedPrecision = Math.min(precision, limits.maxPrecision);
  const clampedScale = Math.min(scale, limits.maxScale, clampedPrecision);
  const type: DialectColumnType = {
    kind: "decimal",
    precision: clampedPrecision,
    scale: clampedScale,
  };
  const isChanged = clampedPrecision !== precision || clampedScale !== scale;
  return {
    type,
    diagnostics: isChanged
      ? [
          createDiagnostic(
            "type-parameter-out-of-range",
            typePath(input.column),
          ),
        ]
      : [],
  };
}

// If chains instead of switches: the lint rule wants every kind listed, and
// most kinds share one fallback value.

/** The dialect type of one column and the diagnostics of every change (spec sections 3, 4). */
export function resolveDialectColumnType(
  input: ResolveInput,
): ResolvedColumnType {
  const { type } = input.column;
  if (type.kind === "char" || type.kind === "varchar") {
    return resolveTextual(input, type.kind, type.length);
  }
  if (type.kind === "text") {
    return narrowKeyText(input, []);
  }
  if (type.kind === "decimal") {
    return resolveDecimal(input, type.precision, type.scale);
  }
  if (type.kind === "enum") {
    return { type: { kind: "enum", enumId: type.enumId }, diagnostics: [] };
  }
  if (type.kind === "custom") {
    const isSafe = isSafeCustomTypeName(type.name);
    return {
      type: { kind: "custom", name: type.name, isSafe },
      diagnostics: [],
    };
  }
  return { type: { kind: type.kind }, diagnostics: [] };
}

/** Bytes a column adds to a MySQL key (spec section 4, "Độ dài khóa trên MySQL"). */
export function mysqlKeyPartBytes(type: DialectColumnType): number {
  if (
    type.kind === "char" ||
    type.kind === "varchar" ||
    type.kind === "keyText"
  ) {
    return MYSQL_BYTES_PER_CHARACTER * type.length;
  }
  if (type.kind === "uuid") {
    return MYSQL_BYTES_PER_CHARACTER * MYSQL_UUID_LENGTH;
  }
  return type.kind === "custom" ? 0 : MYSQL_OTHER_TYPE_BYTES;
}

// nvarchar, varbinary and custom columns have no fixed-length part.
const SQLSERVER_VARIABLE_KINDS: ReadonlySet<DialectColumnType["kind"]> =
  new Set(["varchar", "keyText", "text", "json", "binary", "enum", "custom"]);

/** Fixed-length bytes a column adds to a SQL Server key (spec section 4, "Độ dài khóa trên SQL Server"). */
export function sqlServerFixedKeyBytes(type: DialectColumnType): number {
  if (type.kind === "char") {
    return SQLSERVER_BYTES_PER_CHARACTER * type.length;
  }
  if (type.kind === "uuid") {
    return SQLSERVER_UUID_BYTES;
  }
  return SQLSERVER_VARIABLE_KINDS.has(type.kind)
    ? 0
    : SQLSERVER_OTHER_FIXED_BYTES;
}
