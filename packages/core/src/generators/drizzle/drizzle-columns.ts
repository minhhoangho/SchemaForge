import type { EnumId } from "../../model/ids.js";
import { findDefaultValueProblem } from "../../validation/rules/default-literals.js";
import { createDiagnostic } from "../shared/diagnostics.js";
import type { GeneratorDiagnostic } from "../shared/generator-types.js";
import type { DrizzleVariableNames } from "./drizzle-names.js";
import type { DrizzleDefaultInput } from "./drizzle-defaults.js";
import { renderDrizzleDefault } from "./drizzle-defaults.js";
import { BINARY_DATA_TYPES } from "./drizzle-names.js";

export type DrizzleColumnInput = DrizzleDefaultInput & {
  readonly columnName: string;
  readonly names: DrizzleVariableNames;
};

export type DrizzleColumn = {
  readonly expression: string;
  // Names imported from the dialect module, plus "sql" from "drizzle-orm".
  readonly builders: readonly string[];
  readonly diagnostics: readonly GeneratorDiagnostic[];
};

// Fractional seconds kept by time and timestamp columns (spec R15).
const FRACTIONAL_SECOND_DIGITS = 6;
// A UUID as text: 32 hex digits and 4 hyphens.
const UUID_TEXT_LENGTH = 36;

type Builder = {
  readonly expression: string;
  readonly builders: readonly string[];
};

function call(name: string, columnName: string, options?: string): Builder {
  const argument = JSON.stringify(columnName);
  return {
    expression:
      options === undefined
        ? `${name}(${argument})`
        : `${name}(${argument}, { ${options} })`,
    builders: [name],
  };
}

function variableCall(variable: string, columnName: string): Builder {
  return {
    expression: `${variable}(${JSON.stringify(columnName)})`,
    builders: [],
  };
}

function customTypeCall(input: DrizzleColumnInput, dataType: string): Builder {
  const variable = input.names.customTypeVariables.get(dataType);
  if (variable === undefined) {
    throw new Error(`No customType variable was allocated for "${dataType}"`);
  }
  return variableCall(variable, input.columnName);
}

function postgresqlBuilder(input: DrizzleColumnInput): Builder {
  const { type, columnName } = input;
  switch (type.kind) {
    case "smallint":
    case "integer":
    case "real":
    case "boolean":
    case "text":
    case "uuid":
    case "date":
      return call(type.kind, columnName);
    case "bigint":
      return call("bigint", columnName, 'mode: "bigint"');
    case "decimal":
      return call(
        "numeric",
        columnName,
        `precision: ${String(type.precision)}, scale: ${String(type.scale)}`,
      );
    case "double":
      return call("doublePrecision", columnName);
    case "char":
    case "varchar":
      return call(type.kind, columnName, `length: ${String(type.length)}`);
    case "keyText":
      return call("varchar", columnName, `length: ${String(type.length)}`);
    case "time":
    case "timestamp":
      return call(
        type.kind,
        columnName,
        `precision: ${String(FRACTIONAL_SECOND_DIGITS)}`,
      );
    case "timestamptz":
      return call(
        "timestamp",
        columnName,
        `precision: ${String(FRACTIONAL_SECOND_DIGITS)}, withTimezone: true`,
      );
    case "json":
      return call("jsonb", columnName);
    case "binary":
      return customTypeCall(input, BINARY_DATA_TYPES.postgresql);
    case "enum": {
      const variable = input.names.enumVariables.get(type.enumId);
      return variable === undefined
        ? call("text", columnName)
        : variableCall(variable, columnName);
    }
    case "custom":
      return customTypeCall(input, type.name);
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}

function mysqlEnumCall(input: DrizzleColumnInput, enumId: EnumId): Builder {
  const element = input.enums[enumId];
  if (element === undefined) {
    return call("longtext", input.columnName);
  }
  // An enum without values prints `[]` as-is: part 2 already reports
  // enum-values-empty (orchestrator decision, Task 18).
  const values = element.values
    .map((value) => JSON.stringify(value))
    .join(", ");
  return {
    expression: `mysqlEnum(${JSON.stringify(input.columnName)}, [${values}])`,
    builders: ["mysqlEnum"],
  };
}

function mysqlBuilder(input: DrizzleColumnInput): Builder {
  const { type, columnName } = input;
  switch (type.kind) {
    case "smallint":
    case "boolean":
    case "date":
    case "double":
    case "json":
      return call(type.kind, columnName);
    case "integer":
      return call("int", columnName);
    case "bigint":
      return call("bigint", columnName, 'mode: "bigint"');
    case "decimal":
      return call(
        "decimal",
        columnName,
        `precision: ${String(type.precision)}, scale: ${String(type.scale)}`,
      );
    case "real":
      return call("float", columnName);
    case "char":
    case "varchar":
      return call(type.kind, columnName, `length: ${String(type.length)}`);
    case "keyText":
      return call("varchar", columnName, `length: ${String(type.length)}`);
    case "text":
      return call("longtext", columnName);
    case "uuid":
      return call("char", columnName, `length: ${String(UUID_TEXT_LENGTH)}`);
    case "time":
      return call(
        "time",
        columnName,
        `fsp: ${String(FRACTIONAL_SECOND_DIGITS)}`,
      );
    case "timestamp":
      return call(
        "datetime",
        columnName,
        `fsp: ${String(FRACTIONAL_SECOND_DIGITS)}`,
      );
    case "timestamptz":
      return call(
        "timestamp",
        columnName,
        `fsp: ${String(FRACTIONAL_SECOND_DIGITS)}`,
      );
    case "binary":
      return customTypeCall(input, BINARY_DATA_TYPES.mysql);
    case "enum":
      return mysqlEnumCall(input, type.enumId);
    case "custom":
      return customTypeCall(input, type.name);
    default: {
      const unreachable: never = type;
      return unreachable;
    }
  }
}

function autoIncrementCall(input: DrizzleColumnInput): string {
  if (!input.column.isAutoIncrement) {
    return "";
  }
  return input.dialect === "postgresql"
    ? ".generatedByDefaultAsIdentity()"
    : ".autoincrement()";
}

/** One column builder chain of a Drizzle table (plan Task 18, "Kiểu"). */
export function renderDrizzleColumn(input: DrizzleColumnInput): DrizzleColumn {
  const { column } = input;
  const builder =
    input.dialect === "postgresql"
      ? postgresqlBuilder(input)
      : mysqlBuilder(input);
  // An auto-increment column ignores its default, like the SQL DDL.
  const hasInvalidDefault =
    !column.isAutoIncrement &&
    column.defaultValue !== null &&
    findDefaultValueProblem(column.type, column.defaultValue, input.enums) !==
      null;
  const defaultCall =
    hasInvalidDefault || column.isAutoIncrement
      ? null
      : renderDrizzleDefault(input);
  return {
    expression: [
      builder.expression,
      column.isNullable ? "" : ".notNull()",
      autoIncrementCall(input),
      defaultCall?.call ?? "",
    ].join(""),
    builders:
      defaultCall?.isSqlRaw === true
        ? [...builder.builders, "sql"]
        : builder.builders,
    diagnostics: hasInvalidDefault
      ? [
          createDiagnostic("default-omitted", [
            "columns",
            column.id,
            "defaultValue",
          ]),
        ]
      : [],
  };
}
