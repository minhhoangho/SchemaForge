import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type { ColumnDefault } from "../../model/column-default.js";
import { isSafeCustomTypeName } from "../../validation/rules/custom-type-name.js";
import type { ImportDiagnosticCode } from "../shared/import-diagnostic-codes.js";
import type { DraftColumnType } from "../shared/import-draft.js";
import {
  mapped,
  type SqlTypeMapping,
} from "../shared/sql-type-rule-builders.js";
import { mapSqlType } from "../shared/sql-type-mapping.js";
import type {
  PrismaArgument,
  PrismaAttribute,
  PrismaField,
  PrismaPosition,
} from "./prisma-ast.js";
import { mapPrismaDefault } from "./prisma-default-mapping.js";

export type PrismaFieldContext = {
  readonly provider: SqlDialect;
  readonly enumNamesByPrismaName: ReadonlyMap<string, string>;
  readonly enumValuesByPrismaName: ReadonlyMap<
    string,
    ReadonlyMap<string, string>
  >;
};

export type PrismaFieldDiagnostic = {
  readonly code: ImportDiagnosticCode;
  readonly field: "type" | "defaultValue" | null;
  readonly position: PrismaPosition;
};

export type PrismaFieldMapping = {
  readonly type: DraftColumnType;
  readonly isAutoIncrement: boolean;
  readonly defaultValue: ColumnDefault | null;
  readonly diagnostics: readonly PrismaFieldDiagnostic[];
};

const NATIVE_PREFIX = "db.";
const DEFAULT_ATTRIBUTE = "default";
const UUID_FUNCTION = "uuid";
const LIST_SUFFIX = "[]";
const NO_ENUM_NAMES: ReadonlySet<string> = new Set();
const TYPE_NOT_SUPPORTED = mapped({ kind: "text" }, ["type-not-supported"]);

const SHARED_SCALARS: readonly (readonly [string, DraftColumnType])[] = [
  ["Int", { kind: "integer" }],
  ["BigInt", { kind: "bigint" }],
  ["Float", { kind: "double" }],
  ["Boolean", { kind: "boolean" }],
  ["DateTime", { kind: "timestamp" }],
  ["Json", { kind: "json" }],
  ["Bytes", { kind: "binary" }],
];

// The column a scalar gets without `@db.*`: Prisma's default native type per
// provider, as the model holds it (spec section 6, type table).
const SCALAR_TYPES: Readonly<
  Record<SqlDialect, ReadonlyMap<string, DraftColumnType>>
> = {
  postgresql: new Map([
    ...SHARED_SCALARS,
    ["Decimal", { kind: "decimal", precision: 65, scale: 30 }],
    ["String", { kind: "text" }],
  ]),
  mysql: new Map([
    ...SHARED_SCALARS,
    ["Decimal", { kind: "decimal", precision: 65, scale: 30 }],
    ["String", { kind: "varchar", length: 191 }],
  ]),
  sqlserver: new Map([
    ...SHARED_SCALARS,
    ["Decimal", { kind: "decimal", precision: 32, scale: 16 }],
    ["String", { kind: "varchar", length: 1000 }],
  ]),
};

// Prisma's PostgreSQL native type per scalar, the element of a scalar list.
const LIST_ELEMENT_TYPES: ReadonlyMap<string, string> = new Map([
  ["Int", "integer"],
  ["BigInt", "bigint"],
  ["Float", "double precision"],
  ["Decimal", "decimal(65,30)"],
  ["Boolean", "boolean"],
  ["String", "text"],
  ["DateTime", "timestamp(3)"],
  ["Json", "jsonb"],
  ["Bytes", "bytea"],
]);

// Prisma spells MySQL unsigned integers as one word; the SQL type table reads
// the modifier after the type.
const MYSQL_NATIVE_ALIASES: ReadonlyMap<string, string> = new Map([
  ["unsignedtinyint", "tinyint unsigned"],
  ["unsignedsmallint", "smallint unsigned"],
  ["unsignedmediumint", "mediumint unsigned"],
  ["unsignedint", "int unsigned"],
  ["unsignedbigint", "bigint unsigned"],
]);

function findNativeAttribute(field: PrismaField): PrismaAttribute | undefined {
  return field.attributes.find((attribute) =>
    attribute.name.startsWith(NATIVE_PREFIX),
  );
}

function nativeArgument(argument: PrismaArgument): string | null {
  const { value } = argument;
  if (argument.name !== null) {
    return null;
  }
  if (value.kind === "number") {
    return value.text;
  }
  return value.kind === "identifier" ? value.name : null;
}

