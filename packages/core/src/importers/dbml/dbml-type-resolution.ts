import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type { DraftColumnType } from "../shared/import-draft.js";
import { toNameKey } from "../../model/name-limits.js";
import { mapSqlType } from "../shared/sql-type-mapping.js";
import type { SqlTypeMapping } from "../shared/sql-type-mapping.js";

export type DbmlTypeInput = {
  /** The type name as the parser returns it, without quotes. */
  readonly rawType: string;
  readonly isQuoted: boolean;
  readonly enumNameKeys: ReadonlySet<string>;
  readonly databaseType: SqlDialect;
};

// The names generateDbml writes for the generic types without parameters.
const GENERIC_TYPE_NAMES: ReadonlyMap<string, DraftColumnType> = new Map(
  (
    [
      "smallint",
      "integer",
      "bigint",
      "real",
      "double",
      "boolean",
      "text",
      "uuid",
      "date",
      "time",
      "timestamp",
      "timestamptz",
      "json",
      "binary",
    ] as const
  ).map((kind) => [kind, { kind }]),
);

// The parser removes the spaces inside the argument list: `decimal(10, 2)` → `decimal(10,2)`.
const DECIMAL_PATTERN = /^decimal\(([0-9]+),([0-9]+)\)$/;
const LENGTH_PATTERN = /^(char|varchar)\(([0-9]+)\)$/;

const DATABASE_TYPES: ReadonlyMap<string, SqlDialect> = new Map([
  ["postgresql", "postgresql"],
  ["mysql", "mysql"],
  ["sql server", "sqlserver"],
]);

function mapped(type: DraftColumnType): SqlTypeMapping {
  return { type, isAutoIncrement: false, codes: [] };
}

// A length or precision the model accepts: a safe integer of at least 1.
function readCount(digits: string | undefined): number | null {
  const count = Number(digits);
  return digits !== undefined && Number.isSafeInteger(count) && count >= 1
    ? count
    : null;
}

// Exactly as generateDbml writes it; anything else goes through the sql mapping.
function readGenericType(rawType: string): DraftColumnType | null {
  const generic = GENERIC_TYPE_NAMES.get(rawType);
  if (generic !== undefined) {
    return generic;
  }
  const decimal = DECIMAL_PATTERN.exec(rawType);
  if (decimal !== null) {
    const precision = readCount(decimal[1]);
    const scale = Number(decimal[2]);
    return precision !== null && Number.isSafeInteger(scale)
      ? { kind: "decimal", precision, scale }
      : null;
  }
  const sized = LENGTH_PATTERN.exec(rawType);
  const length = readCount(sized?.[2]);
  if (length === null) {
    return null;
  }
  return sized?.[1] === "char"
    ? { kind: "char", length }
    : { kind: "varchar", length };
}

/** The dialect that reads native type names (`Project.database_type`); PostgreSQL otherwise. */
export function toDbmlDatabaseType(databaseType: string | null): SqlDialect {
  return (
    (databaseType === null
      ? undefined
      : DATABASE_TYPES.get(toNameKey(databaseType))) ?? "postgresql"
  );
}

/** Maps a DBML column type to the model (import / export spec, section 7). */
export function resolveDbmlType(input: DbmlTypeInput): SqlTypeMapping {
  const { rawType, enumNameKeys } = input;
  const isEnumName = enumNameKeys.has(toNameKey(rawType));
  if (input.isQuoted) {
    // generateDbml quotes enum and custom type names.
    return mapped(
      isEnumName
        ? { kind: "enum", enumName: rawType }
        : { kind: "custom", name: rawType },
    );
  }
  const generic = readGenericType(rawType);
  if (generic !== null) {
    return mapped(generic);
  }
  if (isEnumName) {
    return mapped({ kind: "enum", enumName: rawType });
  }
  return mapSqlType({
    rawType,
    dialect: input.databaseType,
    enumNameKeys,
    hasUuidDefault: false,
  });
}
