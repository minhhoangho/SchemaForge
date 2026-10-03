import type { Column } from "../model/column.js";
import type { ColumnDefault } from "../model/column-default.js";
import type { ColumnType } from "../model/column-type.js";
import type { GenerateId } from "../model/ids.js";
import { createColumnId } from "../model/ids.js";
import type { SchemaDocument } from "../model/schema-document.js";
import type { Table } from "../model/table.js";
import type { Result } from "../result.js";
import { err, ok } from "../result.js";
import type { AiEditError } from "./ai-edit-error-codes.js";
import type { AiColumnSpec } from "./ai-edit-tools.js";
import { formatAiName } from "./describe-path-for-ai.js";
import { findEnumByName } from "./resolve-ai-names.js";

type AiColumnTypeSpec = AiColumnSpec["type"];

const TYPE_PARAMETERS = [
  "length",
  "precision",
  "scale",
  "enumName",
  "customName",
] as const;

type TypeParameter = (typeof TYPE_PARAMETERS)[number];

// Every parameter a kind takes is required; kinds not listed take none.
const PARAMETERS_BY_KIND = new Map<
  AiColumnTypeSpec["kind"],
  readonly TypeParameter[]
>([
  ["char", ["length"]],
  ["varchar", ["length"]],
  ["decimal", ["precision", "scale"]],
  ["enum", ["enumName"]],
  ["custom", ["customName"]],
]);

function invalidType(
  parameter: TypeParameter,
  at: string,
): Result<never, AiEditError> {
  return err({ code: "column-type-invalid", path: [parameter], at });
}

/**
 * Turns the flat AI type object (AI-R12) into core's column type. Paths of
 * the returned errors are relative to `spec`. A missing or extra parameter
 * for the kind is `column-type-invalid`; an unknown enum is
 * `enum-name-not-found`, located at the requested enum name.
 */
export function toColumnType(
  schema: SchemaDocument,
  spec: AiColumnTypeSpec,
  at: string,
): Result<ColumnType, AiEditError> {
  const allowed = PARAMETERS_BY_KIND.get(spec.kind) ?? [];
  const extra = TYPE_PARAMETERS.find(
    (parameter) =>
      spec[parameter] !== undefined && !allowed.includes(parameter),
  );
  if (extra !== undefined) {
    return invalidType(extra, at);
  }
  if (spec.kind === "char" || spec.kind === "varchar") {
    return spec.length === undefined
      ? invalidType("length", at)
      : ok({ kind: spec.kind, length: spec.length });
  }
  if (spec.kind === "decimal") {
    return toDecimalType(spec, at);
  }
  if (spec.kind === "enum") {
    return toEnumType(schema, spec, at);
  }
  if (spec.kind === "custom") {
    return spec.customName === undefined
      ? invalidType("customName", at)
      : ok({ kind: "custom", name: spec.customName });
  }
  return ok({ kind: spec.kind });
}

function toDecimalType(
  spec: AiColumnTypeSpec,
  at: string,
): Result<ColumnType, AiEditError> {
  if (spec.precision === undefined) {
    return invalidType("precision", at);
  }
  if (spec.scale === undefined) {
    return invalidType("scale", at);
  }
  return ok({ kind: "decimal", precision: spec.precision, scale: spec.scale });
}

function toEnumType(
  schema: SchemaDocument,
  spec: AiColumnTypeSpec,
  at: string,
): Result<ColumnType, AiEditError> {
  if (spec.enumName === undefined) {
    return invalidType("enumName", at);
  }
  const found = findEnumByName(schema, spec.enumName);
  return found === null
    ? err({
        code: "enum-name-not-found",
        path: ["enumName"],
        at: `enums.${formatAiName(spec.enumName)}`,
      })
    : ok({ kind: "enum", enumId: found.id });
}

/**
 * Turns the AI default value into core's column default; an absent or null
 * default is `null` (AI-R11). Paths of the returned errors are relative to
 * `spec`.
 */
export function toColumnDefault(
  spec: AiColumnSpec["defaultValue"],
  at: string,
): Result<ColumnDefault | null, AiEditError> {
  if (spec === undefined || spec === null) {
    return ok(null);
  }
  const invalid = err({
    code: "default-value-invalid",
    path: ["value"],
    at,
  } as const);
  if (spec.kind === "literal") {
    return spec.value === undefined
      ? invalid
      : ok({ kind: "literal", value: spec.value });
  }
  return spec.value === undefined ? ok({ kind: spec.kind }) : invalid;
}

function prefixPath(error: AiEditError, field: string): AiEditError {
  return { ...error, path: [field, ...error.path] };
}

/**
 * Builds a new column of `table` from an AI column spec, with an explicit
 * value for every optional field (AI-R11). Paths of the returned errors are
 * relative to `spec`, and `at` names the column by its requested name.
 */
export function toColumn(
  schema: SchemaDocument,
  spec: AiColumnSpec,
  table: Pick<Table, "id" | "name">,
  generateId: GenerateId,
): Result<Column, AiEditError> {
  const at = `tables.${formatAiName(table.name)}.columns.${formatAiName(spec.name)}`;
  const type = toColumnType(schema, spec.type, at);
  if (!type.isOk) {
    return err(prefixPath(type.error, "type"));
  }
  const defaultValue = toColumnDefault(spec.defaultValue, at);
  if (!defaultValue.isOk) {
    return err(prefixPath(defaultValue.error, "defaultValue"));
  }
  return ok({
    id: createColumnId(generateId),
    tableId: table.id,
    name: spec.name,
    type: type.value,
    isNullable: spec.isNullable,
    defaultValue: defaultValue.value,
    isUnique: spec.isUnique ?? false,
    isAutoIncrement: spec.isAutoIncrement ?? false,
    comment: spec.comment ?? "",
  });
}