// `@db.VarChar(255)` as SQL text (`varchar(255)`); every database here reads
// type names case-insensitively, and PostgreSQL stores them lowercased.
function nativeSqlType(
  attribute: PrismaAttribute,
  provider: SqlDialect,
): string | null {
  const name = attribute.name.slice(NATIVE_PREFIX.length).toLowerCase();
  const sqlName =
    provider === "mysql" ? (MYSQL_NATIVE_ALIASES.get(name) ?? name) : name;
  const args = attribute.args.map(nativeArgument);
  if (args.length === 0) {
    return sqlName;
  }
  const readable = args.filter((arg) => arg !== null);
  return readable.length === args.length
    ? `${sqlName}(${readable.join(", ")})`
    : null;
}

function customType(name: string): SqlTypeMapping {
  return isSafeCustomTypeName(name)
    ? mapped({ kind: "custom", name })
    : TYPE_NOT_SUPPORTED;
}

function listElementType(
  field: PrismaField,
  context: PrismaFieldContext,
): string | null {
  if (field.unsupportedType !== null) {
    return field.unsupportedType;
  }
  const native = findNativeAttribute(field);
  if (native !== undefined) {
    return nativeSqlType(native, context.provider);
  }
  return (
    context.enumNamesByPrismaName.get(field.typeName) ??
    LIST_ELEMENT_TYPES.get(field.typeName) ??
    null
  );
}

function mapScalarList(
  field: PrismaField,
  context: PrismaFieldContext,
): SqlTypeMapping {
  const element = listElementType(field, context);
  const mapping =
    element === null ? TYPE_NOT_SUPPORTED : customType(element + LIST_SUFFIX);
  return { ...mapping, codes: ["scalar-list-as-custom", ...mapping.codes] };
}

function mapFieldType(
  field: PrismaField,
  context: PrismaFieldContext,
  hasUuidDefault: boolean,
): SqlTypeMapping {
  if (field.isList) {
    return mapScalarList(field, context);
  }
  if (field.unsupportedType !== null) {
    return customType(field.unsupportedType);
  }
  const native = findNativeAttribute(field);
  if (native !== undefined) {
    const rawType = nativeSqlType(native, context.provider);
    return rawType === null
      ? TYPE_NOT_SUPPORTED
      : mapSqlType({
          rawType,
          dialect: context.provider,
          enumNameKeys: NO_ENUM_NAMES,
          hasUuidDefault,
        });
  }
  const enumName = context.enumNamesByPrismaName.get(field.typeName);
  if (enumName !== undefined) {
    return mapped({ kind: "enum", enumName });
  }
  const scalar = SCALAR_TYPES[context.provider].get(field.typeName);
  return scalar === undefined ? TYPE_NOT_SUPPORTED : mapped(scalar);
}

/**
 * Maps the type and `@default` of a field that holds a column (import / export
 * spec, section 6 "Tên, kiểu, thuộc tính"). Relation fields never get here.
 */
export function mapPrismaScalarField(
  field: PrismaField,
  context: PrismaFieldContext,
): PrismaFieldMapping {
  const defaultAttribute = field.attributes.find(
    (attribute) => attribute.name === DEFAULT_ATTRIBUTE,
  );
  // A named argument such as `map:` names the SQL Server default constraint,
  // which the model does not keep.
  const value =
    defaultAttribute?.args.find((argument) => argument.name === null)?.value ??
    null;
  const hasUuidDefault = value?.kind === "call" && value.name === UUID_FUNCTION;
  const type = mapFieldType(field, context, hasUuidDefault);
  const typePosition = (findNativeAttribute(field) ?? field).position;
  const defaultMapping = mapPrismaDefault({
    value,
    columnType: type.type,
    provider: context.provider,
    enumValues: context.enumValuesByPrismaName.get(field.typeName),
  });
  // Without `@default` the value is null, which maps to no default; its
  // default-not-supported belongs only to an attribute that has no value.
  const defaultCodes =
    defaultAttribute === undefined
      ? []
      : defaultMapping.codes.map((code) => ({
          code,
          field: "defaultValue" as const,
          position: defaultAttribute.position,
        }));
  return {
    type: type.type,
    isAutoIncrement: type.isAutoIncrement || defaultMapping.isAutoIncrement,
    defaultValue: defaultMapping.defaultValue,
    diagnostics: [
      ...type.codes.map((code) => ({
        code,
        field: "type" as const,
        position: typePosition,
      })),
      ...defaultCodes,
    ],
  };
}
