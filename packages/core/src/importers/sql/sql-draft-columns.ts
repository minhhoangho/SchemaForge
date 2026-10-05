import type { SqlDialect } from "../../generators/shared/generator-types.js";
import type {
  CoreDefaultValue,
  CoreField,
  CoreTable,
} from "../shared/dbml-core-adapter-types.js";
import type { ImportDiagnosticCode } from "../shared/import-diagnostic-codes.js";
import type { DraftColumn, DraftColumnType } from "../shared/import-draft.js";
import type { SourceLocation } from "../shared/import-types.js";
import {
  mapSqlDefault,
  type RawSqlDefault,
} from "../shared/sql-default-mapping.js";
import {
  mapSqlType,
  splitSqlServerIdentity,
} from "../shared/sql-type-mapping.js";
import type { SqlColumnDefinition } from "./sql-column-definitions.js";
import type { SqlDraftContext } from "./sql-draft-context.js";
import { unescapeParserName } from "./sql-parser-names.js";
import { tokenizeSql } from "./statement-scanner.js";

type FieldCode = {
  readonly code: ImportDiagnosticCode;
  // The last path segment; undefined targets the column itself.
  readonly field?: string;
};

type ResolvedType = {
  readonly type: DraftColumnType;
  readonly isAutoIncrement: boolean;
  readonly codes: readonly FieldCode[];
};

type ColumnAttributes = {
  readonly isPrimaryKey: boolean;
  // The values of a CHECK (… IN (…)) on the column.
  readonly checkValues: readonly string[] | null;
};

export type ColumnPosition = {
  readonly tableIndex: number;
  readonly columnIndex: number;
};

const TEXT_TYPE: DraftColumnType = { kind: "text" };
const STRING_KINDS: ReadonlySet<string> = new Set(["char", "varchar", "text"]);
const DEFAULT_IDENTITY_ARGUMENT = "1";
const ENUM_KEYWORD = "ENUM";

// A number keeps the digits of the source text (spec section 5, "Giá trị mặc
// định"); the parser loses a default it cannot hold as a JavaScript number.
function toRawDefault(
  value: CoreDefaultValue | null,
  definition: SqlColumnDefinition | null,
): RawSqlDefault | null {
  const sourceText = definition?.defaultText ?? null;
  if (value === null) {
    return sourceText === null
      ? null
      : { kind: "expression", text: sourceText };
  }
  return value.type === "number" && sourceText !== null
    ? { kind: "number", text: sourceText }
    : { kind: value.type, text: value.value };
}

// mapSqlType needs to know whether a MySQL CHAR(36) defaults to UUID().
function isUuidDefault(
  raw: RawSqlDefault | null,
  dialect: SqlDialect,
): boolean {
  return (
    raw !== null &&
    mapSqlDefault({ raw, columnType: { kind: "uuid" }, dialect }).defaultValue
      ?.kind === "generateUuid"
  );
}

// The values of a MySQL inline `ENUM(…)`, read again from the scanner type
// text, where the lexer resolves the escapes; null for any other column
// (spec section 5, "Nguồn của tên kiểu").
function readInlineEnumValues(
  field: CoreField,
  table: CoreTable,
  definition: SqlColumnDefinition | null,
  context: SqlDraftContext,
): readonly string[] | null {
  const parserName = `${table.name}_${field.name}_enum`;
  if (
    context.dialect !== "mysql" ||
    definition === null ||
    unescapeParserName(field.typeName, "mysql") !== parserName ||
    !context.inlineEnumNames.has(parserName)
  ) {
    return null;
  }
  const lexed = tokenizeSql(definition.rawType, "mysql");
  const [keyword, open] = lexed.isOk ? lexed.value : [];
  return lexed.isOk &&
    keyword?.text.toUpperCase() === ENUM_KEYWORD &&
    open?.text === "("
    ? lexed.value
        .filter(({ kind }) => kind === "string")
        .map(({ value }) => value)
    : null;
}

function resolveDeclaredType(
  rawType: string,
  rawDefault: RawSqlDefault | null,
  context: SqlDraftContext,
): ResolvedType {
  const { typeName, identity } =
    context.dialect === "sqlserver"
      ? splitSqlServerIdentity(rawType)
      : { typeName: rawType, identity: null };
  const mapping = mapSqlType({
    rawType: typeName,
    dialect: context.dialect,
    enumNameKeys: context.enumNameKeys,
    hasUuidDefault: isUuidDefault(rawDefault, context.dialect),
  });
  const hasIdentityOptions =
    identity !== null &&
    (identity.seed !== DEFAULT_IDENTITY_ARGUMENT ||
      identity.step !== DEFAULT_IDENTITY_ARGUMENT);
  return {
    type: mapping.type,
    isAutoIncrement: mapping.isAutoIncrement || identity !== null,
    codes: [
      ...mapping.codes.map((code) => ({ code, field: "type" })),
      ...(hasIdentityOptions
        ? [
            {
              code: "identity-options-dropped",
              field: "isAutoIncrement",
            } as const,
          ]
        : []),
    ],
  };
}

