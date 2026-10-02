import type { Column } from "../../model/column.js";
import type { EnumId } from "../../model/ids.js";
import type { SchemaDocument } from "../../model/schema-document.js";
import type { DialectColumnType } from "../shared/dialect-types.js";
import { createDiagnostic } from "../shared/diagnostics.js";
import type {
  GeneratorDiagnostic,
  SqlDialect,
} from "../shared/generator-types.js";
import { sqlServerEnumLength } from "../shared/sqlserver-enum-length.js";

/** A Prisma string literal: Prisma escapes `\` and `"` like JSON (spec section 5). */
export function formatPrismaString(value: string): string {
  return JSON.stringify(value);
}

export type PrismaFieldTypeInput = {
  readonly provider: SqlDialect;
  readonly column: Column;
  readonly type: DialectColumnType;
  readonly enumNames: ReadonlyMap<EnumId, string>;
  readonly enums: SchemaDocument["enums"];
};

export type PrismaFieldType = {
  readonly typeName: string;
  readonly nativeAttribute: string | null;
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

type BaseType = Omit<PrismaFieldType, "diagnostics"> & {
  readonly diagnostics?: readonly GeneratorDiagnostic[];
};

type PerProvider = Readonly<Record<SqlDialect, string | null>>;

const MAX_LENGTH = "Max";

function perProvider(
  scalar: string,
  native: PerProvider,
  provider: SqlDialect,
): BaseType {
  return { typeName: scalar, nativeAttribute: native[provider] };
}

function textual(
  provider: SqlDialect,
  kind: "char" | "varchar",
  length: number,
): BaseType {
  const native =
    provider === "sqlserver" ? `N${capitalize(kind)}` : capitalize(kind);
  return {
    typeName: "String",
    nativeAttribute: `@db.${native}(${String(length)})`,
  };
}

function capitalize(kind: "char" | "varchar"): string {
  return kind === "char" ? "Char" : "VarChar";
}

function sqlServerEnum(input: PrismaFieldTypeInput, enumId: EnumId): BaseType {
  const typePath = ["columns", input.column.id, "type"];
  const length = sqlServerEnumLength(input.enums[enumId]?.values ?? []);
  return {
    typeName: "String",
    nativeAttribute: `@db.NVarChar(${length === null ? MAX_LENGTH : String(length)})`,
    diagnostics: [
      createDiagnostic("enum-not-supported", typePath),
      ...(length === null
        ? [createDiagnostic("type-parameter-out-of-range", typePath)]
        : []),
    ],
  };
}

function enumType(input: PrismaFieldTypeInput, enumId: EnumId): BaseType {
  if (input.provider === "sqlserver") {
    return sqlServerEnum(input, enumId);
  }
  return {
    typeName: input.enumNames.get(enumId) ?? "String",
    nativeAttribute: null,
  };
}

function jsonType(input: PrismaFieldTypeInput): BaseType {
  if (input.provider !== "sqlserver") {
    return { typeName: "Json", nativeAttribute: null };
  }
  return {
    typeName: "String",
    nativeAttribute: `@db.NVarChar(${MAX_LENGTH})`,
    diagnostics: [
      createDiagnostic("type-not-supported", [
        "columns",
        input.column.id,
        "type",
      ]),
    ],
  };
}

// The Prisma table of spec section 3, applied after the dialect rules.
function baseType(input: PrismaFieldTypeInput): BaseType {
  const { provider, type } = input;
  switch (type.kind) {
    case "smallint":
      return { typeName: "Int", nativeAttribute: "@db.SmallInt" };
    case "integer":
      return { typeName: "Int", nativeAttribute: null };
    case "bigint":
      return { typeName: "BigInt", nativeAttribute: null };
    case "decimal":
      return {
        typeName: "Decimal",
        nativeAttribute: `@db.Decimal(${String(type.precision)}, ${String(type.scale)})`,
      };
    case "real":
      return perProvider(
        "Float",
        { postgresql: "@db.Real", mysql: "@db.Float", sqlserver: "@db.Real" },
        provider,
      );
    case "double":
      return { typeName: "Float", nativeAttribute: null };
    case "boolean":
      return { typeName: "Boolean", nativeAttribute: null };
    case "char":
    case "varchar":
      return textual(provider, type.kind, type.length);
    // Text narrowed for a key is VARCHAR on MySQL and nvarchar on SQL Server.
    case "keyText":
      return textual(provider, "varchar", type.length);
    case "text":
      return perProvider(
        "String",
        {
          postgresql: null,
          mysql: "@db.LongText",
          sqlserver: `@db.NVarChar(${MAX_LENGTH})`,
        },
        provider,
      );
    case "uuid":
      return perProvider(
        "String",
        {
          postgresql: "@db.Uuid",
          mysql: "@db.Char(36)",
          sqlserver: "@db.UniqueIdentifier",
        },
        provider,
      );
    case "date":
      return { typeName: "DateTime", nativeAttribute: "@db.Date" };
    case "time":
      return perProvider(
        "DateTime",
        {
          postgresql: "@db.Time(6)",
          mysql: "@db.Time(6)",
          sqlserver: "@db.Time",
        },
        provider,
      );
    case "timestamp":
      return perProvider(
        "DateTime",
        {
          postgresql: "@db.Timestamp(6)",
          mysql: "@db.DateTime(6)",
          sqlserver: "@db.DateTime2",
        },
        provider,
      );
    case "timestamptz":
      return perProvider(
        "DateTime",
        {
          postgresql: "@db.Timestamptz(6)",
          mysql: "@db.Timestamp(6)",
          sqlserver: "@db.DateTimeOffset",
        },
        provider,
      );
    case "json":
      return jsonType(input);
    case "binary":
      return perProvider(
        "Bytes",
        { postgresql: null, mysql: "@db.LongBlob", sqlserver: null },
        provider,
      );
    case "enum":
      return enumType(input, type.enumId);
    // The name sits inside an escaped string, so no unsafe fallback is needed.
    case "custom":
      return {
        typeName: `Unsupported(${formatPrismaString(type.name)})`,
        nativeAttribute: null,
      };
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}

/** The Prisma scalar type (with `?` when nullable) and native `@db` attribute of a column. */
export function renderPrismaFieldType(
  input: PrismaFieldTypeInput,
): PrismaFieldType {
  const base = baseType(input);
  return {
    typeName: input.column.isNullable ? `${base.typeName}?` : base.typeName,
    nativeAttribute: base.nativeAttribute,
    diagnostics: base.diagnostics ?? [],
  };
}