function resolveType(
  field: CoreField,
  table: CoreTable,
  rawDefault: RawSqlDefault | null,
  context: SqlDraftContext,
): ResolvedType {
  const definition = context.locations.columnDefinition(table.name, field.name);
  const enumValues = readInlineEnumValues(field, table, definition, context);
  if (enumValues !== null) {
    const enumName = `${table.name}_${field.name}`;
    context.parts.enums.push({
      name: enumName,
      values: enumValues,
      location: context.locations.column(table.name, field.name),
    });
    return {
      type: { kind: "enum", enumName },
      isAutoIncrement: false,
      codes: [],
    };
  }
  // A SQL Server computed column declares no type (spec section 5).
  if (definition?.isComputed === true && definition.rawType === "") {
    return { type: TEXT_TYPE, isAutoIncrement: false, codes: [] };
  }
  return resolveDeclaredType(
    definition?.rawType ?? field.typeName,
    rawDefault,
    context,
  );
}

// A CHECK `<column> IN (…)` on a string column becomes the enum
// `<table>_<column>`; on any other column it is dropped.
function applyCheckEnum(
  resolved: ResolvedType,
  checkValues: readonly string[] | null,
  table: CoreTable,
  field: CoreField,
  context: SqlDraftContext,
): ResolvedType {
  if (checkValues === null) {
    return resolved;
  }
  const location = context.locations.column(table.name, field.name);
  if (!STRING_KINDS.has(resolved.type.kind)) {
    context.parts.diagnostics.push({
      code: "check-constraint-not-supported",
      location,
      target: null,
    });
    return resolved;
  }
  const enumName = `${table.name}_${field.name}`;
  context.parts.enums.push({ name: enumName, values: checkValues, location });
  return {
    type: { kind: "enum", enumName },
    isAutoIncrement: resolved.isAutoIncrement,
    codes: [{ code: "check-converted-to-enum", field: "type" }],
  };
}

function definitionCodes(
  definition: SqlColumnDefinition | null,
): readonly FieldCode[] {
  return [
    ...(definition?.hasOnUpdate === true
      ? [{ code: "on-update-not-supported" } as const]
      : []),
    ...(definition?.hasCollation === true
      ? [{ code: "type-parameter-dropped", field: "type" } as const]
      : []),
    ...(definition?.isComputed === true
      ? [{ code: "computed-column-not-supported" } as const]
      : []),
  ];
}

function defaultCodeField(code: ImportDiagnosticCode): string {
  return code === "sequence-default-as-auto-increment"
    ? "isAutoIncrement"
    : "defaultValue";
}

function translateDefault(
  raw: RawSqlDefault | null,
  columnType: DraftColumnType,
  context: SqlDraftContext,
): {
  readonly defaultValue: DraftColumn["defaultValue"];
  readonly isAutoIncrement: boolean;
  readonly codes: readonly FieldCode[];
} {
  if (raw === null) {
    return { defaultValue: null, isAutoIncrement: false, codes: [] };
  }
  const mapping = mapSqlDefault({ raw, columnType, dialect: context.dialect });
  return {
    defaultValue: mapping.defaultValue ?? null,
    isAutoIncrement: mapping.isAutoIncrement,
    codes: mapping.codes.map((code) => ({
      code,
      field: defaultCodeField(code),
    })),
  };
}

function reportColumnCodes(
  codes: readonly FieldCode[],
  location: SourceLocation | null,
  position: ColumnPosition,
  context: SqlDraftContext,
): void {
  codes.forEach(({ code, field }) =>
    context.parts.diagnostics.push({
      code,
      location,
      target: {
        kind: "column",
        ...position,
        ...(field === undefined ? {} : { field }),
      },
    }),
  );
}

/** One column of a parsed table; its diagnostics and enums go to the context. */
export function translateColumn(
  field: CoreField,
  table: CoreTable,
  position: ColumnPosition,
  attributes: ColumnAttributes,
  context: SqlDraftContext,
): DraftColumn {
  const location = context.locations.column(table.name, field.name);
  const override = context.overrides.column(
    position.tableIndex,
    position.columnIndex,
  );
  const definition = context.locations.columnDefinition(table.name, field.name);
  const rawDefault =
    override?.defaultValue?.raw ?? toRawDefault(field.defaultValue, definition);
  const resolved = applyCheckEnum(
    resolveType(field, table, rawDefault, context),
    attributes.checkValues,
    table,
    field,
    context,
  );
  const defaultMapping = translateDefault(rawDefault, resolved.type, context);
  reportColumnCodes(
    [...definitionCodes(definition), ...resolved.codes],
    location,
    position,
    context,
  );
  const defaultLocation = override?.defaultValue?.location ?? location;
  reportColumnCodes(defaultMapping.codes, defaultLocation, position, context);
  return {
    name: field.name,
    type: resolved.type,
    isNullable: !field.isNotNull && !attributes.isPrimaryKey,
    isUnique: field.isUnique,
    isAutoIncrement:
      field.isIncrement ||
      resolved.isAutoIncrement ||
      (override?.isIdentity ?? false) ||
      defaultMapping.isAutoIncrement,
    defaultValue: defaultMapping.defaultValue,
    comment: override?.comment ?? field.note ?? "",
    location,
  };
}
